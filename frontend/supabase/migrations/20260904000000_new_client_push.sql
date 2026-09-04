-- Reutiliza a outbox Web Push existente para avisar uma única vez sobre novos cadastros.

alter table public.appointment_push_events
    drop constraint if exists appointment_push_events_event_type_check;

alter table public.appointment_push_events
    add constraint appointment_push_events_event_type_check
    check (event_type in ('created', 'rescheduled', 'cancelled', 'client_registered'));

create unique index if not exists appointment_push_events_client_registered_uidx
    on public.appointment_push_events (appointment_id)
    where event_type = 'client_registered';

create or replace function public.capture_new_client_push_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_actor uuid := auth.uid();
    v_admin uuid;
begin
    select admin_user_id into v_admin
    from public.push_admin_config
    where singleton;

    -- Somente o primeiro perfil criado pela própria cliente representa um novo cadastro.
    if v_actor is null or v_actor = v_admin or new.user_id is distinct from v_actor then
        return new;
    end if;

    insert into public.appointment_push_events (
        appointment_id, event_type, actor_user_id, client_name, service_name
    ) values (
        new.id, 'client_registered', v_actor, new.full_name, ''
    ) on conflict do nothing;

    return new;
end;
$$;

revoke all on function public.capture_new_client_push_event() from public, anon, authenticated;

drop trigger if exists client_profiles_capture_new_client_push_event on public.client_profiles;
create trigger client_profiles_capture_new_client_push_event
after insert on public.client_profiles
for each row execute function public.capture_new_client_push_event();
