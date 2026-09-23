create or replace function public.capture_waitlist_released_slot()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_released boolean := false;
  v_duration integer;
  v_service_id bigint;
  v_service_name text;
  v_swap boolean := current_setting('app.admin_swap_appointments', true) = 'on';
begin
  if tg_op = 'UPDATE' then
    v_released := coalesce(old.status, '') not in ('cancelled','canceled','cancelado','no_show','no-show')
      and (coalesce(new.status, '') in ('cancelled','canceled','cancelado','no_show','no-show')
        or old.appointment_date is distinct from new.appointment_date
        or old.start_time is distinct from new.start_time);
    if v_released and not v_swap then
      v_duration := coalesce(old.duration_minutes, 0);
      v_service_name := old.service_name;
      select s.id into v_service_id from public.services s where s.name = v_service_name order by s.is_active desc, s.id limit 1;
      if v_service_id is not null and public.waitlist_released_slot_is_eligible(old.appointment_date, old.start_time, v_duration, old.id) then
        insert into public.waitlist_opportunities(source_appointment_id, release_event_version, service_id, service_name_snapshot, appointment_date, start_time, duration_minutes, status, expires_at)
        values(old.id, new.waitlist_release_version, v_service_id, v_service_name, old.appointment_date, old.start_time, v_duration, 'open', (old.appointment_date::timestamp + old.start_time) at time zone 'America/Sao_Paulo')
        on conflict(source_appointment_id, release_event_version) do nothing;
      end if;
    end if;
    if coalesce(new.status, '') not in ('cancelled','canceled','cancelado','no_show','no-show') then
      update public.waitlist_opportunities o set status = 'cancelled', updated_at = now()
      where o.status = 'open' and o.appointment_date = new.appointment_date
        and o.start_time < new.start_time + make_interval(mins => greatest(coalesce(new.duration_minutes, 0), 1))
        and o.start_time + make_interval(mins => greatest(o.duration_minutes, 1)) > new.start_time;
    end if;
  elsif tg_op = 'INSERT' and coalesce(new.status, '') not in ('cancelled','canceled','cancelado','no_show','no-show') then
    update public.waitlist_opportunities o set status = 'cancelled', updated_at = now()
    where o.status = 'open' and o.appointment_date = new.appointment_date
      and o.start_time < new.start_time + make_interval(mins => greatest(coalesce(new.duration_minutes, 0), 1))
      and o.start_time + make_interval(mins => greatest(o.duration_minutes, 1)) > new.start_time;
  end if;
  return new;
end;
$$;

create or replace function public.admin_swap_appointments(p_first_appointment_id uuid, p_second_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $$
declare
  a public.appointments%rowtype;
  b public.appointments%rowtype;
  v_now timestamp := timezone('America/Sao_Paulo', now());
  v_duration_a integer;
  v_duration_b integer;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem trocar horários.' using errcode = '42501'; end if;
  if p_first_appointment_id is null or p_second_appointment_id is null or p_first_appointment_id = p_second_appointment_id then raise exception 'Selecione dois agendamentos diferentes.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('admin-appointment-swap:' || least(p_first_appointment_id::text, p_second_appointment_id::text) || ':' || greatest(p_first_appointment_id::text, p_second_appointment_id::text), 0));
  lock table public.schedule_blocks in share mode;
  select * into a from public.appointments where id = p_first_appointment_id for update;
  select * into b from public.appointments where id = p_second_appointment_id for update;
  if a.id is null or b.id is null then raise exception 'Um dos agendamentos não foi encontrado.'; end if;
  if a.client_id is null or b.client_id is null or a.client_id = b.client_id then raise exception 'Os agendamentos precisam pertencer a clientes diferentes.'; end if;
  if a.status not in ('pending','confirmed') or b.status not in ('pending','confirmed') then raise exception 'Somente agendamentos pendentes ou confirmados podem ser trocados.'; end if;
  if (a.appointment_date::timestamp + a.start_time) <= v_now or (b.appointment_date::timestamp + b.start_time) <= v_now then raise exception 'Somente horários futuros podem ser trocados.'; end if;
  if a.appointment_date = b.appointment_date and a.start_time = b.start_time then raise exception 'Os agendamentos já estão no mesmo horário.'; end if;
  v_duration_a := case when btrim(a.service_name) = 'Reparo de Unha (Unitário)' then 30 else greatest(coalesce(a.duration_minutes, 0), 1) end;
  v_duration_b := case when btrim(b.service_name) = 'Reparo de Unha (Unitário)' then 30 else greatest(coalesce(b.duration_minutes, 0), 1) end;
  if exists (select 1 from public.schedule_blocks sb where sb.block_date = b.appointment_date and b.start_time < sb.end_time and b.start_time + make_interval(mins=>v_duration_a) > sb.start_time) then raise exception 'O novo horário de % está bloqueado.', b.client_name; end if;
  if exists (select 1 from public.schedule_blocks sb where sb.block_date = a.appointment_date and a.start_time < sb.end_time and a.start_time + make_interval(mins=>v_duration_b) > sb.start_time) then raise exception 'O novo horário de % está bloqueado.', a.client_name; end if;
  if exists (select 1 from public.appointments o where o.id not in (a.id,b.id) and o.status not in ('cancelled','canceled','cancelado','no_show','no-show') and o.appointment_date = b.appointment_date and b.start_time < o.start_time + make_interval(mins=>greatest(coalesce(o.duration_minutes,0),1)) and o.start_time < b.start_time + make_interval(mins=>v_duration_a)) then raise exception 'O novo horário de % conflita com outro atendimento.', a.client_name; end if;
  if exists (select 1 from public.appointments o where o.id not in (a.id,b.id) and o.status not in ('cancelled','canceled','cancelado','no_show','no-show') and o.appointment_date = a.appointment_date and a.start_time < o.start_time + make_interval(mins=>greatest(coalesce(o.duration_minutes,0),1)) and o.start_time < a.start_time + make_interval(mins=>v_duration_b)) then raise exception 'O novo horário de % conflita com outro atendimento.', b.client_name; end if;
  perform set_config('app.admin_swap_appointments', 'on', true);
  update public.appointments set appointment_date = b.appointment_date, start_time = b.start_time where id = a.id;
  update public.appointments set appointment_date = a.appointment_date, start_time = a.start_time where id = b.id;
  return jsonb_build_object('first_appointment_id', a.id, 'second_appointment_id', b.id, 'first_new_date', b.appointment_date, 'first_new_time', b.start_time, 'second_new_date', a.appointment_date, 'second_new_time', a.start_time);
end;
$$;

revoke all on function public.admin_swap_appointments(uuid, uuid) from public, anon;
grant execute on function public.admin_swap_appointments(uuid, uuid) to authenticated;
