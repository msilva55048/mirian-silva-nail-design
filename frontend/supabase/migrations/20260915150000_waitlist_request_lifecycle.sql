-- Fecha requests de semanas encerradas e expõe somente a lista ativa para clientes.
create or replace function public.get_my_waitlist_requests()
returns setof public.waiting_list_requests
language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.waiting_list_requests r
     set status = 'expired', updated_at = now()
   where r.status = 'active'
     and r.week_end < (now() at time zone 'America/Sao_Paulo')::date
     and exists (
       select 1
         from public.client_profiles cp
        where cp.id = r.client_id
          and cp.user_id = auth.uid()
     );

  return query
    select r.*
      from public.waiting_list_requests r
      join public.client_profiles cp on cp.id = r.client_id
     where cp.user_id = auth.uid()
       and r.status = 'active'
     order by r.week_start, r.selected_date, r.created_at desc;
end;
$$;

revoke all on function public.get_my_waitlist_requests() from public, anon, authenticated;
grant execute on function public.get_my_waitlist_requests() to authenticated;
