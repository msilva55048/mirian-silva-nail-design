create or replace function public.get_my_whatsapp_opt_in()
returns boolean
language sql
security definer
set search_path = public
as $$
select coalesce(
               (
                   select cp.whatsapp_opt_in
                   from public.client_profiles cp
                   where cp.user_id = auth.uid()
               limit 1
           ),
        false
    );
$$;

create or replace function public.accept_whatsapp_reminders()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
update public.client_profiles
set
    whatsapp_opt_in = true,
    whatsapp_opt_in_at = now(),
    whatsapp_opt_in_source = 'booking_confirmation',
    whatsapp_opt_in_version = 1,
    whatsapp_opt_out_at = null
where user_id = auth.uid();

return found;
end;
$$;

revoke all on function public.get_my_whatsapp_opt_in() from public;
revoke all on function public.accept_whatsapp_reminders() from public;

grant execute on function public.get_my_whatsapp_opt_in() to authenticated;
grant execute on function public.accept_whatsapp_reminders() to authenticated;