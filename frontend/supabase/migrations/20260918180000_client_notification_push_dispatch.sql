-- Entrega centralizada de Push para novas notificações da Cliente, sem backfill.
begin;

create table if not exists public.client_notification_push_dispatches (
    id uuid primary key default gen_random_uuid(),
    notification_id uuid not null references public.client_notifications(id) on delete cascade,
    subscription_id uuid not null references public.client_push_subscriptions(id) on delete cascade,
    client_id uuid not null references public.client_profiles(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
    attempts integer not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    sent_at timestamptz,
    unique (notification_id, subscription_id)
);
create index if not exists client_notification_push_dispatches_pending_idx on public.client_notification_push_dispatches(status, created_at);
alter table public.client_notification_push_dispatches enable row level security;
revoke all on public.client_notification_push_dispatches from anon, authenticated;
grant all on public.client_notification_push_dispatches to service_role;

create or replace function public.queue_client_notification_push()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
begin
    if new.type in ('appointment-created','appointment-confirmed','appointment-rescheduled','appointment-cancelled','referral-registered','referral-scheduled','referral-qualified') then
        insert into public.client_notification_push_dispatches(notification_id, subscription_id, client_id)
        select new.id, s.id, new.client_id from public.client_push_subscriptions s where s.client_id = new.client_id
        on conflict (notification_id, subscription_id) do nothing;
    end if;
    return new;
end;
$function$;
drop trigger if exists client_notifications_queue_push on public.client_notifications;
create trigger client_notifications_queue_push after insert on public.client_notifications
for each row execute function public.queue_client_notification_push();

do $$ begin
    if exists (select 1 from pg_namespace where nspname = 'cron') and exists (select 1 from pg_namespace where nspname = 'net') then
        perform cron.schedule('client-notification-push-dispatch', '*/5 * * * *', $job$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/client-web-push', headers := jsonb_build_object('Content-Type', 'application/json', 'x-client-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'client_push_reminders_secret')), body := '{"action":"notification-dispatch"}'::jsonb)$job$);
    end if;
exception when duplicate_object then null; end $$;
commit;
