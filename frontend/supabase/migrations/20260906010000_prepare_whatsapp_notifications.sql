-- Ajusta a fila antiga do WhatsApp para os UUIDs usados atualmente
-- pela tabela appointments.

drop index if exists public.whatsapp_notifications_unique_appointment_message;

alter table public.whatsapp_notifications
alter column appointment_id type uuid
    using appointment_id::text::uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'whatsapp_notifications_appointment_id_fkey'
          and conrelid = 'public.whatsapp_notifications'::regclass
    ) then
alter table public.whatsapp_notifications
    add constraint whatsapp_notifications_appointment_id_fkey
        foreign key (appointment_id)
            references public.appointments(id)
            on delete cascade;
end if;
end
$$;

create unique index if not exists whatsapp_notifications_unique_appointment_message
    on public.whatsapp_notifications (appointment_id, notification_type)
    where appointment_id is not null
    and notification_type in (
    'booking_confirmation',
    'reminder_24h',
    'reminder_2h',
    'satisfaction',
    'cancellation_requested',
    'cancellation_confirmed'
    );

alter table public.whatsapp_notifications enable row level security;