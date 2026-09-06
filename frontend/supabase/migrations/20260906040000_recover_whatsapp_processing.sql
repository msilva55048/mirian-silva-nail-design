create or replace function public.claim_due_whatsapp_notifications(
    p_limit integer default 20
)
returns setof public.whatsapp_notifications
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Recupera mensagens que ficaram presas em processing
    -- por causa de uma execução interrompida.
update public.whatsapp_notifications
set
    status = 'pending',
    error_message = 'Recuperada automaticamente após processamento interrompido.',
    updated_at = now()
where status = 'processing'
  and updated_at < now() - interval '15 minutes';

return query
    with candidates as (
        select wn.id
        from public.whatsapp_notifications wn
        where wn.status = 'pending'
          and wn.scheduled_for <= now()
          and (
              (
                  wn.notification_type = 'reminder_40h'
                  and wn.scheduled_for >= now() - interval '6 hours'
              )
              or
              (
                  wn.notification_type = 'reminder_2h'
                  and wn.scheduled_for >= now() - interval '1 hour'
              )
          )
        order by wn.scheduled_for, wn.id
        for update skip locked
        limit greatest(1, least(coalesce(p_limit, 20), 100))
    )
update public.whatsapp_notifications wn
set
    status = 'processing',
    attempts = wn.attempts + 1,
    error_message = null,
    updated_at = now()
    from candidates c
where wn.id = c.id
    returning wn.*;
end;
$$;

revoke all on function public.claim_due_whatsapp_notifications(integer) from public;
revoke all on function public.claim_due_whatsapp_notifications(integer) from anon;
revoke all on function public.claim_due_whatsapp_notifications(integer) from authenticated;

grant execute
on function public.claim_due_whatsapp_notifications(integer)
to service_role;