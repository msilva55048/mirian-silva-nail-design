-- Preserve the original RPC signature for older deployments.
create or replace function public.get_my_client_appointments_v2()
returns table (
  id uuid, client_id uuid, service_name text, appointment_date date,
  start_time time, duration_minutes integer, price_cents integer,
  status text, created_at timestamptz, confirmation_sent_at timestamptz
)
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select a.id, a.client_id, a.service_name, a.appointment_date,
    a.start_time, a.duration_minutes, a.price_cents, a.status,
    a.created_at, a.confirmation_sent_at
  from public.appointments a
  join public.client_profiles cp on cp.id = a.client_id
  where cp.user_id = auth.uid()
  order by a.appointment_date desc, a.start_time desc, a.id desc;
$$;
revoke all on function public.get_my_client_appointments_v2() from public, anon;
grant execute on function public.get_my_client_appointments_v2() to authenticated;

-- One server-owned completion writer; never infer duration from today's service catalog.
create or replace function public.complete_finished_appointments(p_now timestamptz default now())
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  update public.appointments a
  set status = 'completed'
  where a.status in ('pending', 'confirmed')
    and a.duration_minutes > 0
    and ((a.appointment_date + a.start_time) at time zone 'America/Sao_Paulo')
      + make_interval(mins => a.duration_minutes) <= p_now;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.complete_finished_appointments(timestamptz) from public, anon, authenticated;
grant execute on function public.complete_finished_appointments(timestamptz) to service_role;

-- Independent of both existing push jobs. Named schedule is idempotent.
select cron.schedule('complete-finished-appointments', '* * * * *',
  'select public.complete_finished_appointments();');
