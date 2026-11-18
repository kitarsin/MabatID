select jsonb_build_object(
  'schema_version', public.mabatid_transfer_health(),
  'rls_tables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('mabatid_transfers','mabatid_transfer_limits') and c.relrowsecurity),
  'anon_table_access', has_table_privilege('anon','public.mabatid_transfers','select'),
  'authenticated_table_access', has_table_privilege('authenticated','public.mabatid_transfers','select'),
  'anon_rpc_access', has_function_privilege('anon','public.mabatid_transfer_claim(text,text)','execute'),
  'authenticated_rpc_access', has_function_privilege('authenticated','public.mabatid_transfer_claim(text,text)','execute'),
  'security_definer_functions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'mabatid_transfer_%' and p.prosecdef),
  'active_cleanup_jobs', (select count(*) from cron.job where jobname='mabatid-transfer-cleanup' and active)
) as verification;
