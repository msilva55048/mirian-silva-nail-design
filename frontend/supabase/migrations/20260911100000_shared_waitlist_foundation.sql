-- Fundação aditiva da lista de espera compartilhada.
-- Não altera waiting_list, appointments, push existente ou scheduler.
begin;

create table if not exists public.waiting_list_requests (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.client_profiles(id) on delete cascade,
    service_id bigint not null references public.services(id) on delete restrict,
    service_name_snapshot text not null,
    selected_date date not null,
    week_start date not null,
    week_end date not null,
    source text not null check (source in ('client', 'admin')),
    status text not null default 'active' check (status in ('active', 'fulfilled', 'cancelled', 'expired')),
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (week_end = week_start + 4),
    check (selected_date between week_start and week_end),
    check (selected_date >= week_start and selected_date <= week_end)
);

create unique index if not exists waiting_list_requests_active_unique
    on public.waiting_list_requests (client_id, service_id, week_start)
    where status = 'active';
create index if not exists waiting_list_requests_eligibility_idx
    on public.waiting_list_requests (status, week_start, week_end, service_id);
create index if not exists waiting_list_requests_client_idx
    on public.waiting_list_requests (client_id, status, week_start);

create table if not exists public.waitlist_opportunities (
    id uuid primary key default gen_random_uuid(),
    source_appointment_id uuid not null references public.appointments(id) on delete cascade,
    service_id bigint not null references public.services(id) on delete restrict,
    service_name_snapshot text not null,
    appointment_date date not null,
    start_time time without time zone not null,
    duration_minutes integer not null check (duration_minutes > 0),
    status text not null default 'open' check (status in ('open', 'claimed', 'expired', 'cancelled')),
    expires_at timestamptz,
    claimed_by_client_id uuid references public.client_profiles(id) on delete set null,
    claimed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source_appointment_id, appointment_date, start_time)
);
create index if not exists waitlist_opportunities_open_idx
    on public.waitlist_opportunities (status, appointment_date, start_time);
create index if not exists waitlist_opportunities_source_idx
    on public.waitlist_opportunities (source_appointment_id, created_at desc);

create table if not exists public.waitlist_push_dispatches (
    id uuid primary key default gen_random_uuid(),
    opportunity_id uuid not null references public.waitlist_opportunities(id) on delete cascade,
    client_id uuid not null references public.client_profiles(id) on delete cascade,
    subscription_id uuid not null references public.client_push_subscriptions(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'opened', 'expired')),
    sent_at timestamptz,
    opened_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (opportunity_id, client_id, subscription_id)
);
create index if not exists waitlist_push_dispatches_status_idx
    on public.waitlist_push_dispatches (status, created_at);
create index if not exists waitlist_push_dispatches_client_idx
    on public.waitlist_push_dispatches (client_id, created_at desc);

alter table public.waiting_list_requests enable row level security;
alter table public.waitlist_opportunities enable row level security;
alter table public.waitlist_push_dispatches enable row level security;

revoke all on public.waiting_list_requests, public.waitlist_opportunities, public.waitlist_push_dispatches from anon, authenticated;
grant all on public.waiting_list_requests, public.waitlist_opportunities, public.waitlist_push_dispatches to service_role;

drop policy if exists waiting_list_requests_admin_select on public.waiting_list_requests;
create policy waiting_list_requests_admin_select on public.waiting_list_requests
    for select to authenticated using ((select public.is_admin()));
drop policy if exists waiting_list_requests_admin_insert on public.waiting_list_requests;
create policy waiting_list_requests_admin_insert on public.waiting_list_requests
    for insert to authenticated with check ((select public.is_admin()));
drop policy if exists waiting_list_requests_admin_update on public.waiting_list_requests;
create policy waiting_list_requests_admin_update on public.waiting_list_requests
    for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists waitlist_opportunities_admin_select on public.waitlist_opportunities;
create policy waitlist_opportunities_admin_select on public.waitlist_opportunities
    for select to authenticated using ((select public.is_admin()));
drop policy if exists waitlist_push_dispatches_admin_select on public.waitlist_push_dispatches;
create policy waitlist_push_dispatches_admin_select on public.waitlist_push_dispatches
    for select to authenticated using ((select public.is_admin()));

create or replace function public.waitlist_week_start(p_selected_date date)
returns date
language sql immutable strict
as $$
    select p_selected_date - (extract(isodow from p_selected_date)::integer - 1);
$$;
revoke all on function public.waitlist_week_start(date) from public, anon, authenticated;
grant execute on function public.waitlist_week_start(date) to service_role;

create or replace function public.create_my_waitlist_request(p_service_id bigint, p_selected_date date)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
    v_user_id uuid := auth.uid();
    v_client_id uuid;
    v_service public.services%rowtype;
    v_week_start date;
    v_week_end date;
    v_request public.waiting_list_requests;
begin
    if v_user_id is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
    select cp.id into v_client_id from public.client_profiles cp where cp.user_id = v_user_id limit 1;
    if v_client_id is null then raise exception 'Perfil de cliente não encontrado.' using errcode = '42501'; end if;
    select s.* into v_service from public.services s where s.id = p_service_id and s.is_active = true;
    if not found then raise exception 'Serviço inválido ou indisponível.' using errcode = '22023'; end if;
    if p_selected_date is null then raise exception 'Data obrigatória.' using errcode = '22023'; end if;
    if extract(isodow from p_selected_date) > 5 then raise exception 'A lista de espera aceita somente dias úteis.' using errcode = '22023'; end if;
    if p_selected_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data selecionada já passou.' using errcode = '22023'; end if;
    v_week_start := public.waitlist_week_start(p_selected_date);
    v_week_end := v_week_start + 4;
    if v_week_end < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A semana selecionada já terminou.' using errcode = '22023'; end if;
    insert into public.waiting_list_requests (client_id, service_id, service_name_snapshot, selected_date, week_start, week_end, source, status, expires_at)
    values (v_client_id, v_service.id, v_service.name, p_selected_date, v_week_start, v_week_end, 'client', 'active', (v_week_end + 1)::timestamp at time zone 'America/Sao_Paulo')
    returning * into v_request;
    return v_request;
exception when unique_violation then
    raise exception 'Já existe uma solicitação ativa para este serviço e semana.' using errcode = '23505';
end;
$$;
revoke all on function public.create_my_waitlist_request(bigint, date) from public, anon, authenticated;
grant execute on function public.create_my_waitlist_request(bigint, date) to authenticated;

create or replace function public.get_my_waitlist_requests()
returns setof public.waiting_list_requests
language sql stable security definer set search_path = pg_catalog, public
as $$
    select r.* from public.waiting_list_requests r
    join public.client_profiles cp on cp.id = r.client_id
    where cp.user_id = auth.uid()
    order by (r.status <> 'active'), r.week_start, r.selected_date, r.created_at desc;
$$;
revoke all on function public.get_my_waitlist_requests() from public, anon, authenticated;
grant execute on function public.get_my_waitlist_requests() to authenticated;

create or replace function public.cancel_my_waitlist_request(p_request_id uuid)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_request public.waiting_list_requests;
begin
    update public.waiting_list_requests r set status = 'cancelled', updated_at = now()
    from public.client_profiles cp
    where r.id = p_request_id and r.client_id = cp.id and cp.user_id = auth.uid() and r.status = 'active'
    returning r.* into v_request;
    if not found then raise exception 'Solicitação não encontrada ou não pertence à cliente.' using errcode = '42501'; end if;
    return v_request;
end;
$$;
revoke all on function public.cancel_my_waitlist_request(uuid) from public, anon, authenticated;
grant execute on function public.cancel_my_waitlist_request(uuid) to authenticated;

create or replace function public.admin_list_waitlist_requests(p_include_history boolean default true)
returns setof public.waiting_list_requests
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
    if not public.is_admin() then raise exception 'Acesso restrito ao Admin.' using errcode = '42501'; end if;
    return query select r.* from public.waiting_list_requests r
    where p_include_history or r.status = 'active'
    order by (r.status <> 'active'), r.week_start, r.selected_date, r.created_at;
end;
$$;
revoke all on function public.admin_list_waitlist_requests(boolean) from public, anon, authenticated;
grant execute on function public.admin_list_waitlist_requests(boolean) to authenticated;

create or replace function public.admin_create_waitlist_request(p_client_id uuid, p_service_id bigint, p_selected_date date)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_service public.services%rowtype; v_week_start date; v_week_end date; v_request public.waiting_list_requests;
begin
    if not public.is_admin() then raise exception 'Acesso restrito ao Admin.' using errcode = '42501'; end if;
    if not exists (select 1 from public.client_profiles where id = p_client_id) then raise exception 'Cliente não encontrada.' using errcode = '22023'; end if;
    select s.* into v_service from public.services s where s.id = p_service_id and s.is_active = true;
    if not found then raise exception 'Serviço inválido ou indisponível.' using errcode = '22023'; end if;
    if p_selected_date is null or extract(isodow from p_selected_date) > 5 then raise exception 'A lista de espera aceita somente dias úteis.' using errcode = '22023'; end if;
    if p_selected_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data selecionada já passou.' using errcode = '22023'; end if;
    v_week_start := public.waitlist_week_start(p_selected_date); v_week_end := v_week_start + 4;
    if v_week_end < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A semana selecionada já terminou.' using errcode = '22023'; end if;
    insert into public.waiting_list_requests (client_id, service_id, service_name_snapshot, selected_date, week_start, week_end, source, status, expires_at)
    values (p_client_id, v_service.id, v_service.name, p_selected_date, v_week_start, v_week_end, 'admin', 'active', (v_week_end + 1)::timestamp at time zone 'America/Sao_Paulo')
    returning * into v_request;
    return v_request;
exception when unique_violation then
    raise exception 'Já existe uma solicitação ativa para este serviço e semana.' using errcode = '23505';
end;
$$;
revoke all on function public.admin_create_waitlist_request(uuid, bigint, date) from public, anon, authenticated;
grant execute on function public.admin_create_waitlist_request(uuid, bigint, date) to authenticated;

create or replace function public.admin_cancel_waitlist_request(p_request_id uuid)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_request public.waiting_list_requests;
begin
    if not public.is_admin() then raise exception 'Acesso restrito ao Admin.' using errcode = '42501'; end if;
    update public.waiting_list_requests set status = 'cancelled', updated_at = now()
    where id = p_request_id and status = 'active' returning * into v_request;
    if not found then raise exception 'Solicitação ativa não encontrada.' using errcode = 'P0002'; end if;
    return v_request;
end;
$$;
revoke all on function public.admin_cancel_waitlist_request(uuid) from public, anon, authenticated;
grant execute on function public.admin_cancel_waitlist_request(uuid) to authenticated;

commit;
