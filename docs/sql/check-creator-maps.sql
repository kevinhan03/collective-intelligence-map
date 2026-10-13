-- Read-only verification; does not alter production data.
select pg_size_pretty(pg_database_size(current_database())) as database_size,
 pg_database_size(current_database()) <= 450*1024*1024 as within_work_budget,
 exists(select 1 from storage.buckets where id='creator-map-covers' and not public) as private_cover_bucket,
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='creator_profiles' and c.relrowsecurity) as profile_rls,
 to_regprocedure('public.creator_command(jsonb)') is not null as owner_write_rpc,
 to_regprocedure('public.creator_snapshot()') is not null as management_ready,
 not has_function_privilege('anon','public.creator_command(jsonb)','EXECUTE') as anonymous_write_blocked,
 not has_function_privilege('authenticated','public.creator_cover_jobs()','EXECUTE') as cleanup_service_only,
 not has_function_privilege('authenticated','public.creator_add_resolved(jsonb,uuid,text,text)','EXECUTE') as signed_candidates_service_only;
select version,name from supabase_migrations.schema_migrations where version='20261013173542';
select kind,status,count(*) from public.theme_maps group by kind,status order by kind,status;
