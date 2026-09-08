-- PROPOSAL ONLY: intentionally outside supabase/migrations.
-- First re-audit production, export the five fields keyed by client_profiles.id,
-- deploy clients and queue generator without these RPCs, and verify no old callers.
-- Requires a separate explicit approval. Never use CASCADE.
begin;
set local lock_timeout = '5s';
do $$
begin
    if current_setting('mirian.opt_in_cleanup_approved', true) is distinct from 'yes' then
        raise exception 'Cleanup requires production audit, backup and separate approval.';
    end if;
    if exists (
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.prokind='f'
        and p.proname not in ('get_my_whatsapp_opt_in','accept_whatsapp_reminders')
        and p.prosrc ~ '(whatsapp_opt_in|whatsapp_opt_out_at|get_my_whatsapp_opt_in|accept_whatsapp_reminders)'
    ) then
        raise exception 'Other database functions still reference opt-in; review dependencies first.';
    end if;
end;
$$;
drop function if exists public.get_my_whatsapp_opt_in() restrict;
drop function if exists public.accept_whatsapp_reminders() restrict;
alter table public.client_profiles
    drop column if exists whatsapp_opt_in restrict,
    drop column if exists whatsapp_opt_in_at restrict,
    drop column if exists whatsapp_opt_in_source restrict,
    drop column if exists whatsapp_opt_in_version restrict,
    drop column if exists whatsapp_opt_out_at restrict;
commit;
