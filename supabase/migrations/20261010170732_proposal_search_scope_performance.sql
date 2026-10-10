-- 1. 기존 검색과 데이터를 유지하며 범위 설정과 보조 함수만 준비합니다. 이름 복제·대량 인덱싱은 하지 않습니다.
begin;
set local lock_timeout='5s';
-- Standalone prerequisite: shared normalization may not be installed remotely.
create or replace function public.search_normalize(t text) returns text
language sql immutable parallel safe security invoker set search_path='' as $$
 select btrim(regexp_replace(lower(normalize(translate(coalesce(t,''),chr(65279),' '),NFKC)), '[[:space:]]+', ' ', 'g'))
$$;
revoke all on function public.search_normalize(text) from public;
grant execute on function public.search_normalize(text) to anon,authenticated,service_role;

-- Existing maps retain their exact search bounds. No place data is reset.
alter table public.theme_maps add column if not exists search_scope text not null default 'region';
alter table public.theme_maps alter column country drop not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='theme_maps_search_scope_check') then
  alter table public.theme_maps add constraint theme_maps_search_scope_check
   check(search_scope in('region','country','world') and
     ((search_scope='world' and country is null) or (search_scope<>'world' and country is not null)));
 end if;
end $$;

-- A dateline-crossing region is two envelopes, never its complement.
create or replace function public.proposal_region_geometry(b jsonb) returns extensions.geometry
language sql immutable parallel safe security invoker set search_path='' as $$
 select case when (b->>'west')::float8 < (b->>'east')::float8 then
  extensions.st_makeenvelope((b->>'west')::float8,(b->>'south')::float8,(b->>'east')::float8,(b->>'north')::float8,4326)
 else extensions.st_collect(
  extensions.st_makeenvelope((b->>'west')::float8,(b->>'south')::float8,180,(b->>'north')::float8,4326),
  extensions.st_makeenvelope(-180,(b->>'south')::float8,(b->>'east')::float8,(b->>'north')::float8,4326)) end
$$;
create or replace function public.proposal_scope_contains(scope text,country text,b jsonb,place_country text,lng float8,lat float8) returns boolean
language sql immutable parallel safe security invoker set search_path='' as $$
 select coalesce(lng between -180 and 180 and lat between -90 and 90 and
 (scope='world' or (country=place_country and (scope='country' or (scope='region' and
  lat between (b->>'south')::float8 and (b->>'north')::float8 and
  case when (b->>'west')::float8<(b->>'east')::float8 then lng between (b->>'west')::float8 and (b->>'east')::float8
  else lng >= (b->>'west')::float8 or lng <= (b->>'east')::float8 end)))),false)
$$;

revoke all on function public.proposal_region_geometry(jsonb),public.proposal_scope_contains(text,text,jsonb,text,float8,float8) from public;
grant execute on function public.proposal_region_geometry(jsonb),public.proposal_scope_contains(text,text,jsonb,text,float8,float8) to anon,authenticated,service_role;
commit;
notify pgrst, 'reload schema';

-- 3. 기존 인덱스를 재사용하는 경량 검색을 활성화하고 폐기된 이름 테이블만 정리합니다.
begin;
set local lock_timeout='5s';
do $$ begin
 if pg_database_size(current_database()) > 450 * 1024 * 1024 then
  raise exception 'DB가 450MB 작업 예산을 초과합니다. 용량을 확인한 뒤 진행하세요.';
 end if;
end $$;
-- lightweight_v2: readiness does not depend on a name table or a backfill.
create or replace function public.proposal_search_ready() returns boolean
language sql stable security invoker set search_path='' as $$ select true $$;
revoke all on function public.proposal_search_ready() from public,anon,authenticated;
grant execute on function public.proposal_search_ready() to service_role;
create or replace function public.search_overture_places(q text,m uuid) returns jsonb
language plpgsql stable security invoker set search_path='' set plan_cache_mode=force_custom_plan as $$
declare t public.theme_maps; query text:=public.search_normalize(q); pattern text;
 target_country text; extent extensions.geometry;
begin
 select * into t from public.theme_maps where id=m and status='published';
 if t.id is null or length(query) not between 2 and 100 then return '[]'; end if;
 target_country:=case when t.search_scope='world' then null else t.country end;
 extent:=case when t.search_scope='region' then public.proposal_region_geometry(t.bounds) else null end;
 pattern:=replace(replace(replace(query,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_');
 -- Keep indexed search_text unwrapped and normalize the input once.
 -- Rank matching rows and build JSON only for the top ten.
 return (select coalesce(jsonb_agg(jsonb_build_object(
   'provider','overture','externalId',r.source_id,'label',r.primary_name,'address',r.address,
   'lat',r.latitude,'lng',r.longitude,'category',r.category,'locality',r.locality,'countryCode',r.country_code,
   'attribution','Overture Maps','matchType',case when r.match_rank<2 then 'exact' else 'prefix' end
 ) order by r.match_rank,r.source_id),'[]') from (
  select s.*,case
    when lower(btrim(s.primary_name))=query then 0
    when exists(select 1 from unnest(s.alternate_names) n where lower(btrim(n))=query) then 1
    when s.primary_name ilike pattern||'%' escape E'\\' then 2
    else 3 end match_rank
  from public.our_search_places s
  where s.source='overture' and (target_country is null or s.country_code=target_country)
   and (extent is null or (s.location operator(extensions.&&) extent
    and ((t.bounds->>'west')::float8 < (t.bounds->>'east')::float8
      or extensions.st_covers(extent,s.location))))
   and (s.search_text ilike pattern||'%' escape E'\\'
     or s.search_text ilike '% '||pattern||'%' escape E'\\')
  order by match_rank,s.source_id limit 10
 ) r);
end $$;
create or replace function public.overture_place_details(external_id_value text,m uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('provider','overture','externalId',s.source_id,'label',s.primary_name,'address',s.address,
 'lat',s.latitude,'lng',s.longitude,'category',s.category,'locality',s.locality,'countryCode',s.country_code,'attribution','Overture Maps')
 from public.our_search_places s join public.theme_maps t on t.id=m
 where t.status='published' and s.source='overture' and s.source_id=external_id_value
 and public.proposal_scope_contains(t.search_scope,t.country,t.bounds,s.country_code,s.longitude,s.latitude)
$$;
create or replace function public.search_internal_places(q text,m uuid) returns jsonb
language plpgsql stable security invoker set search_path='' set plan_cache_mode=force_custom_plan as $$
declare t public.theme_maps; query text:=public.search_normalize(q); pattern text; target_country text; extent extensions.geometry;
begin
 select * into t from public.theme_maps where id=m and status='published';
 if t.id is null or length(query) not between 2 and 100 then return '[]'; end if;
 target_country:=case when t.search_scope='world' then null else t.country end;
 extent:=case when t.search_scope='region' then public.proposal_region_geometry(t.bounds) else null end;
 pattern:='%'||replace(replace(replace(query,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 return (select coalesce(jsonb_agg(r),'[]') from (
  select p.id,p.name,p.address,p.category,p.city locality,p.country "countryCode",extensions.st_y(p.location) lat,extensions.st_x(p.location) lng
  from public.places p where p.status in('active','pending') and (target_country is null or p.country=target_country)
   and (extent is null or (p.location operator(extensions.&&) extent and
     ((t.bounds->>'west')::float8<(t.bounds->>'east')::float8 or extensions.st_covers(extent,p.location))))
   and (p.name ilike pattern escape E'\\' or p.name operator(extensions.%) q)
  order by (public.search_normalize(p.name)=query) desc,extensions.similarity(p.name,q) desc,p.id limit 20
 ) r);
end $$;

create or replace function private.submit_proposal(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); m public.theme_maps; p uuid:=(payload->>'placeId')::uuid; result_id uuid; lng double precision:=(payload->>'lng')::double precision; lat double precision:=(payload->>'lat')::double precision; auto boolean:=private.is_admin(); matches uuid[]; actual_country text;
begin
 if not private.can_contribute() then raise exception '장소를 제안할 권한이 없습니다.' using errcode='42501'; end if;
 perform private.rate_limit('proposal',20);
 select * into m from public.theme_maps where id=(payload->>'mapId')::uuid and status='published';
 if m.id is null then raise exception '공개 맵을 찾을 수 없습니다.'; end if;
 if length(btrim(coalesce(payload->>'rationale',''))) not between 5 and 1000 then raise exception '추천 근거를 입력해 주세요.'; end if;
 perform pg_advisory_xact_lock(781234);
 actual_country:=case when m.search_scope='world' then payload->>'countryCode' else m.country end;
 if p is null then
  if actual_country is null or actual_country !~ '^[A-Z]{2}$' then raise exception '장소의 국가를 선택해 주세요.'; end if;
  if not public.proposal_scope_contains(m.search_scope,m.country,m.bounds,actual_country,lng,lat) then raise exception '지도 범위 안의 장소만 제안해 주세요.'; end if;
  if length(btrim(coalesce(payload->>'name',''))) not between 1 and 120 then raise exception '장소 이름을 입력해 주세요.'; end if;
  select array_agg(v.id) into matches from public.places v where v.status in('active','pending') and v.country=actual_country
   and lower(btrim(v.name))=lower(btrim(payload->>'name'))
   and btrim(coalesce(payload->>'address',''))<>'' and lower(btrim(v.address))=lower(btrim(payload->>'address'))
   and extensions.st_dwithin(v.location::extensions.geography,extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,15);
  if cardinality(matches)=1 then p:=matches[1]; end if;
  if p is null then
   insert into public.places(name,address,category,location,country,city,created_by,status) values(btrim(payload->>'name'),coalesce(payload->>'address',''),coalesce(nullif(payload->>'category',''),'기타'),extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326),actual_country,case when m.search_scope='region' then m.city else coalesce(payload->>'locality','') end,u,case when auto then 'active' else 'pending' end) returning id into p;
   insert into private.place_field_sources(place_id,source_note,reviewed_by,reviewed_at) values(p,coalesce(nullif(btrim(payload->>'sourceNote'),''),'사용자가 직접 알고 있는 장소 정보를 등록했습니다.'),case when auto then u end,case when auto then now() end);
  end if;
 else
  if not exists(select 1 from public.places v where v.id=p and v.status in('active','pending')
   and (private.visible_place(v.id) or private.pending_visible_place(v.id) or v.created_by=u)
   and public.proposal_scope_contains(m.search_scope,m.country,m.bounds,v.country,extensions.st_x(v.location),extensions.st_y(v.location))) then raise exception '기존 장소를 찾을 수 없습니다.'; end if;
 end if;
 select id into result_id from public.map_places where map_id=m.id and place_id=p;
 if result_id is not null then return result_id; end if;
 insert into public.map_places(map_id,place_id,added_by,rationale,status) values(m.id,p,u,btrim(payload->>'rationale'),case when auto then 'approved' else 'pending' end) returning id into result_id;
 if auto then update public.places set status='active' where id=p; end if;
 return result_id;
end $$;

create or replace function private.resolve_provider_place(p text,external_id_value text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('placeId',v.id,'name',v.name,'address',v.address,'category',v.category,'lat',extensions.st_y(v.location),'lng',extensions.st_x(v.location),'countryCode',v.country)
 from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status in('active','pending')
$$;
revoke all on function public.proposal_region_geometry(jsonb), public.proposal_scope_contains(text,text,jsonb,text,float8,float8),
 public.search_overture_places(text,uuid),
 public.overture_place_details(text,uuid),public.search_internal_places(text,uuid) from public,anon,authenticated;
grant execute on function public.proposal_region_geometry(jsonb),public.proposal_scope_contains(text,text,jsonb,text,float8,float8),
 public.search_internal_places(text,uuid) to anon,authenticated,service_role;
grant execute on function public.search_overture_places(text,uuid),public.overture_place_details(text,uuid) to service_role;
-- RESTRICT cleanup after replacement functions no longer use the old names.
-- Unexpected dependencies abort this transaction rather than cascading.
drop trigger if exists sync_proposal_search_names on public.our_search_places;
drop function if exists public.backfill_proposal_search_names(integer);
drop function if exists private.sync_proposal_search_names();
drop function if exists private.proposal_name_terms(text,text[],text);
drop table if exists public.proposal_search_names;
drop index if exists public.proposal_internal_name;
do $$ begin
 if pg_database_size(current_database()) > 450 * 1024 * 1024 then
  raise exception '적용 후 DB 용량이 450MB 작업 예산을 초과했습니다.';
 end if;
end $$;
notify pgrst, 'reload schema';

do $$ begin
 if to_regclass('supabase_migrations.schema_migrations') is not null then
  insert into supabase_migrations.schema_migrations(version,name,statements)
  values('20261010170732','proposal_search_scope_performance',array['SQL Editor: lightweight proposal search, no name backfill'])
  on conflict(version) do nothing;
 end if;
end $$;
commit;
notify pgrst, 'reload schema';
