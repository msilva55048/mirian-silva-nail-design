-- Infraestrutura aditiva para notificações Web Push destinadas somente à Mirian.
-- Não altera funções, policies ou regras existentes de appointments.

create table if not exists public.push_admin_config (
    singleton boolean primary key default true check (singleton),
    admin_user_id uuid not null unique references auth.users(id) on delete restrict,
    created_at timestamptz not null default now()
);

insert into public.push_admin_config (singleton, admin_user_id)
select true, id
from auth.users
where lower(email) = 'mirian201420@gmail.com'
order by created_at
limit 1
on conflict (singleton) do update set admin_user_id = excluded.admin_user_id;

do $$
begin
    if not exists (select 1 from public.push_admin_config where singleton) then
        raise exception 'Conta Admin mirian201420@gmail.com não encontrada em auth.users';
    end if;
end;
$$;

create table if not exists public.admin_push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    admin_user_id uuid not null references auth.users(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth_key text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_success_at timestamptz
);

create table if not exists public.appointment_push_events (
    id uuid primary key default gen_random_uuid(),
    appointment_id uuid not null,
    event_type text not null check (event_type in ('created', 'rescheduled', 'cancelled')),
    actor_user_id uuid not null,
    client_name text not null,
    service_name text not null,
    old_date date,
    old_time time,
    new_date date,
    new_time time,
    source_transaction_id bigint not null default txid_current(),
    status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed')),
    attempts integer not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    processed_at timestamptz,
    unique (appointment_id, event_type, source_transaction_id)
);

create index if not exists appointment_push_events_status_created_idx
    on public.appointment_push_events (status, created_at);

alter table public.push_admin_config enable row level security;
alter table public.admin_push_subscriptions enable row level security;
alter table public.appointment_push_events enable row level security;

revoke all on public.push_admin_config from anon, authenticated;
revoke all on public.admin_push_subscriptions from anon, authenticated;
revoke all on public.appointment_push_events from anon, authenticated;
grant all on public.push_admin_config to service_role;
grant all on public.admin_push_subscriptions to service_role;
grant all on public.appointment_push_events to service_role;

create or replace function public.capture_client_appointment_push_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_actor uuid := auth.uid();
    v_admin uuid;
    v_event_type text;
begin
    select admin_user_id into v_admin
    from public.push_admin_config
    where singleton;

    -- Eventos sem usuário autenticado e mudanças feitas pela própria Mirian não notificam.
    if v_actor is null or v_actor = v_admin then
        return new;
    end if;

    if tg_op = 'INSERT' then
        v_event_type := 'created';
    elsif old.status is distinct from 'cancelled' and new.status = 'cancelled' then
        v_event_type := 'cancelled';
    elsif old.appointment_date is distinct from new.appointment_date
       or old.start_time is distinct from new.start_time then
        v_event_type := 'rescheduled';
    else
        return new;
    end if;

    insert into public.appointment_push_events (
        appointment_id, event_type, actor_user_id, client_name, service_name,
        old_date, old_time, new_date, new_time
    ) values (
        new.id, v_event_type, v_actor, new.client_name, new.service_name,
        case when tg_op = 'UPDATE' then old.appointment_date else null end,
        case when tg_op = 'UPDATE' then old.start_time else null end,
        new.appointment_date, new.start_time
    ) on conflict (appointment_id, event_type, source_transaction_id) do nothing;

    return new;
end;
$$;

revoke all on function public.capture_client_appointment_push_event() from public, anon, authenticated;

drop trigger if exists appointments_capture_client_push_event on public.appointments;
create trigger appointments_capture_client_push_event
after insert or update on public.appointments
for each row execute function public.capture_client_appointment_push_event();

comment on table public.appointment_push_events is
    'Outbox idempotente para Web Push do Admin; preenchida pelo trigger de appointments.';
