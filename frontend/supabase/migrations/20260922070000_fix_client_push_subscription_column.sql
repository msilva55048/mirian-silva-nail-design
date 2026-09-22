-- A existência da linha representa a subscription disponível para o cliente.
create or replace function public.queue_client_notification_push() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.type in ('appointment-created','appointment-confirmed','appointment-rescheduled','appointment-cancelled','referral-registered','referral-scheduled','referral-qualified','referral-reward-used','loyalty-reward-earned','loyalty-reward-applied','loyalty-cycle-started') then
    insert into public.client_notification_push_dispatches(notification_id,subscription_id,client_id)
    select new.id,s.id,new.client_id from public.client_push_subscriptions s where s.client_id=new.client_id on conflict(notification_id,subscription_id) do nothing;
  end if;
  return new;
end; $$;
