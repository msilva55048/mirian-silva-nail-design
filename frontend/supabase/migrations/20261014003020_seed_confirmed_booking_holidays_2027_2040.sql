begin;

-- Catálogo legal da implantação: feriados nacionais, estaduais e municipais
-- confirmados para São José/SC.
create table if not exists public.booking_holidays (
    holiday_date date primary key,
    holiday_name text not null,
    scope text not null check (scope in ('Nacional', 'Estadual - Santa Catarina', 'Municipal - São José/SC')),
    legal_basis text not null
);

alter table public.booking_holidays enable row level security;

with years as (
    select generate_series(2027, 2040)::integer as year
),
fixed_holidays(month_day, holiday_name, scope, legal_basis) as (
    values
        ('01-01', 'Confraternização Universal', 'Nacional', 'Lei 662/1949, com alterações da Lei 10.607/2002'),
        ('04-21', 'Tiradentes', 'Nacional', 'Lei 662/1949, com alterações da Lei 10.607/2002'),
        ('05-01', 'Dia Mundial do Trabalho', 'Nacional', 'Lei 662/1949, com alterações da Lei 10.607/2002'),
        ('09-07', 'Independência do Brasil', 'Nacional', 'Lei 662/1949, com alterações da Lei 10.607/2002'),
        ('10-12', 'Nossa Senhora Aparecida', 'Nacional', 'Lei 6.802/1980'),
        ('11-02', 'Finados', 'Nacional', 'Lei 662/1949, com alterações da Lei 10.607/2002'),
        ('11-15', 'Proclamação da República', 'Nacional', 'Lei 662/1949, com alterações da Lei 10.607/2002'),
        ('11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'Nacional', 'Lei 14.759/2023'),
        ('12-25', 'Natal', 'Nacional', 'Lei 662/1949, com alterações da Lei 10.607/2002')
), easter_a as (
    select year, year % 19 as a, year / 100 as b, year % 100 as c from years
), easter_b as (
    select *, b / 4 as d, b % 4 as e,
           (b + 8) / 25 as f from easter_a
), easter_c as (
    select *, (b - f + 1) / 3 as g, c / 4 as i, c % 4 as k from easter_b
), easter_d as (
    select *, (19 * a + b - d - g + 15) % 30 as h from easter_c
), easter_e as (
    select *, (32 + 2 * e + 2 * i - h - k) % 7 as l from easter_d
), easter_f as (
    select *, (a + 11 * h + 22 * l) / 451 as m from easter_e
), easter_sundays as (
    select year, make_date(year, (h + l - 7 * m + 114) / 31,
                           ((h + l - 7 * m + 114) % 31) + 1) as easter_date
    from easter_f
), holidays as (
    select make_date(y.year, split_part(f.month_day, '-', 1)::integer, split_part(f.month_day, '-', 2)::integer),
           f.holiday_name, f.scope, f.legal_basis
    from years y cross join fixed_holidays f
    union all
    select make_date(y.year, 8, 11) + case
               when extract(isodow from make_date(y.year, 8, 11)) between 1 and 6
                   then (7 - extract(isodow from make_date(y.year, 8, 11))::integer)
               else 0
           end,
           'Dia do Estado de Santa Catarina (Data Magna)',
           'Estadual - Santa Catarina',
           'Lei estadual 18.531/2022, Anexo Único (Lei 12.906/2004 e Lei 13.408/2005)'
    from years y
    union all
    select make_date(y.year, 3, 19),
           'Aniversário de São José (Dia de São José)',
           'Municipal - São José/SC',
           'Lei municipal 17/1950; feriado religioso conforme Lei municipal 1.650/1985, com redação da Lei 2.302/1991'
    from years y
    union all
    select e.easter_date - 2,
           'Sexta-feira da Paixão',
           'Municipal - São José/SC',
           'Lei federal 9.093/1995, art. 2º; Lei municipal 1.650/1985, com redação da Lei 2.302/1991'
    from easter_sundays e
    union all
    select e.easter_date + 60,
           'Corpus Christi',
           'Municipal - São José/SC',
           'Lei municipal 1.650/1985, com redação da Lei 2.302/1991; Decretos municipais 20.828/2024 e 23.649/2025'
    from easter_sundays e
)
insert into public.booking_holidays (holiday_date, holiday_name, scope, legal_basis)
select * from holidays
on conflict (holiday_date) do nothing;

-- Exclusões explícitas impedem qualquer reexecução futura da semeadura de
-- restaurar um intervalo que Mirian removeu pelo gerenciador existente.
create table if not exists public.booking_holiday_block_exceptions (
    holiday_date date not null references public.booking_holidays(holiday_date),
    start_time time without time zone not null,
    end_time time without time zone not null,
    deleted_at timestamptz not null default now(),
    deleted_by uuid,
    primary key (holiday_date, start_time, end_time),
    check (end_time > start_time)
);
alter table public.booking_holiday_block_exceptions enable row level security;

create or replace function public.record_deleted_booking_holiday_block()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
    if old.reason like 'Feriado automático %' then
        insert into public.booking_holiday_block_exceptions (holiday_date, start_time, end_time, deleted_by)
        values (old.block_date, old.start_time, old.end_time, auth.uid())
        on conflict (holiday_date, start_time, end_time) do nothing;
    end if;
    return old;
end;
$$;
drop trigger if exists schedule_blocks_record_holiday_exception on public.schedule_blocks;
create trigger schedule_blocks_record_holiday_exception
after delete on public.schedule_blocks
for each row execute function public.record_deleted_booking_holiday_block();

-- Remove apenas faixas automáticas de domingo deixadas por versões anteriores
-- desta migration. A trigger acima preserva cada remoção como exceção; bloqueios
-- manuais e agendamentos existentes não são modificados.
delete from public.schedule_blocks b
using public.booking_holidays h
where b.block_date = h.holiday_date
  and extract(isodow from h.holiday_date) = 7
  and b.reason like 'Feriado automático %';

create or replace function public.is_public_booking_holiday(p_date date)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
    select exists (select 1 from public.booking_holidays h where h.holiday_date = p_date);
$$;
revoke all on function public.is_public_booking_holiday(date) from public;
grant execute on function public.is_public_booking_holiday(date) to anon, authenticated, service_role;

create or replace function public.client_booking_base_start_minutes(p_date date)
returns integer[] language sql stable set search_path = public, pg_temp
as $$
    select case
        when p_date is null then array[]::integer[]
        when p_date between date '2026-10-21' and date '2026-10-26' then array[]::integer[]
        when p_date >= date '2026-11-01' and extract(isodow from p_date) = 7 then array[]::integer[]
        when extract(isodow from p_date) in (6,7) then array[420,540,660,780]
        when p_date < date '2026-10-02' then array[420,1170,1260]
        else array[420,540,660,780,1020,1140]
    end;
$$;
revoke all on function public.client_booking_base_start_minutes(date) from public;

-- Domingos permanecem fechados para clientes mesmo quando constem no catálogo
-- de feriados; a disponibilidade administrativa usa sua própria grade e RPC.
do $$
declare
    v_definition text;
    v_old text := 'if p_date between date ''2026-10-21'' and date ''2026-10-26'' or (p_date >= date ''2026-11-01'' and extract(isodow from p_date) = 7) then return false; end if;';
    v_holiday_exception text := 'if p_date between date ''2026-10-21'' and date ''2026-10-26'' or (p_date >= date ''2026-11-01'' and extract(isodow from p_date) = 7 and not public.is_public_booking_holiday(p_date)) then return false; end if;';
begin
    v_definition := pg_get_functiondef('public.client_booking_start_allowed(date,time without time zone,text,integer,uuid)'::regprocedure);
    if position(v_old in v_definition) = 0 and position(v_holiday_exception in v_definition) = 0 then
        raise exception 'Não foi possível localizar a regra de domingo esperada em client_booking_start_allowed.';
    end if;
    if position(v_holiday_exception in v_definition) > 0 then
        execute replace(v_definition, v_holiday_exception, v_old);
    end if;
end;
$$;

-- Defesa adicional para INSERT/UPDATE direto via API: cliente nunca agenda
-- domingo; a autorização ADM já existente mantém a grade administrativa.
create or replace function public.reject_public_sunday_appointments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is not null and public.is_mirian_admin() then
        return new;
    end if;
    if new.appointment_date >= date '2026-11-01'
       and extract(isodow from new.appointment_date) = 7 then
        raise exception 'Agendamentos públicos não são permitidos aos domingos.'
            using errcode = 'P0001';
    end if;
    return new;
end;
$$;
revoke all on function public.reject_public_sunday_appointments() from public, anon, authenticated;
drop trigger if exists appointments_reject_public_sunday on public.appointments;
create trigger appointments_reject_public_sunday
before insert or update of appointment_date, start_time on public.appointments
for each row execute function public.reject_public_sunday_appointments();

-- Preenche cada janela-base como blocos separados e removíveis, preservando
-- bloqueios manuais existentes (inclusive parciais) e cobrindo a janela toda.
with target_bands as (
    select h.holiday_date, h.holiday_name, h.scope, h.legal_basis,
           b.start_time, b.end_time
    from public.booking_holidays h
    cross join lateral (
        select * from (values
            (time '07:00', time '09:00'), (time '09:00', time '11:00'),
            (time '11:00', time '13:00'), (time '13:00', time '17:00'),
            (time '17:00', time '19:00'), (time '19:00', time '21:00')
        ) as weekday_bands(start_time, end_time)
        where extract(isodow from h.holiday_date) between 1 and 5
        union all
        select * from (values
            (time '07:00', time '09:00'), (time '09:00', time '11:00'),
            (time '11:00', time '13:00'), (time '13:00', time '15:00')
        ) as weekend_bands(start_time, end_time)
        where extract(isodow from h.holiday_date) = 6
    ) b
), boundaries as (
    select holiday_date, holiday_name, scope, legal_basis, start_time as boundary_time
    from target_bands
    union
    select t.holiday_date, t.holiday_name, t.scope, t.legal_basis, s.start_time
    from target_bands t join public.schedule_blocks s
      on s.block_date = t.holiday_date and s.start_time < t.end_time and s.end_time > t.start_time
    where s.start_time > t.start_time and s.start_time < t.end_time
    union
    select t.holiday_date, t.holiday_name, t.scope, t.legal_basis, s.end_time
    from target_bands t join public.schedule_blocks s
      on s.block_date = t.holiday_date and s.start_time < t.end_time and s.end_time > t.start_time
    where s.end_time > t.start_time and s.end_time < t.end_time
    union
    select holiday_date, holiday_name, scope, legal_basis, end_time
    from target_bands
), segments as (
    select holiday_date, holiday_name, scope, legal_basis,
           boundary_time as start_time,
           lead(boundary_time) over (
               partition by holiday_date, start_time, end_time
               order by boundary_time
           ) as end_time
    from (
        select distinct b.holiday_date, b.holiday_name, b.scope, b.legal_basis,
               b.start_time, b.end_time, x.boundary_time
        from target_bands b
        join boundaries x using (holiday_date, holiday_name, scope, legal_basis)
        where x.boundary_time between b.start_time and b.end_time
    ) points
)
insert into public.schedule_blocks (block_date, start_time, end_time, reason)
select s.holiday_date, s.start_time, s.end_time,
       'Feriado automático ' || s.scope || ' — ' || s.holiday_name || ' — ' || s.legal_basis
from segments s
where s.end_time is not null and s.end_time > s.start_time
  and not exists (
      select 1 from public.schedule_blocks existing
      where existing.block_date = s.holiday_date
        and existing.start_time < s.end_time and existing.end_time > s.start_time
  )
  and not exists (
      select 1 from public.booking_holiday_block_exceptions e
      where e.holiday_date = s.holiday_date
        and e.start_time < s.end_time and e.end_time > s.start_time
  );

commit;
