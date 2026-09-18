-- Indicação só é validada quando o primeiro atendimento da indicada é concluído.
-- Também reconcilia somente recompensas ainda não consumidas que foram liberadas
-- prematuramente pela regra anterior.
begin;

create or replace function public.finalize_referral_reward_after_appointment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
    if new.status = 'completed'
       and (tg_op = 'INSERT' or old.status is distinct from 'completed')
       and new.referral_reward_id is not null then
        update public.referral_rewards
           set status = 'used',
               used_at = coalesce(used_at, now())
         where id = new.referral_reward_id
           and client_id = new.client_id
           and status = 'reserved';
    end if;

    if new.status = 'completed'
       and (tg_op = 'INSERT' or old.status is distinct from 'completed')
       and new.is_referred_first_appointment then
        perform public.activate_referral_from_first_appointment(
            new.client_id,
            new.created_at
        );
    end if;

    return new;
end;
$function$;

revoke all on function public.finalize_referral_reward_after_appointment() from public, anon, authenticated;

update public.appointments a
set price_cents = coalesce(a.original_price_cents, a.price_cents),
    original_price_cents = null,
    referral_discount_percent = null,
    referral_reward_id = null
from public.referral_rewards rr
where rr.id = a.referral_reward_id
  and rr.status = 'reserved'
  and rr.used_at is null
  and not exists (
      select 1
      from public.appointments referred
      join public.client_referrals cr on cr.referred_client_id = referred.client_id
      where cr.id = rr.referral_id
        and referred.status = 'completed'
  );

update public.referral_rewards rr
set status = 'available',
    reserved_at = null
where rr.status = 'reserved'
  and rr.used_at is null
  and not exists (
      select 1
      from public.appointments referred
      join public.client_referrals cr on cr.referred_client_id = referred.client_id
      where cr.id = rr.referral_id
        and referred.status = 'completed'
  );

update public.client_referrals cr
set status = 'pending',
    qualified_at = null
where cr.status in ('rewarded', 'qualified_without_reward')
  and not exists (
      select 1
      from public.appointments referred
      where referred.client_id = cr.referred_client_id
        and referred.status = 'completed'
  )
  and not exists (
      select 1
      from public.referral_rewards rr
      where rr.referral_id = cr.id
        and rr.status = 'used'
  );

commit;
