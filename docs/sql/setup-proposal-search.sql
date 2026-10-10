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
