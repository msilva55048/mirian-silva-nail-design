-- Protege novas marcações públicas sem alterar agendamentos existentes.
begin;

create or replace function public.validate_client_anchor_boundaries()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start integer;
  v_end integer;
  v_limit integer;
  v_name text;
  v_is_fixed boolean;
begin
  if auth.uid() is not null and public.is_admin() then return new; end if;

  v_start := extract(hour from new.start_time)::integer * 60 + extract(minute from new.start_time)::integer;
  v_end := v_start + greatest(30, new.duration_minutes);
  v_name := lower(btrim(new.service_name));

  select exists (
    select 1 from unnest(public.client_booking_base_start_minutes(new.appointment_date)) s
    where s = v_start
    union all
    select 1 from public.schedule_time_overrides o
    where o.override_date = new.appointment_date and o.start_time = new.start_time and o.is_available
  ) into v_is_fixed;

  if v_start = 780 then
    if v_name not like 'esmaltação%' and v_name not like 'esmaltacao%' and v_name not like 'alongamento%' then
      raise exception 'Serviço não permitido às 13:00.';
    end if;
    if v_end > 900 then raise exception 'Horário das 13:00 não pode ultrapassar 15:00.'; end if;
  elsif v_start > 780 and v_start < 1020 then
    raise exception 'Horário indisponível entre 13:30 e 16:30.';
  elsif v_start >= 1140 and v_start < 1260 then
    if v_end > 1260 then raise exception 'Horário não pode ultrapassar 21:00.'; end if;
  elsif not v_is_fixed then
    v_limit := case
      when v_start >= 420 and v_start < 540 then 540
      when v_start >= 540 and v_start < 660 then 660
      when v_start >= 660 and v_start < 780 then 780
      when v_start >= 1020 and v_start < 1140 then 1140
      else null
    end;
    if v_limit is not null and v_end > v_limit then raise exception 'Horário dinâmico ultrapassa a âncora seguinte.'; end if;
  end if;

  if exists (select 1 from public.schedule_blocks b where b.block_date = new.appointment_date and b.start_time < new.start_time + make_interval(mins => greatest(30,new.duration_minutes)) and b.end_time > new.start_time) then raise exception 'Horário bloqueado.'; end if;
  if exists (select 1 from public.appointments a where a.id <> new.id and a.appointment_date = new.appointment_date and coalesce(a.status,'') not in ('cancelled','canceled','cancelado','no_show','no-show') and a.start_time < new.start_time + make_interval(mins => greatest(30,new.duration_minutes)) and new.start_time < a.start_time + make_interval(mins => greatest(30,a.duration_minutes))) then raise exception 'Horário ocupado.'; end if;
  return new;
end;
$$;

drop trigger if exists appointments_validate_client_anchor_boundaries on public.appointments;
create trigger appointments_validate_client_anchor_boundaries
before insert or update of appointment_date, start_time, duration_minutes, service_name
on public.appointments
for each row execute function public.validate_client_anchor_boundaries();

commit;
