create or replace function public.process_loyalty_penalties() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer:=0;
begin
  for r in select client_id from public.loyalty_cards where reward_available=false and last_eligible_completed_at is not null loop
    perform public.loyalty_apply_penalties(r.client_id);
    n:=n+1;
  end loop;
  return n;
end; $$;
revoke all on function public.process_loyalty_penalties() from public, anon, authenticated;
do $$ begin
  if not exists(select 1 from cron.job where jobname='loyalty-penalties-daily') then
    perform cron.schedule('loyalty-penalties-daily','15 3 * * *','select public.process_loyalty_penalties();');
  end if;
end $$;
alter table public.loyalty_cards enable row level security;
alter table public.loyalty_events enable row level security;
alter table public.loyalty_rewards enable row level security;
drop policy if exists loyalty_cards_own on public.loyalty_cards;
create policy loyalty_cards_own on public.loyalty_cards for select to authenticated using (client_id in (select id from public.client_profiles where user_id=auth.uid()));
drop policy if exists loyalty_rewards_own on public.loyalty_rewards;
create policy loyalty_rewards_own on public.loyalty_rewards for select to authenticated using (card_id in (select id from public.loyalty_cards where client_id in (select id from public.client_profiles where user_id=auth.uid())));
