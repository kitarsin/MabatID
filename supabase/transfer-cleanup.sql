-- Apply once on the hosted Supabase project after the migration.
create extension if not exists pg_cron;
select cron.schedule('mabatid-transfer-cleanup', '* * * * *', 'select public.mabatid_transfer_cleanup()');
