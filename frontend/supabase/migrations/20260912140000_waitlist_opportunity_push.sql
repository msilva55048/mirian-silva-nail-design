-- Fase 6: fanout de oportunidades, consulta autorizada e cron independente.
create index if not exists waitlist_opportunities_dispatch_idx
  on public.waitlist_opportunities(status, expires_at, appointment_date, start_time);

create or replace function public.get_waitlist_opportunity_dispatch_targets()
returns table (
  opportunity_id uuid, client_id uuid, service_id bigint, service_name text,
  appointment_date date, start_time time, duration_minutes integer,
  subscription_id uuid, endpoint text, p256dh text, auth_key text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.id, r.client_id, o.service_id, o.service_name_snapshot,
         o.appointment_date, o.start_time, o.duration_minutes,
         s.id, s.endpoint, s.p256dh, s.auth_key
  from public.waitlist_opportunities o
  join public.waiting_list_requests r
    on r.service_id = o.service_id
   and r.status = 'active'
   and o.appointment_date between r.week_start and r.week_end
  join public.client_push_subscriptions s on s.client_id = r.client_id
  where o.status = 'open'
    and o.expires_at > now()
    and (o.appointment_date::text || ' ' || o.start_time::text)::timestamp
          at time zone 'America/Sao_Paulo' > now()
    and public.client_booking_start_allowed(
          o.appointment_date, o.start_time, o.service_name_snapshot,
          o.duration_minutes, o.source_appointment_id)
    and not exists (
      select 1 from public.appointments a
      where a.appointment_date = o.appointment_date
        and coalesce(a.status,'') not in ('cancelled','canceled','cancelado','no_show','no-show')
        and a.id <> o.source_appointment_id
        and (a.start_time < o.start_time + make_interval(mins => o.duration_minutes)
             and o.start_time < a.start_time + make_interval(mins => a.duration_minutes))
    );
$$;
revoke all on function public.get_waitlist_opportunity_dispatch_targets() from public, anon, authenticated;
grant execute on function public.get_waitlist_opportunity_dispatch_targets() to service_role;

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
    and exists (select 1 from public.waiting_list_requests r join public.client_profiles cp on cp.id=r.client_id where r.client_id=cp.id and r.client_id=(select id from public.client_profiles where user_id=auth.uid()) and r.service_id=o.service_id and r.status='active' and o.appointment_date between r.week_start and r.week_end);
$$;
grant execute on function public.get_my_waitlist_opportunity(uuid) to authenticated;

create or replace function public.mark_waitlist_opportunity_opened(p_opportunity_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_client uuid; v_changed boolean;
begin
  select cp.id into v_client from public.client_profiles cp where cp.user_id = auth.uid();
  if v_client is null then return false; end if;
  update public.waitlist_push_dispatches d set status='opened', opened_at=coalesce(opened_at, now()), updated_at=now()
   where d.opportunity_id=p_opportunity_id and d.client_id=v_client and d.status in ('sent','opened');
  get diagnostics v_changed = row_count;
  return v_changed;
end; $$;
grant execute on function public.mark_waitlist_opportunity_opened(uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_namespace where nspname='cron') and exists (select 1 from pg_namespace where nspname='net') then
    perform cron.schedule('waitlist-opportunity-push','* * * * *', $job$select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/waitlist-opportunity-push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='service_role_key')),
      body := '{"action":"dispatch"}'::jsonb)$job$);
  end if;
exception when duplicate_object then null; end $$;
