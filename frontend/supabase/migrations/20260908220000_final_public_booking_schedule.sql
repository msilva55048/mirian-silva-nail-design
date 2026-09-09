-- Correção aditiva; não modifica migrations anteriores.
-- create_my_appointment e reschedule_my_appointment já chamam client_booking_start_allowed.
-- A substituição do helper corrige ambas sem substituir validações, locks ou permissões das RPCs.
begin;
create or replace function public.client_booking_base_start_minutes(p_date date)
returns integer[] language sql immutable set search_path = public, pg_temp
as $$
    select case
        when p_date is null then array[]::integer[]
        when p_date between date '2026-10-21' and date '2026-10-26' then array[]::integer[]
        when p_date >= date '2026-11-01' and extract(isodow from p_date) = 7 then array[]::integer[]
        when extract(isodow from p_date) in (6,7) then array[420,540,660,780]
        when p_date <= date '2026-10-20' then array[420,1170,1260]
        else array[420,540,660,780,1020,1140]
    end;
$$;
revoke all on function public.client_booking_base_start_minutes(date) from public;

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
    v_agenda_duration := case
        when btrim(p_service_name) = 'Reparo de Unha (Unitário)' then 30
        else p_service_duration
end;

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
    reachable_starts(start_minutes) as (
        select fs.start_minutes
        from fixed_starts fs

        union

        select rs.start_minutes + 30
        from reachable_starts rs
        where rs.start_minutes + 30 <= 1170 -- 19:30 é o último horário gerável.
          and (rs.start_minutes + 30 <> 1170
               or (select max(last_anchor.start_minutes) from fixed_starts last_anchor) = 1140)
          and exists (
            select 1
            from public.appointments a
            where a.appointment_date = p_date
              and (p_excluded_appointment_id is null or a.id <> p_excluded_appointment_id)
              and coalesce(a.status, '') not in (
                                                 'cancelled', 'canceled', 'cancelado', 'no_show', 'no-show'
                )
              and btrim(coalesce(a.service_name, '')) = 'Reparo de Unha (Unitário)'
              and (
                      extract(hour from a.start_time)::integer * 60
                    + extract(minute from a.start_time)::integer
                      ) = rs.start_minutes
        )
          and not exists (
            select 1
            from removed_starts rem
            where rem.start_minutes = rs.start_minutes + 30
        )
          and (
            (
                (select min(fs2.start_minutes)
                 from fixed_starts fs2
                 where fs2.start_minutes > rs.start_minutes) is not null
                    and rs.start_minutes + 30 <=
                        (select min(fs3.start_minutes)
                         from fixed_starts fs3
                         where fs3.start_minutes > rs.start_minutes)
                )
                or
            (
                (select min(fs4.start_minutes)
                 from fixed_starts fs4
                 where fs4.start_minutes > rs.start_minutes) is null
                    and rs.start_minutes = 1140
                    and rs.start_minutes + 30 = 1170
                )
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

    -- Se não é fixo nem foi alcançado por uma cadeia válida de Reparos, rejeita.
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
