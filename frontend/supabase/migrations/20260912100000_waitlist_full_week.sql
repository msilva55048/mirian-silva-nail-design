-- Lista de espera: semana civil completa, de domingo a sábado.
-- Migração aditiva; preserva histórico, RPCs e a tabela waiting_list legada.
begin;

alter table public.waiting_list_requests
    drop constraint if exists waiting_list_requests_week_end_check;
alter table public.waiting_list_requests
    drop constraint if exists waiting_list_requests_check;

update public.waiting_list_requests
set week_start = selected_date - extract(dow from selected_date)::integer,
    week_end = selected_date - extract(dow from selected_date)::integer + 6,
    expires_at = (selected_date - extract(dow from selected_date)::integer + 7)::timestamp at time zone 'America/Sao_Paulo',
    updated_at = now()
where selected_date is not null;

alter table public.waiting_list_requests
    add constraint waiting_list_requests_week_end_full_week_check check (week_end = week_start + 6);

create or replace function public.waitlist_week_start(p_selected_date date)
returns date
language sql immutable strict
as $$
    select p_selected_date - extract(dow from p_selected_date)::integer;
$$;

create or replace function public.create_my_waitlist_request(p_service_id bigint, p_selected_date date)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
    v_user_id uuid := auth.uid(); v_client_id uuid; v_service public.services%rowtype;
    v_week_start date; v_week_end date; v_request public.waiting_list_requests;
begin
    if v_user_id is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
    select cp.id into v_client_id from public.client_profiles cp where cp.user_id = v_user_id limit 1;
    if v_client_id is null then raise exception 'Perfil de cliente não encontrado.' using errcode = '42501'; end if;
    select s.* into v_service from public.services s where s.id = p_service_id and s.is_active = true;
    if not found then raise exception 'Serviço inválido ou indisponível.' using errcode = '22023'; end if;
    if p_selected_date is null then raise exception 'Data obrigatória.' using errcode = '22023'; end if;
    if p_selected_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data selecionada já passou.' using errcode = '22023'; end if;
    v_week_start := public.waitlist_week_start(p_selected_date); v_week_end := v_week_start + 6;
    insert into public.waiting_list_requests (client_id, service_id, service_name_snapshot, selected_date, week_start, week_end, source, status, expires_at)
    values (v_client_id, v_service.id, v_service.name, p_selected_date, v_week_start, v_week_end, 'client', 'active', (v_week_end + 1)::timestamp at time zone 'America/Sao_Paulo')
    returning * into v_request;
    return v_request;
exception when unique_violation then
    raise exception 'Já existe uma solicitação ativa para este serviço e semana.' using errcode = '23505';
end;
$$;

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
    if p_selected_date is null then raise exception 'Data obrigatória.' using errcode = '22023'; end if;
    if p_selected_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data selecionada já passou.' using errcode = '22023'; end if;
    v_week_start := public.waitlist_week_start(p_selected_date); v_week_end := v_week_start + 6;
    insert into public.waiting_list_requests (client_id, service_id, service_name_snapshot, selected_date, week_start, week_end, source, status, expires_at)
    values (p_client_id, v_service.id, v_service.name, p_selected_date, v_week_start, v_week_end, 'admin', 'active', (v_week_end + 1)::timestamp at time zone 'America/Sao_Paulo')
    returning * into v_request;
    return v_request;
exception when unique_violation then
    raise exception 'Já existe uma solicitação ativa para este serviço e semana.' using errcode = '23505';
end;
$$;

commit;
