-- Fase 3.1: identidade transacional de cada liberação de slot.
-- Permite liberar o mesmo slot novamente em outro ciclo do appointment.
begin;

alter table public.appointments
    add column if not exists waitlist_release_version bigint;

with ranked as (
    select id, row_number() over (partition by id order by created_at, id) as version
    from public.appointments
)
update public.appointments a
set waitlist_release_version = greatest(coalesce(a.waitlist_release_version, 0), ranked.version)
from ranked
where a.id = ranked.id;

alter table public.appointments
    alter column waitlist_release_version set default 0,
    alter column waitlist_release_version set not null;

alter table public.waitlist_opportunities
    add column if not exists release_event_version bigint;

with ranked as (
    select id, row_number() over (partition by source_appointment_id order by created_at, id) - 1 as version
    from public.waitlist_opportunities
)
update public.waitlist_opportunities o
set release_event_version = ranked.version
from ranked
where o.id = ranked.id;

alter table public.waitlist_opportunities
    alter column release_event_version set default 0,
    alter column release_event_version set not null;

alter table public.waitlist_opportunities
    drop constraint if exists waitlist_opportunities_source_appointment_id_appointment_da_key;
drop index if exists public.waitlist_opportunities_source_appointment_id_appointment_da_key;
create unique index if not exists waitlist_opportunities_release_event_unique
    on public.waitlist_opportunities (source_appointment_id, release_event_version);
create index if not exists waitlist_opportunities_slot_idx
    on public.waitlist_opportunities (appointment_date, start_time, status);

create or replace function public.bump_waitlist_release_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    if coalesce(old.status, '') not in ('cancelled','canceled','cancelado','no_show','no-show')
       and (
           coalesce(new.status, '') in ('cancelled','canceled','cancelado','no_show','no-show')
           or old.appointment_date is distinct from new.appointment_date
           or old.start_time is distinct from new.start_time
       ) then
        new.waitlist_release_version := coalesce(old.waitlist_release_version, 0) + 1;
    else
        new.waitlist_release_version := coalesce(old.waitlist_release_version, 0);
    end if;
    return new;
end;
$$;

drop trigger if exists appointments_bump_waitlist_release_version on public.appointments;
create trigger appointments_bump_waitlist_release_version
before update of status, appointment_date, start_time on public.appointments
for each row execute function public.bump_waitlist_release_version();

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
            select s.id into v_service_id from public.services s
            where s.name = v_service_name order by s.is_active desc, s.id limit 1;
            if v_service_id is not null
               and public.waitlist_released_slot_is_eligible(old.appointment_date, old.start_time, v_duration, old.id) then
                insert into public.waitlist_opportunities (
                    source_appointment_id, release_event_version, service_id, service_name_snapshot,
                    appointment_date, start_time, duration_minutes, status, expires_at
                ) values (
                    old.id, new.waitlist_release_version, v_service_id, v_service_name,
                    old.appointment_date, old.start_time, v_duration, 'open',
                    (old.appointment_date::timestamp + old.start_time) at time zone 'America/Sao_Paulo'
                ) on conflict (source_appointment_id, release_event_version) do nothing;
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

comment on column public.waitlist_opportunities.release_event_version is
    'Versão monotônica gerada no appointment para distinguir liberações legítimas repetidas.';
comment on function public.bump_waitlist_release_version() is
    'Incrementa a versão somente quando uma alteração libera o slot anterior.';

commit;
