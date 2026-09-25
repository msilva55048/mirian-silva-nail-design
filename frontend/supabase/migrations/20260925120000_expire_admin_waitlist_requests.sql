-- Mantém a lista operacional do ADM alinhada à regra de expiração da cliente.
-- A atualização apenas marca solicitações expiradas; nenhum histórico é removido.
create or replace function public.admin_list_waitlist_requests(p_include_history boolean default true)
returns setof public.waiting_list_requests
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
    if not public.is_admin() then
        raise exception 'Acesso restrito ao Admin.' using errcode = '42501';
    end if;

    update public.waiting_list_requests
       set status = 'expired', updated_at = now()
     where status = 'active'
       and week_end < (now() at time zone 'America/Sao_Paulo')::date;

    return query
        select r.*
          from public.waiting_list_requests r
         where p_include_history or r.status = 'active'
         order by (r.status <> 'active'), r.week_start, r.selected_date, r.created_at;
end;
$$;
