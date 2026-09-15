alter table public.waitlist_push_dispatches
  drop constraint if exists waitlist_push_dispatches_status_check;

alter table public.waitlist_push_dispatches
  add constraint waitlist_push_dispatches_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'opened', 'expired', 'dismissed'));

create or replace function public.get_my_waitlist_opportunity(p_opportunity_id uuid)
returns table (id uuid, service_name text, appointment_date date, start_time time, duration_minutes integer, available boolean)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.id, o.service_name_snapshot, o.appointment_date, o.start_time, o.duration_minutes,
    (o.status = 'open' and o.expires_at > now()
      and public.client_booking_start_allowed(o.appointment_date, o.start_time, o.service_name_snapshot, o.duration_minutes, o.source_appointment_id)
      and not exists (select 1 from public.appointments a where a.appointment_date=o.appointment_date and a.id<>o.source_appointment_id and coalesce(a.status,'') not in ('cancelled','canceled','cancelado','no_show','no-show') and a.start_time < o.start_time + make_interval(mins=>o.duration_minutes) and o.start_time < a.start_time + make_interval(mins=>a.duration_minutes)))
  from public.waitlist_opportunities o
  where o.id = p_opportunity_id
    and exists (select 1 from public.waiting_list_requests r join public.client_profiles cp on cp.id=r.client_id where r.client_id=cp.id and r.client_id=(select id from public.client_profiles where user_id=auth.uid()) and r.service_id=o.service_id and r.status='active' and o.appointment_date between r.week_start and r.week_end)
    and not exists (select 1 from public.waitlist_push_dispatches d where d.opportunity_id=o.id and d.client_id=(select id from public.client_profiles where user_id=auth.uid()) and d.status='dismissed');
$$;
grant execute on function public.get_my_waitlist_opportunity(uuid) to authenticated;

create or replace function public.dismiss_waitlist_opportunity(p_opportunity_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_client uuid; v_changed integer;
begin
  select cp.id into v_client from public.client_profiles cp where cp.user_id = auth.uid();
  if v_client is null then return false; end if;
  update public.waitlist_push_dispatches d
     set status='dismissed', updated_at=now()
   where d.opportunity_id=p_opportunity_id and d.client_id=v_client and d.status in ('sent','opened');
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end; $$;
revoke all on function public.dismiss_waitlist_opportunity(uuid) from public, anon;
grant execute on function public.dismiss_waitlist_opportunity(uuid) to authenticated;
