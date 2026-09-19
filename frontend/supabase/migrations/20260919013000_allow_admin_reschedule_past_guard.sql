-- O ADM usa a grade administrativa, inclusive para corrigir datas/horários.
-- Clientes continuam impedidos de criar ou mover agendamentos para o passado.
begin;

create or replace function public.prevent_past_appointments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    appointment_moment timestamp;
    sao_paulo_now timestamp;
begin
    if auth.uid() is not null and public.is_admin() then
        return new;
    end if;

    appointment_moment := new.appointment_date::timestamp + new.start_time;
    sao_paulo_now := timezone('America/Sao_Paulo', now());

    if appointment_moment <= sao_paulo_now then
        raise exception 'Não é possível criar ou mover um agendamento para uma data/horário que já passou.';
    end if;

    return new;
end;
$$;

revoke all on function public.prevent_past_appointments() from public, anon, authenticated;
grant execute on function public.prevent_past_appointments() to authenticated, service_role;

commit;
