-- Fase 7: claim transacional de oportunidade, aditivo e protegido por lock de data.
alter table public.waitlist_opportunities add column if not exists claimed_appointment_id uuid references public.appointments(id) on delete set null;
create index if not exists waitlist_opportunities_claimed_appointment_idx on public.waitlist_opportunities(claimed_appointment_id);

create or replace function public.claim_waitlist_opportunity(p_opportunity_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid(); v_client uuid; v_o public.waitlist_opportunities%rowtype; v_r public.waiting_list_requests%rowtype;
  v_service public.services%rowtype; v_profile public.client_profiles%rowtype; v_id uuid; v_now timestamptz := now();
begin
  if v_uid is null then return jsonb_build_object('result','unauthorized'); end if;
  select id into v_client from public.client_profiles where user_id=v_uid limit 1;
  if v_client is null then return jsonb_build_object('result','unauthorized'); end if;
  select * into v_o from public.waitlist_opportunities where id=p_opportunity_id for update;
  if not found then return jsonb_build_object('result','invalid'); end if;
  if v_o.status='claimed' then
    if v_o.claimed_by_client_id=v_client then return jsonb_build_object('result','already_claimed_by_you','appointment_id',v_o.claimed_appointment_id);
    else return jsonb_build_object('result','already_claimed'); end if;
  end if;
  if v_o.status <> 'open' or v_o.expires_at is null or v_o.expires_at <= v_now then return jsonb_build_object('result','expired'); end if;
  select r.* into v_r from public.waiting_list_requests r where r.client_id=v_client and r.service_id=v_o.service_id and r.status='active' and v_o.appointment_date between r.week_start and r.week_end and exists (select 1 from public.waitlist_push_dispatches d where d.opportunity_id=v_o.id and d.client_id=v_client and d.status in ('sent','opened')) order by r.created_at desc limit 1;
  if not found then return jsonb_build_object('result','unauthorized'); end if;
  select * into v_service from public.services where id=v_o.service_id and is_active=true;
  if not found or coalesce(v_service.duration_minutes,0) <> v_o.duration_minutes then return jsonb_build_object('result','unavailable'); end if;
  if not public.client_booking_start_allowed(v_o.appointment_date,v_o.start_time,v_service.name,v_o.duration_minutes,v_o.source_appointment_id) then return jsonb_build_object('result','unavailable'); end if;
  perform pg_advisory_xact_lock(hashtextextended('appointment-date:'||v_o.appointment_date::text,0));
  if exists (select 1 from public.schedule_blocks b where b.block_date=v_o.appointment_date and b.start_time < v_o.start_time + make_interval(mins=>v_o.duration_minutes) and b.end_time > v_o.start_time) then return jsonb_build_object('result','unavailable'); end if;
  if exists (select 1 from public.appointments a where a.appointment_date=v_o.appointment_date and coalesce(a.status,'') not in ('cancelled','canceled','cancelado','no_show','no-show') and a.start_time < v_o.start_time + make_interval(mins=>v_o.duration_minutes) and v_o.start_time < a.start_time + make_interval(mins=>coalesce(a.duration_minutes,0))) then return jsonb_build_object('result','unavailable'); end if;
  select * into v_profile from public.client_profiles where id=v_client;
  insert into public.appointments(client_id,client_name,client_phone,client_email,service_name,appointment_date,start_time,duration_minutes,price_cents,status)
  values(v_client,v_profile.full_name,v_profile.phone,v_profile.email,v_service.name,v_o.appointment_date,v_o.start_time,v_service.duration_minutes,v_service.price_cents,'pending') returning id into v_id;
  update public.waitlist_opportunities set status='claimed',claimed_by_client_id=v_client,claimed_at=v_now,claimed_appointment_id=v_id,updated_at=v_now where id=v_o.id;
  update public.waiting_list_requests set status='fulfilled',updated_at=v_now where id=v_r.id;
  return jsonb_build_object('result','claimed','appointment_id',v_id);
exception when exclusion_violation or unique_violation then return jsonb_build_object('result','unavailable');
end; $$;
revoke all on function public.claim_waitlist_opportunity(uuid) from public, anon;
grant execute on function public.claim_waitlist_opportunity(uuid) to authenticated;
