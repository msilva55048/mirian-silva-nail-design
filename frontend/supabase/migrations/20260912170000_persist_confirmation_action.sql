-- Confirmação explícita acionada pela Mirian; não representa entrega no WhatsApp.
create or replace function public.mark_appointment_confirmation_sent(p_appointment_id uuid)
returns timestamptz
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_sent_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao Admin.' using errcode = '42501';
  end if;
  update public.appointments
     set confirmation_sent_at = coalesce(confirmation_sent_at, now())
   where id = p_appointment_id
   returning confirmation_sent_at into v_sent_at;
  if v_sent_at is null then raise exception 'Agendamento não encontrado.' using errcode = 'P0002'; end if;
  return v_sent_at;
end; $$;
revoke all on function public.mark_appointment_confirmation_sent(uuid) from public, anon;
grant execute on function public.mark_appointment_confirmation_sent(uuid) to authenticated;
