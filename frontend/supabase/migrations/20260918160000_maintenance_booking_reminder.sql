-- Lembrete único de nova manutenção, criado apenas para conclusões ocorridas após esta migration.
begin;
create table if not exists public.client_maintenance_reminders (
    id uuid primary key default gen_random_uuid(), appointment_id uuid not null unique references public.appointments(id) on delete cascade,
    client_id uuid not null references public.client_profiles(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'sent', 'skipped')),
    created_at timestamptz not null default now(), completed_at timestamptz not null default now(), processed_at timestamptz
);
alter table public.client_maintenance_reminders enable row level security;
revoke all on public.client_maintenance_reminders from anon, authenticated;
grant all on public.client_maintenance_reminders to service_role;

create or replace function public.capture_client_maintenance_completion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $function$
begin
    if new.status = 'completed' and old.status is distinct from 'completed' then
        insert into public.client_maintenance_reminders(appointment_id, client_id, completed_at) values (new.id, new.client_id, now()) on conflict (appointment_id) do nothing;
    end if;
    return new;
end;
$function$;
drop trigger if exists appointments_capture_client_maintenance_completion on public.appointments;
create trigger appointments_capture_client_maintenance_completion after update of status on public.appointments for each row execute function public.capture_client_maintenance_completion();

create or replace function public.dispatch_client_maintenance_reminders(p_now timestamptz default now())
returns table(client_id uuid, appointment_id uuid, first_name text, message text)
language plpgsql security definer set search_path = public, pg_temp as $function$
declare r record; v_message text; v_local date; v_local_time time;
begin
    v_local := (p_now at time zone 'America/Sao_Paulo')::date; v_local_time := (p_now at time zone 'America/Sao_Paulo')::time;
    if v_local_time < time '08:00' or v_local_time >= time '08:15' then return; end if;
    for r in select m.id, m.appointment_id, m.client_id, coalesce(nullif(split_part(cp.full_name, ' ', 1), ''), 'cliente') as first_name
        from public.client_maintenance_reminders m join public.appointments a on a.id = m.appointment_id join public.client_profiles cp on cp.id = m.client_id
        where m.status = 'pending' and a.status = 'completed' and (m.completed_at at time zone 'America/Sao_Paulo')::date = v_local - 1 for update of m skip locked loop
        if exists (select 1 from public.appointments a where a.client_id = r.client_id and a.status in ('pending', 'confirmed') and ((a.appointment_date::text || ' ' || a.start_time::text)::timestamp at time zone 'America/Sao_Paulo') > p_now) then
            update public.client_maintenance_reminders set status = 'skipped', processed_at = p_now where id = r.id; continue;
        end if;
        v_message := format('Olá, %s. Você está sem agendamento marcado para realizar sua próxima manutenção. Não deixe para cima da hora, pois a agenda está bem disputada.', r.first_name);
        perform public.create_client_notification(r.client_id, 'maintenance_booking_reminder', 'LEMBRETE', v_message, jsonb_build_object('appointment_id', r.appointment_id), 'appointment', r.appointment_id, 'maintenance-reminder:' || r.appointment_id::text);
        update public.client_maintenance_reminders set status = 'sent', processed_at = p_now where id = r.id;
        client_id := r.client_id; appointment_id := r.appointment_id; first_name := r.first_name; message := v_message; return next;
    end loop;
end;
$function$;
revoke all on function public.dispatch_client_maintenance_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.dispatch_client_maintenance_reminders(timestamptz) to service_role;

do $$ begin
    if exists (select 1 from pg_namespace where nspname = 'cron') and exists (select 1 from pg_namespace where nspname = 'net') then
        perform cron.schedule('client-maintenance-booking-reminders', '*/5 * * * *', $job$select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/client-web-push', headers := jsonb_build_object('Content-Type', 'application/json', 'x-client-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'client_push_reminders_secret')), body := '{"action":"maintenance-dispatch"}'::jsonb)$job$);
    end if;
exception when duplicate_object then null; end $$;
commit;
