-- Ajusta somente a data efetiva da nova grade pública da Cliente.
-- A disponibilidade real continua sendo filtrada por blocks, overrides,
-- appointments, conflitos, duração e regras de serviço nas funções existentes.
begin;

create or replace function public.client_booking_base_start_minutes(p_date date)
returns integer[] language sql immutable set search_path = public, pg_temp
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

commit;
