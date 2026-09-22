-- Cartão Fidelidade: início oficial 02/10/2026 em America/Sao_Paulo.
create table if not exists public.loyalty_cards (
  id uuid primary key default gen_random_uuid(), client_id uuid not null unique references public.client_profiles(id) on delete cascade,
  cycle_number integer not null default 1, stars integer not null default 0 check (stars between 0 and 10),
  program_started_at date not null default date '2026-10-02', last_eligible_completed_at date,
  reward_available boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.loyalty_events (
  id uuid primary key default gen_random_uuid(), card_id uuid not null references public.loyalty_cards(id) on delete cascade,
  event_type text not null, appointment_id uuid references public.appointments(id) on delete set null,
  period_number integer, stars_delta integer not null, occurred_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists loyalty_star_appointment_uidx on public.loyalty_events(card_id, appointment_id, event_type) where appointment_id is not null;
create unique index if not exists loyalty_penalty_period_uidx on public.loyalty_events(card_id, period_number, event_type) where period_number is not null;
create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(), card_id uuid not null references public.loyalty_cards(id) on delete cascade,
  cycle_number integer not null, status text not null default 'available' check (status in ('available','reserved','consumed')),
  reserved_appointment_id uuid unique references public.appointments(id) on delete set null,
  earned_at timestamptz not null default now(), reserved_at timestamptz, consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.appointments add column if not exists loyalty_reward_id uuid references public.loyalty_rewards(id) on delete set null;
alter table public.appointments add column if not exists loyalty_original_price_cents integer;
create index if not exists loyalty_events_card_idx on public.loyalty_events(card_id, occurred_at desc);
create index if not exists loyalty_rewards_client_status_idx on public.loyalty_rewards(card_id, status);

create or replace function public.loyalty_is_repair(p_service_name text) returns boolean language sql immutable as $$
  select regexp_replace(lower(translate(trim(coalesce(p_service_name,'')), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]+', ' ', 'g') like '%reparo%'
$$;

create or replace function public.loyalty_apply_penalties(p_client_id uuid, p_as_of date default (timezone('America/Sao_Paulo', now()))::date) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.loyalty_cards%rowtype; periods integer; i integer; new_stars integer;
begin
  select * into c from public.loyalty_cards where client_id=p_client_id for update;
  if not found or c.reward_available or c.last_eligible_completed_at is null or p_as_of < c.last_eligible_completed_at + 21 then return; end if;
  periods := floor((p_as_of - c.last_eligible_completed_at)::numeric / 21);
  for i in 1..periods loop
    if not exists(select 1 from public.loyalty_events where card_id=c.id and event_type='star-lost' and period_number=i) then
      new_stars := greatest(0, c.stars - 1);
      insert into public.loyalty_events(card_id,event_type,period_number,stars_delta,metadata) values(c.id,'star-lost',i,-1,jsonb_build_object('period_days',21));
      update public.loyalty_cards set stars=new_stars,updated_at=now() where id=c.id returning * into c;
      if new_stars < 1 and i = periods then
        insert into public.client_notifications(client_id,type,title,message,data,entity_type,entity_id,dedupe_key)
        values(p_client_id,'loyalty-star-lost','Seu Cartão Fidelidade foi atualizado',format('Passaram 21 dias sem um novo atendimento e seu saldo agora é %s/10.',new_stars),jsonb_build_object('stars',new_stars),'loyalty-card',c.id,format('loyalty-star-lost:%s:%s',c.id,i)) on conflict (client_id,dedupe_key) do nothing;
      end if;
    end if;
  end loop;
end; $$;

create or replace function public.loyalty_on_appointment_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare card public.loyalty_cards%rowtype; reward public.loyalty_rewards%rowtype; eligible boolean; original integer;
begin
  eligible := not public.loyalty_is_repair(new.service_name);
  if tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from new.status) then
    if new.status in ('pending','confirmed') and eligible and new.client_id is not null then
      select * into card from public.loyalty_cards where client_id=new.client_id for update;
      if card.id is not null and card.reward_available then
        select * into reward from public.loyalty_rewards where card_id=card.id and status='available' order by earned_at limit 1 for update skip locked;
        if reward.id is not null then
          original := coalesce(new.price_cents,0); new.loyalty_original_price_cents := original; new.loyalty_reward_id := reward.id; new.price_cents := 0;
          update public.loyalty_rewards set status='reserved',reserved_appointment_id=new.id,reserved_at=now() where id=reward.id;
          update public.loyalty_cards set reward_available=false,updated_at=now() where id=card.id;
          insert into public.client_notifications(client_id,type,title,message,data,entity_type,entity_id,dedupe_key) values(new.client_id,'loyalty-reward-applied','🎁 Benefício aplicado',format('Seu próximo serviço está gratuito: %s.',new.service_name),jsonb_build_object('appointment_id',new.id),'appointment',new.id,'loyalty-reward-applied:'||new.id) on conflict (client_id,dedupe_key) do nothing;
        end if;
      end if;
    end if;
  end if;
  if tg_op='UPDATE' and old.status in ('pending','confirmed') and new.status='cancelled' and old.loyalty_reward_id is not null then
    update public.loyalty_rewards set status='available',reserved_appointment_id=null,reserved_at=null where id=old.loyalty_reward_id and status='reserved';
    update public.loyalty_cards set reward_available=true,updated_at=now() where id=(select card_id from public.loyalty_rewards where id=old.loyalty_reward_id);
  end if;
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from new.status) and new.client_id is not null then
    perform public.loyalty_apply_penalties(new.client_id, new.appointment_date);
    select * into card from public.loyalty_cards where client_id=new.client_id for update;
    if card.id is null then insert into public.loyalty_cards(client_id) values(new.client_id) returning * into card; end if;
    if new.loyalty_reward_id is not null then
      update public.loyalty_rewards set status='consumed',consumed_at=now() where id=new.loyalty_reward_id and status='reserved';
      update public.loyalty_cards set stars=0,cycle_number=card.cycle_number+1,last_eligible_completed_at=null,reward_available=false,updated_at=now() where id=card.id;
      insert into public.client_notifications(client_id,type,title,message,data,entity_type,entity_id,dedupe_key) values(new.client_id,'loyalty-cycle-started','⭐ Um novo Cartão Fidelidade começou!','Continue realizando seus atendimentos para acumular novas estrelas.',jsonb_build_object('appointment_id',new.id),'loyalty-card',card.id,'loyalty-cycle-started:'||new.id) on conflict (client_id,dedupe_key) do nothing;
    elsif eligible and new.appointment_date >= date '2026-10-02' then
      if not exists(select 1 from public.loyalty_events where card_id=card.id and appointment_id=new.id and event_type='star-earned') and not card.reward_available and card.stars < 10 then
        update public.loyalty_cards set stars=least(10,card.stars+1),last_eligible_completed_at=new.appointment_date,updated_at=now() where id=card.id returning * into card;
        insert into public.loyalty_events(card_id,event_type,appointment_id,stars_delta,metadata) values(card.id,'star-earned',new.id,1,jsonb_build_object('service_name',new.service_name));
        if card.stars=10 then
          insert into public.loyalty_rewards(card_id,cycle_number) values(card.id,card.cycle_number) returning * into reward;
          update public.loyalty_cards set reward_available=true,updated_at=now() where id=card.id;
          insert into public.client_notifications(client_id,type,title,message,data,entity_type,entity_id,dedupe_key) values(new.client_id,'loyalty-reward-earned','🎁 Parabéns!','Você completou seu Cartão Fidelidade. Seu próximo serviço elegível é grátis!',jsonb_build_object('stars',10),'loyalty-card',card.id,'loyalty-reward-earned:'||card.id||':'||card.cycle_number) on conflict (client_id,dedupe_key) do nothing;
        else
          insert into public.client_notifications(client_id,type,title,message,data,entity_type,entity_id,dedupe_key) values(new.client_id,'loyalty-star-earned','⭐ Você ganhou uma estrela!',format('Agora você tem %s/10 no seu Cartão Fidelidade.',card.stars),jsonb_build_object('stars',card.stars),'loyalty-card',card.id,'loyalty-star-earned:'||new.id) on conflict (client_id,dedupe_key) do nothing;
        end if;
      end if;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists appointments_loyalty_change on public.appointments;
create trigger appointments_loyalty_change before insert or update on public.appointments for each row execute function public.loyalty_on_appointment_change();

create or replace function public.get_my_loyalty_card() returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare cid uuid; c public.loyalty_cards%rowtype; r public.loyalty_rewards%rowtype;
begin
  select id into cid from public.client_profiles where user_id=auth.uid() limit 1;
  if cid is null then return jsonb_build_object('prelaunch',true,'stars',0,'reward_available',false); end if;
  insert into public.loyalty_cards(client_id) values(cid) on conflict(client_id) do nothing;
  perform public.loyalty_apply_penalties(cid);
  select * into c from public.loyalty_cards where client_id=cid;
  select * into r from public.loyalty_rewards where card_id=c.id and status in ('available','reserved') order by earned_at desc limit 1;
  return jsonb_build_object('prelaunch',(timezone('America/Sao_Paulo',now()))::date < date '2026-10-02','stars',c.stars,'reward_available',c.reward_available,'last_eligible_completed_at',c.last_eligible_completed_at,'next_due_date',case when c.last_eligible_completed_at is null then null else c.last_eligible_completed_at+21 end,'reward_status',coalesce(r.status,'none'),'reward_id',r.id);
end; $$;
grant execute on function public.get_my_loyalty_card() to authenticated;
