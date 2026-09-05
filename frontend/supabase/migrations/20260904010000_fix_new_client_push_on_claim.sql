-- Captura tanto a criação direta quanto o vínculo de um perfil pré-existente no cadastro.

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

    if v_actor is null or v_actor = v_admin or new.user_id is distinct from v_actor then
        return new;
    end if;

    if tg_op = 'UPDATE' and old.user_id is not null then
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
after insert or update of user_id on public.client_profiles
for each row execute function public.capture_new_client_push_event();
