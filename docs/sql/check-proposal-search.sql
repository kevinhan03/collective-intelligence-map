-- 세 결과가 모두 true면 범위·경량 검색·권한 설정이 준비됐습니다.
select
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='theme_maps' and column_name='search_scope')
 and exists(select 1 from pg_constraint where conname='theme_maps_search_scope_check') as scope_schema_ready,
 to_regclass('public.search_places_text') is not null
 and to_regclass('public.search_places_location') is not null
 and to_regclass('public.proposal_search_names') is null
 and to_regprocedure('public.backfill_proposal_search_names(integer)') is null
 and to_regprocedure('private.sync_proposal_search_names()') is null
 and to_regprocedure('public.proposal_search_ready()') is not null
 and exists(select 1 from pg_proc where oid=to_regprocedure('public.search_overture_places(text,uuid)')
   and prosrc like '%from public.our_search_places%' and prosrc not like '%proposal_search_names%')
 and pg_database_size(current_database()) <= 450 * 1024 * 1024 as lightweight_search_ready,
 coalesce(has_function_privilege('service_role',to_regprocedure('public.search_overture_places(text,uuid)'),'EXECUTE'),false)
 and not coalesce(has_function_privilege('anon',to_regprocedure('public.search_overture_places(text,uuid)'),'EXECUTE'),true)
 and not coalesce(has_function_privilege('authenticated',to_regprocedure('public.search_overture_places(text,uuid)'),'EXECUTE'),true)
 and coalesce(has_function_privilege('service_role',to_regprocedure('public.proposal_search_ready()'),'EXECUTE'),false)
 and not coalesce(has_function_privilege('anon',to_regprocedure('public.proposal_search_ready()'),'EXECUTE'),true)
 and not has_table_privilege('anon','public.our_search_places','SELECT')
 and not has_table_privilege('authenticated','public.our_search_places','SELECT')
 and public.proposal_scope_contains('region','FJ','{"west":170,"east":-170,"south":-10,"north":10}','FJ',-179,0)
 and not public.proposal_scope_contains('region','JP','{"west":139,"east":140,"south":35,"north":36}','JP',135,35)
 as permissions_and_scope_ready;

select pg_size_pretty(pg_database_size(current_database())) as database_size,
       pg_size_pretty(pg_total_relation_size('public.our_search_places')) as source_and_indexes_size;
