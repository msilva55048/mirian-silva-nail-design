-- Remove somente recompensas de indicação não consumidas que ainda não têm
-- serviço concluído da indicada. Recompensas usadas nunca são alteradas.
begin;

delete from public.referral_rewards rr
where rr.status in ('available', 'reserved')
  and rr.used_at is null
  and exists (
      select 1
      from public.client_referrals cr
      where cr.id = rr.referral_id
        and cr.status = 'pending'
        and not exists (
            select 1
            from public.appointments a
            where a.client_id = cr.referred_client_id
              and a.status = 'completed'
        )
  );

commit;
