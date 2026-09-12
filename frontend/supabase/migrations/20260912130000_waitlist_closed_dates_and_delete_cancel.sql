-- Complemento da lista compartilhada: datas fechadas e cancelamento por remoção.
-- Migração aditiva; preserva waiting_list legada e estados fulfilled/expired.
begin;

create or replace function public.waitlist_date_is_closed(p_selected_date date)
returns boolean
language sql immutable strict
as $$
    select p_selected_date between date '2026-10-21' and date '2026-10-26';
$$;

delete from public.waiting_list_requests where status = 'cancelled';

create or replace function public.cancel_my_waitlist_request(p_request_id uuid)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_request public.waiting_list_requests;
begin
    delete from public.waiting_list_requests r
    using public.client_profiles cp
    where r.id = p_request_id and r.client_id = cp.id and cp.user_id = auth.uid() and r.status = 'active'
    returning r.* into v_request;
    if not found then raise exception 'Solicitação não encontrada ou não pertence à cliente.' using errcode = '42501'; end if;
    return v_request;
end;
$$;
revoke all on function public.cancel_my_waitlist_request(uuid) from public, anon, authenticated;
grant execute on function public.cancel_my_waitlist_request(uuid) to authenticated;

create or replace function public.admin_cancel_waitlist_request(p_request_id uuid)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_request public.waiting_list_requests;
begin
    if not public.is_admin() then raise exception 'Acesso restrito ao Admin.' using errcode = '42501'; end if;
    delete from public.waiting_list_requests
    where id = p_request_id and status = 'active'
    returning * into v_request;
    if not found then raise exception 'Solicitação ativa não encontrada.' using errcode = 'P0002'; end if;
    return v_request;
end;
$$;
revoke all on function public.admin_cancel_waitlist_request(uuid) from public, anon, authenticated;
grant execute on function public.admin_cancel_waitlist_request(uuid) to authenticated;

-- Rejeição server-side das datas explicitamente fechadas, para cliente e Admin.
create or replace function public.create_my_waitlist_request(p_service_id bigint, p_selected_date date)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_user_id uuid := auth.uid(); v_client_id uuid; v_service public.services%rowtype; v_week_start date; v_week_end date; v_request public.waiting_list_requests;
begin
    if v_user_id is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
    select cp.id into v_client_id from public.client_profiles cp where cp.user_id = v_user_id limit 1;
    if v_client_id is null then raise exception 'Perfil de cliente não encontrado.' using errcode = '42501'; end if;
    if p_selected_date is null or public.waitlist_date_is_closed(p_selected_date) then raise exception 'Esta data está fechada para a lista de espera.' using errcode = '22023'; end if;
    select s.* into v_service from public.services s where s.id = p_service_id and s.is_active = true;
    if not found then raise exception 'Serviço inválido ou indisponível.' using errcode = '22023'; end if;
    if p_selected_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data selecionada já passou.' using errcode = '22023'; end if;
    v_week_start := public.waitlist_week_start(p_selected_date); v_week_end := v_week_start + 6;
    insert into public.waiting_list_requests (client_id, service_id, service_name_snapshot, selected_date, week_start, week_end, source, status, expires_at)
    values (v_client_id, v_service.id, v_service.name, p_selected_date, v_week_start, v_week_end, 'client', 'active', (v_week_end + 1)::timestamp at time zone 'America/Sao_Paulo') returning * into v_request;
    return v_request;
exception when unique_violation then raise exception 'Já existe uma solicitação ativa para este serviço e semana.' using errcode = '23505';
end;
$$;
revoke all on function public.create_my_waitlist_request(bigint, date) from public, anon, authenticated;
grant execute on function public.create_my_waitlist_request(bigint, date) to authenticated;

create or replace function public.admin_create_waitlist_request(p_client_id uuid, p_service_id bigint, p_selected_date date)
returns public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_service public.services%rowtype; v_week_start date; v_week_end date; v_request public.waiting_list_requests;
begin
    if not public.is_admin() then raise exception 'Acesso restrito ao Admin.' using errcode = '42501'; end if;
    if p_selected_date is null or public.waitlist_date_is_closed(p_selected_date) then raise exception 'Esta data está fechada para a lista de espera.' using errcode = '22023'; end if;
    if not exists (select 1 from public.client_profiles where id = p_client_id) then raise exception 'Cliente não encontrada.' using errcode = '22023'; end if;
    select s.* into v_service from public.services s where s.id = p_service_id and s.is_active = true;
    if not found then raise exception 'Serviço inválido ou indisponível.' using errcode = '22023'; end if;
    if p_selected_date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data selecionada já passou.' using errcode = '22023'; end if;
    v_week_start := public.waitlist_week_start(p_selected_date); v_week_end := v_week_start + 6;
    insert into public.waiting_list_requests (client_id, service_id, service_name_snapshot, selected_date, week_start, week_end, source, status, expires_at)
    values (p_client_id, v_service.id, v_service.name, p_selected_date, v_week_start, v_week_end, 'admin', 'active', (v_week_end + 1)::timestamp at time zone 'America/Sao_Paulo') returning * into v_request;
    return v_request;
exception when unique_violation then raise exception 'Já existe uma solicitação ativa para este serviço e semana.' using errcode = '23505';
end;
$$;
revoke all on function public.admin_create_waitlist_request(uuid, bigint, date) from public, anon, authenticated;
grant execute on function public.admin_create_waitlist_request(uuid, bigint, date) to authenticated;

commit;
