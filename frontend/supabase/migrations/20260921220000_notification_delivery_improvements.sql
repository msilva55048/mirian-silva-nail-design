-- Entrega idempotente por subscription, Central da lista de espera e uso de recompensa.
begin;

alter table public.appointment_push_events
    drop constraint if exists appointment_push_events_status_check;

alter table public.appointment_push_events
    add constraint appointment_push_events_status_check
    check (status in ('pending', 'processing', 'processed', 'processed_with_errors', 'failed'));

create table if not exists public.appointment_push_dispatches (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.appointment_push_events(id) on delete cascade,
    subscription_id uuid not null references public.admin_push_subscriptions(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'invalid')),
    attempts integer not null default 0,
    last_error text,
    last_attempt_at timestamptz,
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (event_id, subscription_id)
);

create index if not exists appointment_push_dispatches_pending_idx
    on public.appointment_push_dispatches(status, created_at);

alter table public.appointment_push_dispatches enable row level security;
revoke all on public.appointment_push_dispatches from anon, authenticated;
grant all on public.appointment_push_dispatches to service_role;

-- Resolve clientes da lista independentemente de possuírem Push.
-- A oportunidade continua representando somente a vaga.
create or replace function public.get_waitlist_opportunity_notification_targets()
returns table (
    opportunity_id uuid,
    client_id uuid,
    service_name text,
    appointment_date date,
    start_time time without time zone,
    duration_minutes integer
)
language sql stable security definer set search_path = public, pg_temp
as $$
    select distinct o.id, r.client_id, o.service_name_snapshot,
        o.appointment_date, o.start_time, o.duration_minutes
    from public.waitlist_opportunities o
    join public.waiting_list_requests r
      on r.service_id = o.service_id
     and r.status = 'active'
     and o.appointment_date between r.week_start and r.week_end
    where o.status = 'open'
      and o.expires_at > now()
      and (o.appointment_date::text || ' ' || o.start_time::text)::timestamp
            at time zone 'America/Sao_Paulo' > now()
      and public.client_booking_start_allowed(
            o.appointment_date, o.start_time, o.service_name_snapshot,
            o.duration_minutes, o.source_appointment_id)
      and not exists (
        select 1 from public.appointments a
        where a.appointment_date = o.appointment_date
          and coalesce(a.status,'') not in ('cancelled','canceled','cancelado','no_show','no-show')
          and a.id <> o.source_appointment_id
          and (a.start_time < o.start_time + make_interval(mins => o.duration_minutes)
               and o.start_time < a.start_time + make_interval(mins => a.duration_minutes))
      );
$$;
revoke all on function public.get_waitlist_opportunity_notification_targets() from public, anon, authenticated;
grant execute on function public.get_waitlist_opportunity_notification_targets() to service_role;

create or replace function public.finalize_referral_reward_after_appointment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    v_referral_id uuid;
    v_referrer_client_id uuid;
    v_discount_percent smallint;
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
       and new.is_referred_first_appointment then
        perform public.activate_referral_from_first_appointment(
            new.client_id,
            new.created_at
        );
    end if;

    return new;
end;
$function$;

revoke all on function public.finalize_referral_reward_after_appointment() from public, anon, authenticated;

commit;
