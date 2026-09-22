begin;

-- Safety guards: no loyalty history or granted reward may be discarded here.
do $$
begin
  if exists (select 1 from public.loyalty_events) then
    raise exception 'loyalty_events contains records; removal paused to preserve customer history';
  end if;
  if exists (select 1 from public.loyalty_rewards) then
    raise exception 'loyalty_rewards contains records; removal paused to preserve customer benefits';
  end if;
  if exists (select 1 from public.appointments where loyalty_reward_id is not null or loyalty_original_price_cents is not null) then
    raise exception 'appointments contain loyalty fields; removal paused to preserve financial history';
  end if;
end $$;

do $$
declare v_job_id integer;
begin
  for v_job_id in select jobid from cron.job where jobname='loyalty-penalties-daily' loop
    perform cron.unschedule(v_job_id);
  end loop;
end $$;

drop trigger if exists appointments_loyalty_change on public.appointments;

drop function if exists public.process_loyalty_penalties();
drop function if exists public.get_my_loyalty_card();
drop function if exists public.loyalty_apply_penalties(uuid,date);
drop function if exists public.loyalty_on_appointment_change();
drop function if exists public.loyalty_is_repair(text);

drop policy if exists loyalty_rewards_own on public.loyalty_rewards;
drop policy if exists loyalty_cards_own on public.loyalty_cards;
alter table public.appointments drop column if exists loyalty_reward_id;
alter table public.appointments drop column if exists loyalty_original_price_cents;
drop table public.loyalty_events;
drop table public.loyalty_rewards;

-- Keep appointment, referral, and referral-reward-used Push behavior intact.
create or replace function public.queue_client_notification_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
begin
  if new.type in (
    'appointment-created',
    'appointment-confirmed',
    'appointment-rescheduled',
    'appointment-cancelled',
    'referral-registered',
    'referral-scheduled',
    'referral-qualified',
    'referral-reward-used'
  ) then
    insert into public.client_notification_push_dispatches(notification_id,subscription_id,client_id)
    select new.id,s.id,new.client_id
      from public.client_push_subscriptions s
     where s.client_id=new.client_id
    on conflict(notification_id,subscription_id) do nothing;
  end if;
  return new;
end;
$function$;

commit;
