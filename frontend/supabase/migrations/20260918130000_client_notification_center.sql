-- Central persistente de notificações da Cliente, independente do Web Push.
begin;

create table if not exists public.client_notifications (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.client_profiles(id) on delete cascade,
    type text not null,
    title text not null,
    message text not null,
    data jsonb not null default '{}'::jsonb,
    entity_type text,
    entity_id uuid,
    created_at timestamptz not null default now(),
    read_at timestamptz,
    dedupe_key text not null unique
);

create index if not exists client_notifications_client_created_idx
    on public.client_notifications(client_id, created_at desc);
create index if not exists client_notifications_unread_idx
    on public.client_notifications(client_id, read_at)
    where read_at is null;

alter table public.client_notifications enable row level security;
revoke all on public.client_notifications from anon, authenticated;
grant select on public.client_notifications to authenticated;

drop policy if exists client_notifications_select_own on public.client_notifications;
create policy client_notifications_select_own on public.client_notifications
for select to authenticated using (
    client_id = (select id from public.client_profiles where user_id = auth.uid() limit 1)
);

create or replace function public.mark_client_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = public, pg_temp
as $$
    update public.client_notifications
       set read_at = coalesce(read_at, now())
     where id = p_notification_id
       and client_id = (select id from public.client_profiles where user_id = auth.uid() limit 1);
$$;
revoke all on function public.mark_client_notification_read(uuid) from public, anon;
grant execute on function public.mark_client_notification_read(uuid) to authenticated;

create or replace function public.mark_all_client_notifications_read()
returns void language sql security definer set search_path = public, pg_temp
as $$
    update public.client_notifications
       set read_at = coalesce(read_at, now())
     where client_id = (select id from public.client_profiles where user_id = auth.uid() limit 1)
       and read_at is null;
$$;
revoke all on function public.mark_all_client_notifications_read() from public, anon;
grant execute on function public.mark_all_client_notifications_read() to authenticated;

create or replace function public.create_client_notification(
    p_client_id uuid,
    p_type text,
    p_title text,
    p_message text,
    p_data jsonb default '{}'::jsonb,
    p_entity_type text default null,
    p_entity_id uuid default null,
    p_dedupe_key text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_id uuid;
begin
    if p_client_id is null or coalesce(nullif(trim(p_dedupe_key), ''), '') = '' then return null; end if;
    insert into public.client_notifications(client_id, type, title, message, data, entity_type, entity_id, dedupe_key)
    values (p_client_id, p_type, p_title, p_message, coalesce(p_data, '{}'::jsonb), p_entity_type, p_entity_id, p_dedupe_key)
    on conflict (dedupe_key) do nothing
    returning id into v_id;
    return v_id;
end;
$function$;
revoke all on function public.create_client_notification(uuid,text,text,text,jsonb,text,uuid,text) from public, anon, authenticated;
grant execute on function public.create_client_notification(uuid,text,text,text,jsonb,text,uuid,text) to service_role;

create or replace function public.capture_client_appointment_notification()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_date text; v_time text;
begin
    if new.client_id is null then return new; end if;
    v_date := to_char(new.appointment_date, 'DD/MM');
    v_time := to_char(new.start_time, 'HH24:MI');

    if tg_op = 'INSERT' and new.status in ('pending','confirmed') and new.appointment_date >= current_date then
        perform public.create_client_notification(new.client_id, 'appointment-created', 'Agendamento marcado',
            format('Seu agendamento para %s às %s foi marcado.', v_date, v_time),
            jsonb_build_object('appointment_id', new.id), 'appointment', new.id, 'appointment-created:' || new.id::text);
        if coalesce(new.is_referred_first_appointment, false) then
            perform public.create_client_notification((select referrer_client_id from public.client_referrals where referred_client_id = new.client_id limit 1), 'referral-scheduled', 'Sua indicação agendou', 'Sua indicação marcou um atendimento.', jsonb_build_object('appointment_id', new.id), 'appointment', new.id, 'referral-scheduled:' || new.id::text);
        end if;
    end if;

    if tg_op = 'UPDATE' and new.status in ('pending','confirmed') and old.status in ('pending','confirmed') then
        if new.confirmation_sent_at is not null and old.confirmation_sent_at is null then
            perform public.create_client_notification(new.client_id, 'appointment-confirmed', 'Agendamento confirmado',
                format('Seu agendamento de %s às %s foi confirmado pela Mirian.', v_date, v_time),
                jsonb_build_object('appointment_id', new.id), 'appointment', new.id, 'appointment-confirmed:' || new.id::text);
        elsif new.appointment_date is distinct from old.appointment_date or new.start_time is distinct from old.start_time then
            perform public.create_client_notification(new.client_id, 'appointment-rescheduled', 'Agendamento alterado',
                format('Seu agendamento foi atualizado para %s às %s.', v_date, v_time),
                jsonb_build_object('appointment_id', new.id), 'appointment', new.id,
                'appointment-rescheduled:' || new.id::text || ':' || new.appointment_date::text || ':' || v_time);
        end if;
    end if;

    if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status in ('pending','confirmed') then
        perform public.create_client_notification(new.client_id, 'appointment-cancelled', 'Agendamento cancelado',
            format('Seu agendamento de %s às %s foi cancelado.', v_date, v_time),
            jsonb_build_object('appointment_id', new.id), 'appointment', new.id, 'appointment-cancelled:' || new.id::text);
    end if;
    if new.status = 'completed' and coalesce(new.is_referred_first_appointment, false) then
        perform public.create_client_notification((select referrer_client_id from public.client_referrals where referred_client_id = new.client_id limit 1), 'referral-qualified', 'Seu desconto foi liberado 🎉', 'Sua indicação concluiu o atendimento. Seu desconto de 30% está disponível.', jsonb_build_object('appointment_id', new.id), 'appointment', new.id, 'referral-qualified:' || new.id::text);
    end if;
    return new;
end;
$function$;

drop trigger if exists appointments_capture_client_notification on public.appointments;
create trigger appointments_capture_client_notification
after insert or update of status, appointment_date, start_time, confirmation_sent_at on public.appointments
for each row execute function public.capture_client_appointment_notification();

create or replace function public.capture_client_referral_notification()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
begin
    perform public.create_client_notification(new.referrer_client_id, 'referral-registered', 'Sua indicação se cadastrou', 'Sua amiga se cadastrou pelo seu convite.', jsonb_build_object('referral_id', new.id), 'referral', new.id, 'referral-registered:' || new.id::text);
    return new;
end;
$function$;

drop trigger if exists client_referrals_capture_notification on public.client_referrals;
create trigger client_referrals_capture_notification after insert on public.client_referrals
for each row execute function public.capture_client_referral_notification();

create or replace function public.capture_waitlist_client_notification()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_service text;
begin
    if tg_op = 'INSERT' and new.client_id is not null and coalesce(new.status, '') in ('open','available') then
        select name into v_service from public.services where id = new.service_id;
        perform public.create_client_notification(new.client_id, 'waitlist-opportunity', 'Vaga disponível 💅',
            format('Abriu uma vaga para %s em %s às %s.', coalesce(v_service, 'seu serviço'), to_char(new.appointment_date, 'DD/MM'), to_char(new.start_time, 'HH24:MI')),
            jsonb_build_object('opportunity_id', new.id), 'waitlist-opportunity', new.id, 'waitlist-opportunity:' || new.id::text);
    end if;
    return new;
end;
$function$;

drop trigger if exists waitlist_opportunities_capture_client_notification on public.waitlist_opportunities;
create trigger waitlist_opportunities_capture_client_notification
after insert on public.waitlist_opportunities
for each row execute function public.capture_waitlist_client_notification();

do $$ begin
    alter publication supabase_realtime add table public.client_notifications;
exception when duplicate_object then null; end $$;

commit;
