-- Read-only preflight. Run only when production access is available again.
select version from supabase_migrations.schema_migrations where version like '20260906%' or version like '20260907%' or version like '20260908%' order by version;
select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='client_profiles' and column_name like 'whatsapp_opt%';
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and (p.proname in ('get_my_whatsapp_opt_in','accept_whatsapp_reminders','claim_due_whatsapp_notifications') or p.prosrc ~ '(whatsapp_opt_in|whatsapp_opt_out_at|get_my_whatsapp_opt_in|accept_whatsapp_reminders)');
select schemaname,viewname from pg_views where definition ~ '(whatsapp_opt_in|whatsapp_opt_out_at)';
select schemaname,tablename,policyname from pg_policies where coalesce(qual,'')||coalesce(with_check,'') ~ '(whatsapp_opt_in|whatsapp_opt_out_at)';
select jobname,schedule,active from cron.job where jobname ilike '%whatsapp%';
