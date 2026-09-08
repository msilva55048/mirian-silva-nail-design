-- Regra de horários públicos com encaixes gerados por Reparo.
-- Horários fixos em dias úteis: 07:00, 09:00, 11:00, 13:00, 17:00 e 19:00.
-- Fins de semana mantêm a grade atual: 07:00, 09:00, 11:00 e 13:00.
-- Horários adicionados em schedule_time_overrides (is_available=true) viram novas âncoras fixas.
-- Horários removidos em schedule_time_overrides (is_available=false) deixam de ser âncoras.
-- Reparo ocupa 30 minutos na agenda e pode gerar o próximo encaixe de +30 minutos.
-- Um serviço iniciado em horário gerado precisa terminar até a próxima âncora fixa.
-- Exceção final: 19:30, quando gerado a partir de 19:00 e sem outra âncora posterior,
-- aceita qualquer duração e nunca gera 20:00.

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
        select v.start_minutes
        from (values
                  (420),   -- 07:00
                  (540),   -- 09:00
                  (660),   -- 11:00
                  (780),   -- 13:00
                  (1020),  -- 17:00
                  (1140)   -- 19:00
             ) as v(start_minutes)
        where not (
            extract(isodow from p_date) in (6, 7)
                and v.start_minutes in (1020, 1140)
            )
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


create or replace function public.create_my_appointment(
    p_service_name text,
    p_appointment_date date,
    p_start_time time without time zone
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
v_profile public.client_profiles%rowtype;
    v_service public.services%rowtype;
    v_today date := (timezone('America/Sao_Paulo', now()))::date;
    v_duration integer;
    v_agenda_duration integer;
    v_appointment_id text;
begin
    if auth.uid() is null then
        raise exception using errcode = '42501', message = 'É necessário estar autenticada para agendar.';
end if;

    if p_service_name is null or btrim(p_service_name) = ''
        or p_appointment_date is null or p_start_time is null then
        raise exception using errcode = '22023', message = 'Serviço, data e horário são obrigatórios.';
end if;

select * into v_profile
from public.client_profiles
where user_id = auth.uid()
    limit 1;

if v_profile.id is null then
        raise exception using errcode = 'P0002', message = 'Perfil da cliente não encontrado.';
end if;

select * into v_service
from public.services
where name = btrim(p_service_name)
order by id
    limit 1;

if v_service.id is null then
        raise exception using errcode = '22023', message = 'Serviço inválido.';
end if;

    v_duration := coalesce(v_service.duration_minutes, 0);
    if v_duration <= 0 or v_duration > 1440 then
        raise exception using errcode = '22023', message = 'Duração do serviço inválida.';
end if;

    v_agenda_duration := case
        when btrim(v_service.name) = 'Reparo de Unha (Unitário)' then 30
        else v_duration
end;

    if p_appointment_date < v_today
       or ((p_appointment_date + p_start_time) at time zone 'America/Sao_Paulo') <= now() then
        raise exception using errcode = '22007', message = 'Não é possível agendar em data ou horário passado.';
end if;

    if extract(second from p_start_time) <> 0 then
        raise exception using errcode = '22007', message = 'Horário inválido.';
end if;

    -- Evita corrida entre duas clientes escolhendo o mesmo período.
    perform pg_advisory_xact_lock(
        hashtextextended('appointment-date:' || p_appointment_date::text, 0)
    );

    if not public.client_booking_start_allowed(
        p_appointment_date,
        p_start_time,
        v_service.name,
        v_duration,
        null
    ) then
        raise exception using
            errcode = '22023',
            message = 'Este horário não está disponível para o serviço selecionado.';
end if;

    if exists (
        select 1
          from public.schedule_blocks b
         where b.block_date = p_appointment_date
           and b.start_time < (p_start_time + make_interval(mins => v_agenda_duration))
           and b.end_time > p_start_time
    ) then
        raise exception using errcode = '23P01', message = 'Este horário está bloqueado.';
end if;

    if exists (
        select 1
          from public.appointments a
         where a.appointment_date = p_appointment_date
           and coalesce(a.status, '') not in (
               'cancelled', 'canceled', 'cancelado', 'no_show', 'no-show'
           )
           and a.start_time < (p_start_time + make_interval(mins => v_agenda_duration))
           and (
               a.start_time + make_interval(
                   mins => case
                       when btrim(coalesce(a.service_name, '')) = 'Reparo de Unha (Unitário)'
                           then 30
                       else coalesce(a.duration_minutes, 0)
                   end
               )
           ) > p_start_time
    ) then
        raise exception using errcode = '23P01', message = 'Este horário acabou de ser reservado por outra cliente.';
end if;

insert into public.appointments (
    client_id,
    client_name,
    client_phone,
    client_email,
    service_name,
    appointment_date,
    start_time,
    duration_minutes,
    price_cents,
    status
) values (
             v_profile.id,
             v_profile.full_name,
             v_profile.phone,
             v_profile.email,
             v_service.name,
             p_appointment_date,
             p_start_time,
             v_service.duration_minutes, -- mantém 20 min reais no cadastro do Reparo
             v_service.price_cents,
             'confirmed'
         ) returning id::text into v_appointment_id;

return v_appointment_id;
end;
$function$;


create or replace function public.reschedule_my_appointment(
    p_appointment_id uuid,
    p_new_date date,
    p_new_time time without time zone
)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
v_uid uuid := auth.uid();
    v_appointment public.appointments%rowtype;
    v_new_start timestamp;
    v_today date := timezone('America/Sao_Paulo', now())::date;
    v_duration integer;
    v_agenda_duration integer;
begin
    if v_uid is null then
        raise exception 'Usuário não autenticado.' using errcode = '42501';
end if;

    if p_new_date is null or p_new_time is null then
        raise exception 'Data e horário são obrigatórios.' using errcode = '22023';
end if;

select a.* into v_appointment
from public.appointments a
         join public.client_profiles cp on cp.id = a.client_id
where a.id = p_appointment_id
  and cp.user_id = v_uid
    for update;

if not found then
        raise exception 'Agendamento não encontrado ou não pertence à cliente autenticada.';
end if;

    if v_appointment.status not in ('pending', 'confirmed') then
        raise exception 'Este agendamento não pode mais ser alterado.';
end if;

    if extract(second from p_new_time) <> 0 then
        raise exception 'Horário inválido.' using errcode = '22007';
end if;

    v_duration := coalesce(v_appointment.duration_minutes, 0);
    if v_duration <= 0 or v_duration > 1440 then
        raise exception 'Duração do serviço inválida.' using errcode = '22023';
end if;

    v_agenda_duration := case
        when btrim(coalesce(v_appointment.service_name, '')) = 'Reparo de Unha (Unitário)' then 30
        else v_duration
end;

    v_new_start := p_new_date::timestamp + p_new_time;

    if p_new_date < v_today or v_new_start <= timezone('America/Sao_Paulo', now()) then
        raise exception 'Não é possível reagendar para uma data ou horário que já passou.';
end if;

    perform pg_advisory_xact_lock(
        hashtextextended('appointment-date:' || p_new_date::text, 0)
    );

    -- Exclui o próprio agendamento da cadeia de Reparos durante a validação,
    -- evitando que ele use o horário antigo para "criar" o novo encaixe.
    if not public.client_booking_start_allowed(
        p_new_date,
        p_new_time,
        v_appointment.service_name,
        v_duration,
        v_appointment.id
    ) then
        raise exception
            'Este horário não está disponível para o serviço selecionado.'
            using errcode = '22023';
end if;

    if exists (
        select 1
          from public.schedule_blocks sb
         where sb.block_date = p_new_date
           and sb.start_time < p_new_time + make_interval(mins => v_agenda_duration)
           and sb.end_time > p_new_time
    ) then
        raise exception 'Este horário está bloqueado na agenda.';
end if;

    if exists (
        select 1
          from public.appointments other
         where other.id <> v_appointment.id
           and coalesce(other.status, '') not in (
               'cancelled', 'canceled', 'cancelado', 'no_show', 'no-show'
           )
           and other.appointment_date = p_new_date
           and other.start_time < p_new_time + make_interval(mins => v_agenda_duration)
           and (
               other.start_time + make_interval(
                   mins => case
                       when btrim(coalesce(other.service_name, '')) = 'Reparo de Unha (Unitário)'
                           then 30
                       else coalesce(other.duration_minutes, 0)
                   end
               )
           ) > p_new_time
    ) then
        raise exception 'Este horário acabou de ficar indisponível.';
end if;

update public.appointments
set appointment_date = p_new_date,
    start_time = p_new_time
where id = v_appointment.id;
end;
$function$;
