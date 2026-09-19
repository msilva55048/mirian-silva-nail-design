-- Restaura, de forma atômica e idempotente, um cancelamento passado como realizado.
begin;

create or replace function public.admin_restore_cancelled_appointment_as_completed(
    p_appointment_id uuid,
    p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_updated integer;
begin
    if not public.is_admin() then
        raise exception 'Acesso restrito ao Admin.' using errcode = '42501';
    end if;

    update public.appointments a
       set status = 'completed'
     where a.id = p_appointment_id
       and a.status = 'cancelled'
       and ((a.appointment_date + a.start_time) at time zone 'America/Sao_Paulo') < p_now;

    get diagnostics v_updated = row_count;
    return v_updated = 1;
end;
$$;

revoke all on function public.admin_restore_cancelled_appointment_as_completed(uuid, timestamptz) from public, anon;
grant execute on function public.admin_restore_cancelled_appointment_as_completed(uuid, timestamptz) to authenticated;

commit;
