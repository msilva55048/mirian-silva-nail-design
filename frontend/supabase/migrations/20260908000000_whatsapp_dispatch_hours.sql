-- LOCAL ONLY. Apply after hold_uncertain_whatsapp_sends and the queue-only generator.
-- No opt-in dependency. Appointment validation belongs to this claim, not the worker.
create or replace function public.claim_due_whatsapp_notifications(p_limit integer default 20)
returns setof public.whatsapp_notifications
language plpgsql security definer set search_path = public
as $$
begin
    update public.whatsapp_notifications
    set status = 'failed', failed_at = now(),
        error_message = 'Envio interrompido; conferir manualmente antes de autorizar nova tentativa.',
        updated_at = now()
    where status = 'processing' and updated_at < now() - interval '15 minutes';

    return query with candidates as (
        select wn.id from public.whatsapp_notifications wn
        join public.appointments a on a.id = wn.appointment_id
        cross join lateral (select
            ((a.appointment_date + a.start_time) at time zone 'America/Sao_Paulo') as appointment_at,
            (((a.appointment_date - 1) + time '08:00') at time zone 'America/Sao_Paulo') as confirmation_at,
            (a.appointment_date::timestamp at time zone 'America/Sao_Paulo') as appointment_day_start,
            regexp_replace(a.client_phone, '[^0-9]', '', 'g') as digits
        ) t
        where wn.status = 'pending' and wn.attempts = 0
          and wn.provider_message_id is null and wn.scheduled_for <= now()
          and a.status in ('pending','confirmed') and t.appointment_at > now()
          and wn.payload->>'version' = '2'
          and length(trim(wn.payload->>'message')) > 0
          and wn.payload->>'phone' = wn.recipient_phone
          and wn.recipient_phone ~ '^55[0-9]{10,11}$'
          and wn.recipient_phone = case when length(t.digits) in (10,11) then '55'||t.digits else t.digits end
          and wn.payload->>'appointment_date' = a.appointment_date::text
          and wn.payload->>'start_time' = left(a.start_time::text,5)
          and wn.payload->>'client_name' = a.client_name
          and wn.payload->>'service_name' = a.service_name
          and ((wn.notification_type = 'reminder_40h'
              and t.appointment_at - interval '40 hours' <= now()
              and wn.scheduled_for = t.confirmation_at
              and now() < t.appointment_day_start)
            or (wn.notification_type = 'reminder_2h'
              and wn.scheduled_for = t.appointment_at - interval '2 hours'
              and wn.scheduled_for > now() - interval '1 hour'
              and now() >= t.appointment_day_start))
        order by wn.scheduled_for, wn.id
        for update of wn skip locked
        limit greatest(1, least(coalesce(p_limit,20),100))
    )
    update public.whatsapp_notifications wn
    set status = 'processing', attempts = wn.attempts + 1, error_message = null, updated_at = now()
    from candidates c where wn.id = c.id returning wn.*;
end;
$$;
revoke all on function public.claim_due_whatsapp_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_due_whatsapp_notifications(integer) to service_role;
