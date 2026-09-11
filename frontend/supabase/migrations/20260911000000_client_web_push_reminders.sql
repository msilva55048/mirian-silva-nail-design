-- Assinaturas e entregas do Push de lembrete do cliente. Isolado do Push administrativo.
create table if not exists public.client_push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.client_profiles(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth_key text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_success_at timestamptz
);
create index if not exists client_push_subscriptions_client_idx on public.client_push_subscriptions(client_id);

create table if not exists public.client_push_reminders (
    id uuid primary key default gen_random_uuid(),
    appointment_id uuid not null references public.appointments(id) on delete cascade,
    client_id uuid not null references public.client_profiles(id) on delete cascade,
    reminder_type text not null default 'two_hour' check (reminder_type = 'two_hour'),
    status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed')),
    attempts integer not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    processed_at timestamptz,
    unique (appointment_id, reminder_type)
);
create index if not exists client_push_reminders_status_idx on public.client_push_reminders(status, created_at);
alter table public.client_push_subscriptions enable row level security;
alter table public.client_push_reminders enable row level security;
revoke all on public.client_push_subscriptions, public.client_push_reminders from anon, authenticated;
grant all on public.client_push_subscriptions, public.client_push_reminders to service_role;

create or replace function public.get_client_push_due_appointments(p_from timestamptz, p_to timestamptz)
returns table (id uuid, client_id uuid, service_name text, appointment_at timestamptz)
language sql stable security definer set search_path = pg_catalog, public
as $$
    select a.id, a.client_id, a.service_name,
        ((a.appointment_date::text || ' ' || a.start_time::text)::timestamp at time zone 'America/Sao_Paulo')
    from public.appointments a
    where a.status in ('pending', 'confirmed')
      and ((a.appointment_date::text || ' ' || a.start_time::text)::timestamp at time zone 'America/Sao_Paulo') between p_from and p_to;
$$;
revoke all on function public.get_client_push_due_appointments(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_client_push_due_appointments(timestamptz, timestamptz) to service_role;

-- The hosted project should schedule client-web-push with pg_cron + pg_net using
-- Vault secrets client_push_reminders_secret and project_url. This migration is local
-- until the deployment step is explicitly authorized.
do $$
begin
    if exists (select 1 from pg_namespace where nspname = 'cron')
       and exists (select 1 from pg_namespace where nspname = 'net') then
        perform cron.schedule(
            'client-web-push-reminders',
            '*/5 * * * *',
            $job$select net.http_post(
                url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/client-web-push',
                headers := jsonb_build_object('Content-Type', 'application/json', 'x-client-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'client_push_reminders_secret')),
                body := '{"action":"dispatch"}'::jsonb
            )$job$
        );
    end if;
exception when duplicate_object then
    null;
end;
$$;
