-- Limita somente os inícios públicos da Cliente; o bypass administrativo permanece intacto.
begin;

create or replace function public.client_booking_start_allowed(
    p_date date, p_start_time time without time zone, p_service_name text,
    p_service_duration integer, p_excluded_appointment_id uuid default null
)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_start_minutes integer; v_agenda_duration integer; v_is_fixed boolean := false; v_is_reachable boolean := false; v_next_fixed_minutes integer; v_last_public_start integer;
begin
    if p_date is null or p_start_time is null or p_service_name is null or btrim(p_service_name) = '' or p_service_duration is null or p_service_duration <= 0 then return false; end if;
    if p_date between date '2026-10-21' and date '2026-10-26' or (p_date >= date '2026-11-01' and extract(isodow from p_date) = 7) then return false; end if;
    if extract(second from p_start_time) <> 0 then return false; end if;
    v_start_minutes := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
    v_last_public_start := case when extract(isodow from p_date) = 6 then 780 else 1140 end;
    if v_start_minutes > v_last_public_start then return false; end if;
    if v_start_minutes = 780 and lower(btrim(p_service_name)) not like 'esmaltação%' and lower(btrim(p_service_name)) not like 'esmaltacao%' and lower(btrim(p_service_name)) not like 'alongamento%' then return false; end if;
    v_agenda_duration := greatest(30, p_service_duration);
    if v_start_minutes = 780 and v_start_minutes + v_agenda_duration > 900 then return false; end if;

    with recursive base_starts(start_minutes) as (select unnest(public.client_booking_base_start_minutes(p_date))),
    removed_starts(start_minutes) as (select distinct extract(hour from o.start_time)::integer * 60 + extract(minute from o.start_time)::integer from public.schedule_time_overrides o where o.override_date = p_date and not o.is_available),
    added_starts(start_minutes) as (select distinct extract(hour from o.start_time)::integer * 60 + extract(minute from o.start_time)::integer from public.schedule_time_overrides o where o.override_date = p_date and o.is_available and extract(hour from o.start_time)::integer * 60 + extract(minute from o.start_time)::integer <= v_last_public_start),
    fixed_starts(start_minutes) as (select b.start_minutes from base_starts b where not exists (select 1 from removed_starts r where r.start_minutes=b.start_minutes) union select a.start_minutes from added_starts a where not exists (select 1 from removed_starts r where r.start_minutes=a.start_minutes)),
    appointment_ends(start_minutes, agenda_duration) as (select extract(hour from a.start_time)::integer * 60 + extract(minute from a.start_time)::integer, greatest(30,a.duration_minutes) from public.appointments a where a.appointment_date=p_date and (p_excluded_appointment_id is null or a.id <> p_excluded_appointment_id) and coalesce(a.status,'') not in ('cancelled','canceled','cancelado','no_show','no-show') and a.duration_minutes > 0),
    reachable_starts(start_minutes) as (
        select start_minutes from fixed_starts
        union
        select r.start_minutes + a.agenda_duration from reachable_starts r join appointment_ends a on a.start_minutes=r.start_minutes
        where r.start_minutes + a.agenda_duration <= v_last_public_start
          and not exists (select 1 from removed_starts x where x.start_minutes=r.start_minutes+a.agenda_duration)
          and exists (select 1 from fixed_starts f where f.start_minutes > r.start_minutes)
          and (exists (select 1 from fixed_starts f where f.start_minutes=r.start_minutes) or r.start_minutes+a.agenda_duration <= (select min(f.start_minutes) from fixed_starts f where f.start_minutes > r.start_minutes))
    )
    select exists(select 1 from fixed_starts f where f.start_minutes=v_start_minutes), exists(select 1 from reachable_starts r where r.start_minutes=v_start_minutes), (select min(f.start_minutes) from fixed_starts f where f.start_minutes>v_start_minutes) into v_is_fixed,v_is_reachable,v_next_fixed_minutes;
    if v_is_fixed then return true; end if;
    if not v_is_reachable then return false; end if;
    return v_next_fixed_minutes is not null and v_start_minutes + v_agenda_duration <= v_next_fixed_minutes;
end;
$function$;
revoke all on function public.client_booking_start_allowed(date,time without time zone,text,integer,uuid) from public, anon, authenticated;
grant execute on function public.client_booking_start_allowed(date,time without time zone,text,integer,uuid) to authenticated, service_role;

create or replace function public.validate_client_anchor_boundaries()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_start integer; v_end integer; v_name text; v_is_fixed boolean;
begin
    if auth.uid() is not null and public.is_admin() then return new; end if;
    v_start := extract(hour from new.start_time)::integer * 60 + extract(minute from new.start_time)::integer; v_end := v_start + greatest(30,new.duration_minutes); v_name := lower(btrim(new.service_name));
    if v_start > (case when extract(isodow from new.appointment_date)=6 then 780 else 1140 end) then raise exception 'Horário posterior ao limite público da Cliente.'; end if;
    select exists(select 1 from unnest(public.client_booking_base_start_minutes(new.appointment_date)) s where s=v_start union all select 1 from public.schedule_time_overrides o where o.override_date=new.appointment_date and o.start_time=new.start_time and o.is_available and v_start <= case when extract(isodow from new.appointment_date)=6 then 780 else 1140 end) into v_is_fixed;
    if v_start=780 then if v_name not like 'esmaltação%' and v_name not like 'esmaltacao%' and v_name not like 'alongamento%' then raise exception 'Serviço não permitido às 13:00.'; end if; if v_end>900 then raise exception 'Horário das 13:00 não pode ultrapassar 15:00.'; end if;
    elsif v_start>780 and v_start<1020 then raise exception 'Horário indisponível entre 13:30 e 16:30.';
    elsif not v_is_fixed and v_start<1140 and not public.client_booking_start_allowed(new.appointment_date,new.start_time,new.service_name,new.duration_minutes,new.id) then raise exception 'Horário dinâmico inválido.';
    end if;
    if exists(select 1 from public.schedule_blocks b where b.block_date=new.appointment_date and b.start_time < new.start_time+make_interval(mins=>greatest(30,new.duration_minutes)) and b.end_time>new.start_time) then raise exception 'Horário bloqueado.'; end if;
    if exists(select 1 from public.appointments a where a.id<>new.id and a.appointment_date=new.appointment_date and coalesce(a.status,'') not in ('cancelled','canceled','cancelado','no_show','no-show') and a.start_time<new.start_time+make_interval(mins=>greatest(30,new.duration_minutes)) and new.start_time<a.start_time+make_interval(mins=>greatest(30,a.duration_minutes))) then raise exception 'Horário ocupado.'; end if;
    return new;
end;
$function$;
drop trigger if exists appointments_validate_client_anchor_boundaries on public.appointments;
create trigger appointments_validate_client_anchor_boundaries before insert or update of appointment_date,start_time,duration_minutes,service_name on public.appointments for each row execute function public.validate_client_anchor_boundaries();
commit;
