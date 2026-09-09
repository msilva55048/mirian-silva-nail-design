-- Corrige exclusivamente o evento Web Push de nova cliente.
-- O claim pode executar como SECURITY DEFINER; o perfil vinculado é a fonte confiável do ator.

begin;

alter table public.appointment_push_events
    drop constraint if exists appointment_push_events_event_type_check;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.appointment_push_events'::regclass
          and conname = 'appointment_push_events_event_type_check'
    ) then
        alter table public.appointment_push_events
            add constraint appointment_push_events_event_type_check
            check (event_type in ('created', 'rescheduled', 'cancelled', 'client_registered'));
    end if;
end;
$$;

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
    v_admin uuid;
begin
    select admin_user_id into v_admin
    from public.push_admin_config
    where singleton;

    -- O claim pode ser SECURITY DEFINER, portanto auth.uid() não é a fonte do ator.
    -- O primeiro vínculo do próprio perfil identifica o novo cadastro.
    if new.user_id is null or new.user_id = v_admin then
        return new;
    end if;

    -- Edições posteriores do perfil não são novos cadastros.
    if tg_op = 'UPDATE' and old.user_id is not null then
        return new;
    end if;

    insert into public.appointment_push_events (
        appointment_id, event_type, actor_user_id, client_name, service_name
    ) values (
        new.id, 'client_registered', new.user_id, new.full_name, ''
    ) on conflict do nothing;

    return new;
end;
$$;

revoke all on function public.capture_new_client_push_event() from public, anon, authenticated;

drop trigger if exists client_profiles_capture_new_client_push_event on public.client_profiles;
create trigger client_profiles_capture_new_client_push_event
after insert or update of user_id on public.client_profiles
for each row execute function public.capture_new_client_push_event();

commit;
