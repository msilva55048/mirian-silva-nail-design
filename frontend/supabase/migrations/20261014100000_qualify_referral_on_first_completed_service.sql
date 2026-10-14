begin;

-- A referral is earned by a completed service, not merely by the first
-- appointment being created. This lets a later booking qualify when the first
-- booking was cancelled or removed, while keeping qualification one-time.
create or replace function public.qualify_referral_after_completed_service(
    p_referred_client_id uuid,
    p_appointment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_referral public.client_referrals%rowtype;
    v_appointment_created_at timestamptz;
    v_reward_id uuid;
begin
    select a.created_at
      into v_appointment_created_at
      from public.appointments a
     where a.id = p_appointment_id
       and a.client_id = p_referred_client_id
       and a.status = 'completed';

    if v_appointment_created_at is null then
        return null;
    end if;

    select cr.*
      into v_referral
      from public.client_referrals cr
     where cr.referred_client_id = p_referred_client_id
       and cr.status = 'pending'
       and cr.created_at <= v_appointment_created_at
     order by cr.created_at, cr.id
     limit 1
     for update;

    if v_referral.id is null then
        return null;
    end if;

    -- Do not award a second time for legacy rows whose first completed
    -- service was missed by the old appointment-created marker.
    if exists (
        select 1
          from public.appointments a
         where a.client_id = p_referred_client_id
           and a.status = 'completed'
           and a.id <> p_appointment_id
           and a.created_at >= v_referral.created_at
    ) then
        return null;
    end if;

    insert into public.referral_rewards (client_id, referral_id, discount_percent)
    values (v_referral.referrer_client_id, v_referral.id, 30)
    on conflict (referral_id) do nothing
    returning id into v_reward_id;

    if v_reward_id is null then
        return null;
    end if;

    update public.client_referrals
       set status = 'rewarded', qualified_at = coalesce(qualified_at, now())
     where id = v_referral.id
       and status = 'pending';

    perform public.reserve_available_referral_reward(v_referral.referrer_client_id);
    return v_referral.id;
end;
$function$;

revoke all on function public.qualify_referral_after_completed_service(uuid, uuid)
    from public, anon, authenticated;

-- Keep reward consumption and qualification in the database trigger so every
-- completion path (including the ADM restore RPC) follows the same rule.
create or replace function public.finalize_referral_reward_after_appointment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_referral_id uuid;
    v_referrer_client_id uuid;
    v_discount_percent smallint;
    v_qualified_referral_id uuid;
begin
    if new.status = 'completed'
       and (tg_op = 'INSERT' or old.status is distinct from 'completed')
       and new.referral_reward_id is not null then
        update public.referral_rewards
           set status = 'used',
               used_at = coalesce(used_at, now())
         where id = new.referral_reward_id
           and client_id = new.client_id
           and status = 'reserved'
         returning referral_id, discount_percent
              into v_referral_id, v_discount_percent;

        if found then
            select referrer_client_id into v_referrer_client_id
              from public.client_referrals
             where id = v_referral_id;

            perform public.create_client_notification(
                v_referrer_client_id,
                'referral-reward-used',
                'Desconto utilizado 💖',
                format('Seu desconto de %s%% por indicação foi utilizado neste atendimento.', v_discount_percent),
                jsonb_build_object(
                    'appointment_id', new.id,
                    'reward_id', new.referral_reward_id,
                    'discount_percent', v_discount_percent
                ),
                'referral-reward',
                new.referral_reward_id,
                'referral-reward-used:' || new.referral_reward_id::text
            );
        end if;
    end if;

    if new.status = 'completed'
       and (tg_op = 'INSERT' or old.status is distinct from 'completed')
       and new.client_id is not null then
        v_qualified_referral_id := public.qualify_referral_after_completed_service(
            new.client_id,
            new.id
        );

        if v_qualified_referral_id is not null then
            select referrer_client_id into v_referrer_client_id
              from public.client_referrals
             where id = v_qualified_referral_id;

            perform public.create_client_notification(
                v_referrer_client_id,
                'referral-qualified',
                'Seu desconto foi liberado 🎉',
                'Sua indicação concluiu o atendimento. Seu desconto de 30% está disponível.',
                jsonb_build_object(
                    'appointment_id', new.id,
                    'referral_id', v_qualified_referral_id,
                    'discount_percent', 30
                ),
                'referral',
                v_qualified_referral_id,
                'referral-qualified:' || v_qualified_referral_id::text
            );
        end if;
    end if;

    return new;
end;
$function$;

revoke all on function public.finalize_referral_reward_after_appointment()
    from public, anon, authenticated;

drop trigger if exists appointments_finalize_referral_reward on public.appointments;
create trigger appointments_finalize_referral_reward
after insert or update of status on public.appointments
for each row execute function public.finalize_referral_reward_after_appointment();

-- Show a completed referred service even if it predates this code fix and is
-- still awaiting a reviewed benefit regularization. Do not imply the reward
-- exists unless an available/reserved reward row exists.
create or replace function public.get_my_active_referrals()
returns table (
    referral_id uuid, referred_name text, referral_status text,
    reward_id uuid, reward_status text, discount_percent integer,
    qualified_at timestamptz, scheduled_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
    select cr.id,
           referred.full_name,
           case
             when rr.status in ('available', 'reserved') then 'REALIZADA'
             when exists (
                 select 1 from public.appointments a
                  where a.client_id = cr.referred_client_id
                    and a.status = 'completed'
                    and a.created_at >= cr.created_at
             ) then 'REALIZADA'
             when exists (
                 select 1 from public.appointments a
                  where a.client_id = cr.referred_client_id
                    and a.status in ('pending', 'confirmed')
                    and (a.appointment_date::timestamp + a.start_time
                         + make_interval(mins => coalesce(a.duration_minutes, 0)))
                        > timezone('America/Sao_Paulo', now())
             ) then 'AGENDADA'
             else 'CADASTRADA'
           end,
           rr.id,
           rr.status,
           rr.discount_percent::integer,
           cr.qualified_at,
           (select (min(a.appointment_date::timestamp + a.start_time)
                    at time zone 'America/Sao_Paulo')::timestamptz
              from public.appointments a
             where a.client_id = cr.referred_client_id
               and a.status in ('pending', 'confirmed')
               and (a.appointment_date::timestamp + a.start_time
                    + make_interval(mins => coalesce(a.duration_minutes, 0)))
                   > timezone('America/Sao_Paulo', now()))
      from public.client_referrals cr
      join public.client_profiles owner
        on owner.id = cr.referrer_client_id and owner.user_id = auth.uid()
      join public.client_profiles referred on referred.id = cr.referred_client_id
      left join public.referral_rewards rr
        on rr.referral_id = cr.id and rr.status in ('available', 'reserved')
     where cr.status = 'pending' or rr.id is not null
     order by cr.created_at, cr.id;
$function$;

create or replace function public.get_admin_referrals()
returns table (
    referrer_id uuid, referrer_name text, referral_id uuid,
    referred_name text, referral_status text, reward_id uuid,
    reward_status text, discount_percent integer, qualified_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
    if auth.uid() is null or not public.is_mirian_admin() then
        raise exception 'not authorized' using errcode = '42501';
    end if;

    return query
    select cr.referrer_client_id,
           owner.full_name,
           cr.id,
           referred.full_name,
           case
             when rr.status in ('available', 'reserved') then 'REALIZADA'
             when exists (
                 select 1 from public.appointments a
                  where a.client_id = cr.referred_client_id
                    and a.status = 'completed'
                    and a.created_at >= cr.created_at
             ) then 'REALIZADA'
             when exists (
                 select 1 from public.appointments a
                  where a.client_id = cr.referred_client_id
                    and a.status in ('pending', 'confirmed')
                    and (a.appointment_date::timestamp + a.start_time
                         + make_interval(mins => coalesce(a.duration_minutes, 0)))
                        > timezone('America/Sao_Paulo', now())
             ) then 'AGENDADA'
             else 'CADASTRADA'
           end,
           rr.id,
           rr.status,
           rr.discount_percent::integer,
           cr.qualified_at
      from public.client_referrals cr
      join public.client_profiles owner on owner.id = cr.referrer_client_id
      join public.client_profiles referred on referred.id = cr.referred_client_id
      left join public.referral_rewards rr
        on rr.referral_id = cr.id and rr.status in ('available', 'reserved')
     where cr.status = 'pending' or rr.id is not null
     order by owner.full_name, cr.created_at, cr.id;
end;
$function$;

revoke all on function public.get_my_active_referrals() from public, anon, authenticated;
grant execute on function public.get_my_active_referrals() to authenticated;
revoke all on function public.get_admin_referrals() from public, anon, authenticated;
grant execute on function public.get_admin_referrals() to authenticated;

-- Qualification notifications now follow the exact one-time reward creation
-- performed in the finalizer, rather than the one-time appointment marker.
create or replace function public.capture_client_appointment_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_date text;
    v_time text;
begin
    if new.client_id is null then return new; end if;
    v_date := to_char(new.appointment_date, 'DD/MM');
    v_time := to_char(new.start_time, 'HH24:MI');

    if tg_op = 'INSERT' and new.status in ('pending', 'confirmed') and new.appointment_date >= current_date then
        perform public.create_client_notification(
            new.client_id, 'appointment-created', 'Agendamento marcado',
            format('Seu agendamento para %s às %s foi marcado.', v_date, v_time),
            jsonb_build_object('appointment_id', new.id), 'appointment', new.id,
            'appointment-created:' || new.id::text
        );
        if coalesce(new.is_referred_first_appointment, false) then
            perform public.create_client_notification(
                (select referrer_client_id from public.client_referrals where referred_client_id = new.client_id limit 1),
                'referral-scheduled', 'Sua indicação agendou',
                'Sua indicação marcou um atendimento.',
                jsonb_build_object('appointment_id', new.id), 'appointment', new.id,
                'referral-scheduled:' || new.id::text
            );
        end if;
    end if;

    if tg_op = 'UPDATE' and new.status in ('pending', 'confirmed') and old.status in ('pending', 'confirmed') then
        if new.confirmation_sent_at is not null and old.confirmation_sent_at is null then
            perform public.create_client_notification(
                new.client_id, 'appointment-confirmed', 'Agendamento confirmado',
                format('Seu agendamento de %s às %s foi confirmado pela Mirian.', v_date, v_time),
                jsonb_build_object('appointment_id', new.id), 'appointment', new.id,
                'appointment-confirmed:' || new.id::text
            );
        elsif new.appointment_date is distinct from old.appointment_date
           or new.start_time is distinct from old.start_time then
            perform public.create_client_notification(
                new.client_id, 'appointment-rescheduled', 'Agendamento alterado',
                format('Seu agendamento foi atualizado para %s às %s.', v_date, v_time),
                jsonb_build_object('appointment_id', new.id), 'appointment', new.id,
                'appointment-rescheduled:' || new.id::text || ':' || new.appointment_date::text || ':' || v_time
            );
        end if;
    end if;

    if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status in ('pending', 'confirmed') then
        perform public.create_client_notification(
            new.client_id, 'appointment-cancelled', 'Agendamento cancelado',
            format('Seu agendamento de %s às %s foi cancelado.', v_date, v_time),
            jsonb_build_object('appointment_id', new.id), 'appointment', new.id,
            'appointment-cancelled:' || new.id::text
        );
    end if;

    return new;
end;
$function$;

revoke all on function public.capture_client_appointment_notification()
    from public, anon, authenticated;

commit;
