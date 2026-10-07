-- SQL Editor에서 실행. 모든 boolean 열은 true, 각 지역의 station_count는 0보다 커야 합니다.
select
 (select relrowsecurity from pg_class where oid='public.rail_stations'::regclass) as station_rls,
 (select relrowsecurity from pg_class where oid='public.rail_station_regions'::regclass) as region_rls,
 has_table_privilege('anon','public.rail_stations','SELECT') as public_read,
 not has_table_privilege('authenticated','public.rail_stations','INSERT') as user_write_blocked,
 not has_function_privilege('anon','public.replace_rail_station_region(text,jsonb)','EXECUTE') as anonymous_import_blocked,
 not has_function_privilege('authenticated','public.replace_rail_station_region(text,jsonb)','EXECUTE') as user_import_blocked,
 has_function_privilege('service_role','public.replace_rail_station_region(text,jsonb)','EXECUTE') as server_import_allowed,
 exists(select 1 from supabase_migrations.schema_migrations where version='20261007091810') as migration_recorded;

select r.id,r.updated_at,r.revision,count(s.id) station_count
from public.rail_station_regions r left join public.rail_stations s on s.region_id=r.id
group by r.id order by r.id;

-- 로그인 없는 실제 공개 권한으로 조회합니다. pending/비공개 장소는 조회되지 않습니다.
begin;
set local role anon;
select place_id,name,public.nearby_rail_stations(place_id) stations
from public.map_place_cards where status in ('approved','disputed') limit 5;
rollback;
