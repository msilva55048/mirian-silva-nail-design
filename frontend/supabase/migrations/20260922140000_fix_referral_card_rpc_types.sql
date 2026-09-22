begin;

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
           rr.id, rr.status, rr.discount_percent::integer, cr.qualified_at,
           (select (min(a.appointment_date::timestamp+a.start_time) at time zone 'America/Sao_Paulo')::timestamptz from public.appointments a where a.client_id=cr.referred_client_id and a.status in ('pending','confirmed') and (a.appointment_date::timestamp+a.start_time+make_interval(mins=>coalesce(a.duration_minutes,0))) > timezone('America/Sao_Paulo', now()))
      from public.client_referrals cr
      join public.client_profiles owner on owner.id=cr.referrer_client_id and owner.user_id=auth.uid()
      join public.client_profiles referred on referred.id=cr.referred_client_id
      left join public.referral_rewards rr on rr.referral_id=cr.id and rr.status in ('available','reserved')
     where cr.status = 'pending' or rr.id is not null
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
           rr.id, rr.status, rr.discount_percent::integer, cr.qualified_at
      from public.client_referrals cr
      join public.client_profiles owner on owner.id=cr.referrer_client_id
      join public.client_profiles referred on referred.id=cr.referred_client_id
      left join public.referral_rewards rr on rr.referral_id=cr.id and rr.status in ('available','reserved')
     where cr.status = 'pending' or rr.id is not null
     order by owner.full_name, cr.created_at, cr.id;
end;
$function$;

commit;
