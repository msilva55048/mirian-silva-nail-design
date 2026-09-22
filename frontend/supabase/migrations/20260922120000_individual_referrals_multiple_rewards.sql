begin;

drop index if exists public.referral_rewards_one_active_per_client_uidx;
create unique index if not exists referral_rewards_one_per_referral_uidx
    on public.referral_rewards(referral_id);
create index if not exists referral_rewards_client_status_earned_idx
    on public.referral_rewards(client_id, status, earned_at, id);

create or replace function public.activate_referral_from_first_appointment(
    p_referred_client_id uuid,
    p_first_appointment_created_at timestamptz
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
    v_referral public.client_referrals%rowtype;
begin
    select cr.* into v_referral
      from public.client_referrals cr
     where cr.referred_client_id = p_referred_client_id
       and cr.status = 'pending'
       and p_first_appointment_created_at >= cr.created_at
     order by cr.created_at, cr.id
     limit 1 for update;

    if v_referral.id is null then return; end if;

    insert into public.referral_rewards (client_id, referral_id, discount_percent)
    values (v_referral.referrer_client_id, v_referral.id, 30)
    on conflict (referral_id) do nothing;

    update public.client_referrals
       set status = 'rewarded', qualified_at = coalesce(qualified_at, now())
     where id = v_referral.id;

    perform public.reserve_available_referral_reward(v_referral.referrer_client_id);
end;
$function$;

create or replace function public.reserve_available_referral_reward(p_client_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
    v_reward public.referral_rewards%rowtype;
    v_appointment public.appointments%rowtype;
begin
    select rr.* into v_reward
      from public.referral_rewards rr
     where rr.client_id = p_client_id and rr.status = 'available'
     order by rr.earned_at, rr.id limit 1 for update skip locked;
    if v_reward.id is null then return; end if;

    select a.* into v_appointment
      from public.appointments a
     where a.client_id = p_client_id
       and a.status in ('pending', 'confirmed')
       and a.referral_reward_id is null
       and (a.appointment_date::timestamp + a.start_time + make_interval(mins => coalesce(a.duration_minutes, 0))) > timezone('America/Sao_Paulo', now())
     order by a.appointment_date, a.start_time, a.id limit 1 for update skip locked;
    if v_appointment.id is null then return; end if;

    update public.appointments
       set original_price_cents = coalesce(original_price_cents, price_cents),
           referral_discount_percent = v_reward.discount_percent,
           price_cents = round(coalesce(original_price_cents, price_cents) * (100 - v_reward.discount_percent)::numeric / 100)::integer,
           referral_reward_id = v_reward.id
     where id = v_appointment.id and referral_reward_id is null;

    update public.referral_rewards
       set status = 'reserved', reserved_at = coalesce(reserved_at, now())
     where id = v_reward.id and status = 'available';
end;
$function$;

create or replace function public.get_my_active_referrals()
returns table (
    referral_id uuid, referred_name text, referral_status text,
    reward_id uuid, reward_status text, discount_percent integer,
    qualified_at timestamptz, scheduled_at timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $function$
    select cr.id, referred.full_name,
           case
             when rr.status in ('available','reserved') then 'REALIZADA'
             when exists (select 1 from public.appointments a where a.client_id=cr.referred_client_id and a.status in ('pending','confirmed') and (a.appointment_date::timestamp+a.start_time+make_interval(mins=>coalesce(a.duration_minutes,0))) > timezone('America/Sao_Paulo', now())) then 'AGENDADA'
             else 'CADASTRADA'
           end,
           rr.id, rr.status, rr.discount_percent, cr.qualified_at,
           (select min(a.appointment_date::timestamp+a.start_time) at time zone 'America/Sao_Paulo' from public.appointments a where a.client_id=cr.referred_client_id and a.status in ('pending','confirmed') and (a.appointment_date::timestamp+a.start_time+make_interval(mins=>coalesce(a.duration_minutes,0))) > timezone('America/Sao_Paulo', now()))
      from public.client_referrals cr
      join public.client_profiles owner on owner.id=cr.referrer_client_id and owner.user_id=auth.uid()
      join public.client_profiles referred on referred.id=cr.referred_client_id
      left join public.referral_rewards rr on rr.referral_id=cr.id and rr.status in ('available','reserved')
     where cr.status <> 'used' and (rr.id is not null or cr.status='pending')
     order by cr.created_at, cr.id;
$function$;

create or replace function public.get_admin_referrals()
returns table (
    referrer_id uuid, referrer_name text, referral_id uuid,
    referred_name text, referral_status text, reward_id uuid,
    reward_status text, discount_percent integer, qualified_at timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $function$
begin
    if auth.uid() is null or not public.is_mirian_admin() then
        raise exception 'not authorized' using errcode = '42501';
    end if;
    return query
    select cr.referrer_client_id, owner.full_name, cr.id, referred.full_name,
           case when rr.status in ('available','reserved') then 'REALIZADA'
                when exists (select 1 from public.appointments a where a.client_id=cr.referred_client_id and a.status in ('pending','confirmed') and (a.appointment_date::timestamp+a.start_time+make_interval(mins=>coalesce(a.duration_minutes,0))) > timezone('America/Sao_Paulo', now())) then 'AGENDADA'
                else 'CADASTRADA' end,
           rr.id, rr.status, rr.discount_percent, cr.qualified_at
      from public.client_referrals cr
      join public.client_profiles owner on owner.id=cr.referrer_client_id
      join public.client_profiles referred on referred.id=cr.referred_client_id
      left join public.referral_rewards rr on rr.referral_id=cr.id and rr.status in ('available','reserved')
     where cr.status <> 'used'
     order by owner.full_name, cr.created_at, cr.id;
end;
$function$;

revoke all on function public.get_my_active_referrals() from public, anon, authenticated;
grant execute on function public.get_my_active_referrals() to authenticated;
revoke all on function public.get_admin_referrals() from public, anon, authenticated;
grant execute on function public.get_admin_referrals() to authenticated;
revoke all on function public.activate_referral_from_first_appointment(uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.reserve_available_referral_reward(uuid) from public, anon, authenticated;

commit;
