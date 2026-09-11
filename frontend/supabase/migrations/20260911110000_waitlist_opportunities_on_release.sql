-- Fase 3: captura server-side de slots liberados.
-- Não envia push, não altera a UI, o scheduler ou a lista waiting_list antiga.
begin;

create or replace function public.waitlist_released_slot_is_eligible(
    p_appointment_date date,
    p_start_time time without time zone,
    p_duration_minutes integer,
    p_excluded_appointment_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
    v_start timestamp := p_appointment_date::timestamp + p_start_time;
    v_end time := p_start_time + make_interval(mins => p_duration_minutes);
begin
    if p_appointment_date is null or p_start_time is null or coalesce(p_duration_minutes, 0) <= 0 then
        return false;
    end if;
    if v_start <= (now() at time zone 'America/Sao_Paulo') then
        return false;
    end if;
    if exists (
        select 1 from public.schedule_blocks sb
        where sb.block_date = p_appointment_date
          and sb.start_time < v_end
          and sb.end_time > p_start_time
    ) then
        return false;
    end if;
    if exists (
        select 1 from public.appointments a
        where a.id is distinct from p_excluded_appointment_id
          and coalesce(a.status, '') not in ('cancelled','canceled','cancelado','no_show','no-show')
          and a.appointment_date = p_appointment_date
          and a.start_time < v_end
          and a.start_time + make_interval(mins => greatest(coalesce(a.duration_minutes, 0), 1)) > p_start_time
    ) then
        return false;
    end if;
    return true;
end;
$$;

revoke all on function public.waitlist_released_slot_is_eligible(date, time without time zone, integer, uuid) from public, anon, authenticated;
grant execute on function public.waitlist_released_slot_is_eligible(date, time without time zone, integer, uuid) to service_role;

create or replace function public.capture_waitlist_released_slot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_released boolean := false;
    v_duration integer;
    v_service_id bigint;
    v_service_name text;
begin
    if tg_op = 'UPDATE' then
        v_released := (
            coalesce(old.status, '') not in ('cancelled','canceled','cancelado','no_show','no-show')
            and (
                coalesce(new.status, '') in ('cancelled','canceled','cancelado','no_show','no-show')
                or old.appointment_date is distinct from new.appointment_date
                or old.start_time is distinct from new.start_time
            )
        );

        if v_released then
            v_duration := coalesce(old.duration_minutes, 0);
            v_service_name := old.service_name;
            select s.id into v_service_id
            from public.services s
            where s.name = v_service_name
            order by s.is_active desc, s.id
            limit 1;

            if v_service_id is not null
               and public.waitlist_released_slot_is_eligible(old.appointment_date, old.start_time, v_duration, old.id) then
                insert into public.waitlist_opportunities (
                    source_appointment_id, service_id, service_name_snapshot,
                    appointment_date, start_time, duration_minutes,
                    status, expires_at
                ) values (
                    old.id, v_service_id, v_service_name,
                    old.appointment_date, old.start_time, v_duration,
                    'open',
                    (old.appointment_date::timestamp + old.start_time) at time zone 'America/Sao_Paulo'
                ) on conflict (source_appointment_id, appointment_date, start_time) do nothing;
            end if;
        end if;

        -- Uma nova ocupação torna uma oportunidade aberta inutilizável.
        if coalesce(new.status, '') not in ('cancelled','canceled','cancelado','no_show','no-show') then
            update public.waitlist_opportunities o
            set status = 'cancelled', updated_at = now()
            where o.status = 'open'
              and o.appointment_date = new.appointment_date
              and o.start_time < new.start_time + make_interval(mins => greatest(coalesce(new.duration_minutes, 0), 1))
              and o.start_time + make_interval(mins => greatest(o.duration_minutes, 1)) > new.start_time;
        end if;
    elsif tg_op = 'INSERT' then
        if coalesce(new.status, '') not in ('cancelled','canceled','cancelado','no_show','no-show') then
            update public.waitlist_opportunities o
            set status = 'cancelled', updated_at = now()
            where o.status = 'open'
              and o.appointment_date = new.appointment_date
              and o.start_time < new.start_time + make_interval(mins => greatest(coalesce(new.duration_minutes, 0), 1))
              and o.start_time + make_interval(mins => greatest(o.duration_minutes, 1)) > new.start_time;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists appointments_capture_waitlist_release on public.appointments;
create trigger appointments_capture_waitlist_release
after insert or update of status, appointment_date, start_time on public.appointments
for each row execute function public.capture_waitlist_released_slot();

revoke all on function public.capture_waitlist_released_slot() from public, anon, authenticated;
grant execute on function public.capture_waitlist_released_slot() to service_role;

comment on function public.capture_waitlist_released_slot() is
    'Cria uma oportunidade open somente quando um slot futuro fica livre; não envia push.';
comment on column public.waitlist_opportunities.status is
    'open enquanto o slot está livre; cancelled quando uma nova ocupação o invalida.';

commit;
