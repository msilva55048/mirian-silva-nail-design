-- Inícios dinâmicos pelo término de qualquer serviço; âncoras e datas preservadas.
begin;
create or replace function public.client_booking_start_allowed(
    p_date date,
    p_start_time time without time zone,
    p_service_name text,
    p_service_duration integer,
    p_excluded_appointment_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
v_start_minutes integer;
    v_agenda_duration integer;
    v_is_fixed boolean := false;
    v_is_reachable boolean := false;
    v_next_fixed_minutes integer;
begin
    if p_date is null
       or p_start_time is null
       or p_service_name is null
       or btrim(p_service_name) = ''
       or p_service_duration is null
       or p_service_duration <= 0 then
        return false;
end if;

    -- Fechamentos públicos prevalecem sobre overrides e encaixes.
    if p_date between date '2026-10-21' and date '2026-10-26'
       or (p_date >= date '2026-11-01' and extract(isodow from p_date) = 7) then
        return false;
    end if;

    if extract(second from p_start_time) <> 0 then
        return false;
end if;

    v_start_minutes := extract(hour from p_start_time)::integer * 60
                     + extract(minute from p_start_time)::integer;

    -- A duração exibida do Reparo continua sendo a duração real do serviço,
    -- mas para ocupação/encaixe ele consome um bloco de 30 minutos.
    v_agenda_duration := greatest(30, p_service_duration);

with recursive
    base_starts(start_minutes) as (
        select unnest(public.client_booking_base_start_minutes(p_date)) as start_minutes
    ),
    removed_starts(start_minutes) as (
        select distinct
            extract(hour from sto.start_time)::integer * 60
             + extract(minute from sto.start_time)::integer
        from public.schedule_time_overrides sto
        where sto.override_date = p_date
          and sto.is_available = false
    ),
    added_starts(start_minutes) as (
        select distinct
            extract(hour from sto.start_time)::integer * 60
             + extract(minute from sto.start_time)::integer
        from public.schedule_time_overrides sto
        where sto.override_date = p_date
          and sto.is_available = true
    ),
    fixed_candidates(start_minutes) as (
        select start_minutes from base_starts
        union
        select start_minutes from added_starts
    ),
    fixed_starts(start_minutes) as (
        select fc.start_minutes
        from fixed_candidates fc
        where not exists (
            select 1
            from removed_starts rs
            where rs.start_minutes = fc.start_minutes
        )
    ),
    appointment_ends as (
        select extract(hour from a.start_time)::integer * 60 + extract(minute from a.start_time)::integer as start_minutes,
               greatest(30, a.duration_minutes) as agenda_duration
        from public.appointments a
        where a.appointment_date = p_date
          and (p_excluded_appointment_id is null or a.id <> p_excluded_appointment_id)
          and coalesce(a.status, '') not in ('cancelled', 'canceled', 'cancelado', 'no_show', 'no-show')
          and a.duration_minutes > 0
    ),
    reachable_starts(start_minutes) as (
        select start_minutes from fixed_starts
        union
        select rs.start_minutes + a.agenda_duration
        from reachable_starts rs
        join appointment_ends a on a.start_minutes = rs.start_minutes
        where rs.start_minutes + a.agenda_duration <= 1170
          and (rs.start_minutes + a.agenda_duration <> 1170
               or (select max(start_minutes) from fixed_starts) = 1140)
          and not exists (select 1 from removed_starts rem where rem.start_minutes = rs.start_minutes + a.agenda_duration)
          and (
              (exists (select 1 from fixed_starts fs where fs.start_minutes > rs.start_minutes)
               and (exists (select 1 from fixed_starts fs where fs.start_minutes = rs.start_minutes)
                    or rs.start_minutes + a.agenda_duration <= (select min(fs.start_minutes) from fixed_starts fs where fs.start_minutes > rs.start_minutes)))
              or (not exists (select 1 from fixed_starts fs where fs.start_minutes > rs.start_minutes)
                  and rs.start_minutes = 1140 and rs.start_minutes + a.agenda_duration = 1170)
          )
    )
select
    exists (
        select 1 from fixed_starts fs
        where fs.start_minutes = v_start_minutes
    ),
    exists (
        select 1 from reachable_starts rs
        where rs.start_minutes = v_start_minutes
    ),
    (
        select min(fs.start_minutes)
        from fixed_starts fs
        where fs.start_minutes > v_start_minutes
    )
into v_is_fixed, v_is_reachable, v_next_fixed_minutes;

-- Horário fixo/âncora aceita normalmente qualquer serviço;
-- os conflitos reais ainda são validados pelas funções de criar/reagendar.
if v_is_fixed then
        return true;
end if;

    -- Se não é fixo nem foi alcançado por uma cadeia válida de agendamentos, rejeita.
    if not v_is_reachable then
        return false;
end if;

    -- Horário gerado entre duas âncoras: o serviço precisa caber inteiro
    -- antes da próxima âncora fixa.
    if v_next_fixed_minutes is not null then
        return v_start_minutes + v_agenda_duration <= v_next_fixed_minutes;
end if;

    -- Exceção final: 19:30 é o último horário gerado e, sem nova âncora depois,
    -- aceita qualquer duração. Nada gera 20:00.
return v_start_minutes = 1170;
end;
$function$;

revoke all on function public.client_booking_start_allowed(
    date,
    time without time zone,
    text,
    integer,
    uuid
    ) from public;



commit;
