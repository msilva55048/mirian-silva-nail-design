begin;

alter table public.whatsapp_notifications
drop constraint if exists whatsapp_notifications_type_check;

drop index if exists public.whatsapp_notifications_unique_appointment_message;

update public.whatsapp_notifications
set
    notification_type = 'reminder_40h',
    template_name = case
                        when template_name = 'confirmacao_agendamento_24h'
                            then 'confirmacao_agendamento_40h'
                        else template_name
        end,
    scheduled_for = scheduled_for - interval '16 hours',
    updated_at = now()
where notification_type = 'reminder_24h';

alter table public.whatsapp_notifications
    add constraint whatsapp_notifications_type_check
        check (
            notification_type in (
                                  'booking_confirmation',
                                  'reminder_40h',
                                  'reminder_2h',
                                  'satisfaction',
                                  'campaign',
                                  'cancellation_requested',
                                  'cancellation_confirmed'
                )
            );

create unique index if not exists whatsapp_notifications_unique_appointment_message
    on public.whatsapp_notifications (appointment_id, notification_type)
    where appointment_id is not null
    and notification_type in (
    'booking_confirmation',
    'reminder_40h',
    'reminder_2h',
    'satisfaction',
    'cancellation_requested',
    'cancellation_confirmed'
    );

commit;