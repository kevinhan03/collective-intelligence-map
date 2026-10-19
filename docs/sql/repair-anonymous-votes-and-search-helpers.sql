-- 운영 DB에 빠진 두 기능을 보완합니다. 기존 데이터는 삭제하지 않으며 재실행 가능합니다.
-- 1) 비로그인 투표: 20260917100000_anonymous_place_votes, 20260918000000_merge_anonymous_votes_on_login
-- 2) 지도 전체 검색 보조 함수: 20261008112237_map_public_search 중 누락된 search_compact/city/area/category와 인덱스
--
-- 의도적으로 제외한 것:
-- - public.search_normalize: 20261010170732에서 다시 정의된 최신 버전이 이미 있습니다.
-- - public.search_map_places: 20261013173542(크리에이터 지도)에서 다시 정의된 최신 버전이 이미 있습니다.
--   예전 버전으로 덮어쓰지 않기 위해 docs/sql/add-map-public-search.sql 전체를 다시 실행하지 않습니다.
begin;

-- 1. 비로그인 투표 -------------------------------------------------------------

-- Signed-out visitors get one reversible vote per browser token and place.
-- The token itself stays in an HttpOnly cookie; only its SHA-256 digest reaches
-- Postgres, so this table is not a browser-identification store.
create table if not exists public.anonymous_map_place_votes (
  map_place_id uuid not null references public.map_places(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (map_place_id, token_hash)
);
alter table public.anonymous_map_place_votes enable row level security;
revoke all on public.anonymous_map_place_votes from anon, authenticated, public;
grant select, insert, update, delete on public.anonymous_map_place_votes to service_role;

-- 20260913020000 버전에 비로그인 투표 집계만 더한 버전입니다.
create or replace function private.place_stats(m uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'positive',
    (select count(*) from public.map_place_votes where map_place_id=m and value=1) +
    (select count(*) from public.anonymous_map_place_votes where map_place_id=m and value=1),
  'negative',
    (select count(*) from public.map_place_votes where map_place_id=m and value=-1) +
    (select count(*) from public.anonymous_map_place_votes where map_place_id=m and value=-1),
  'saved_count',(select count(*) from public.saves where map_place_id=m),
  'last_verified_at',(
    select max(updated_at) from (
      select updated_at from public.map_place_votes where map_place_id=m
      union all
      select updated_at from public.anonymous_map_place_votes where map_place_id=m
    ) votes
  )
 ) where private.public_map_place(m) or private.pending_map_place(m) or private.is_admin()
$$;

create or replace function private.record_anonymous_vote(
  p_target uuid,
  p_token_hash text,
  p_value smallint
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception '올바르지 않은 투표 식별자입니다.' using errcode='22023'; end if;
 if p_value not in (-1, 0, 1) then raise exception '잘못된 투표입니다.' using errcode='22023'; end if;
 if not (private.public_map_place(p_target) or private.pending_map_place(p_target)) then raise exception '공개된 장소를 찾을 수 없습니다.' using errcode='42501'; end if;
 if p_value=0 then
  delete from public.anonymous_map_place_votes where map_place_id=p_target and token_hash=p_token_hash;
 else
  insert into public.anonymous_map_place_votes(map_place_id,token_hash,value)
  values(p_target,p_token_hash,p_value)
  on conflict(map_place_id,token_hash) do update set value=excluded.value,updated_at=now();
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.record_anonymous_vote(uuid,text,smallint) from public;
grant execute on function private.record_anonymous_vote(uuid,text,smallint) to service_role;

create or replace function public.record_anonymous_vote(
  p_target uuid,
  p_token_hash text,
  p_value smallint
) returns jsonb language sql security invoker set search_path='' as $$
 select private.record_anonymous_vote(p_target,p_token_hash,p_value)
$$;
revoke all on function public.record_anonymous_vote(uuid,text,smallint) from public, anon, authenticated;
grant execute on function public.record_anonymous_vote(uuid,text,smallint) to service_role;

create or replace function private.move_anonymous_votes_after_merge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.merged_into_id is not null and new.merged_into_id is distinct from old.merged_into_id then
  insert into public.anonymous_map_place_votes(map_place_id,token_hash,value,created_at,updated_at)
  select new.merged_into_id,token_hash,value,created_at,updated_at
  from public.anonymous_map_place_votes
  where map_place_id=old.id
  on conflict(map_place_id,token_hash) do update
    set value=excluded.value,updated_at=excluded.updated_at
    where excluded.updated_at>public.anonymous_map_place_votes.updated_at;
  delete from public.anonymous_map_place_votes where map_place_id=old.id;
 end if;
 return new;
end $$;
revoke all on function private.move_anonymous_votes_after_merge() from public;
drop trigger if exists move_anonymous_votes_after_merge on public.map_places;
create trigger move_anonymous_votes_after_merge
after update of merged_into_id on public.map_places
for each row execute function private.move_anonymous_votes_after_merge();

-- 20261013173542(크리에이터 지도)는 이 테이블이 없을 때 아래 트리거를 건너뛰었습니다.
do $$ begin
 if to_regprocedure('private.guard_creator_vote()') is not null then
  execute 'drop trigger if exists guard_creator_vote on public.anonymous_map_place_votes';
  execute 'create trigger guard_creator_vote before insert or update on public.anonymous_map_place_votes for each row execute function private.guard_creator_vote()';
 end if;
end $$;

-- Fold a signed-out visitor's cookie-scoped votes into their account the
-- moment they sign in, so the same person can't count twice in place_stats.
create or replace function private.merge_anonymous_votes(p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();
begin
 if p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',true); end if;
 insert into public.map_place_votes(map_place_id,user_id,value,updated_at)
 select map_place_id,u,value,updated_at from public.anonymous_map_place_votes where token_hash=p_token_hash
 on conflict(map_place_id,user_id) do update
   set value=excluded.value,updated_at=excluded.updated_at
   where excluded.updated_at>public.map_place_votes.updated_at;
 delete from public.anonymous_map_place_votes where token_hash=p_token_hash;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.merge_anonymous_votes(text) from public, anon;
grant execute on function private.merge_anonymous_votes(text) to authenticated;

create or replace function public.merge_anonymous_votes(p_token_hash text) returns jsonb language sql security invoker set search_path='' as $$
 select private.merge_anonymous_votes(p_token_hash)
$$;
revoke all on function public.merge_anonymous_votes(text) from public, anon;
grant execute on function public.merge_anonymous_votes(text) to authenticated;

-- 2. 지도 전체 검색 보조 함수 ---------------------------------------------------

create or replace function public.search_compact(t text) returns text
language sql immutable parallel safe security invoker set search_path='' as $$ select replace(public.search_normalize(t),' ','') $$;
create or replace function public.search_city(t text) returns text
language sql immutable parallel safe security invoker set search_path='' as $$
 select case
 when t ~* '서울|Seoul' then '서울' when t ~* '부산|Busan' then '부산'
 when t ~* '인천|Incheon' then '인천' when t ~* '대구|Daegu' then '대구'
 when t ~* '대전|Daejeon' then '대전' when t ~* '광주|Gwangju' then '광주'
 when t ~* '울산|Ulsan' then '울산' when t ~* '제주|Jeju' then '제주'
 when t ~* '수원|Suwon' then '수원' when t ~* '용인|Yongin' then '용인'
 when t ~* '도쿄|Tokyo|東京都' then '도쿄' when t ~* '오사카|Osaka|大阪' then '오사카' else '기타 지역' end
$$;
create or replace function public.search_area(t text) returns text
language sql immutable parallel safe security invoker set search_path='' as $$
 select case when public.search_city(t)='기타 지역' then ''
 else public.search_city(t) || case when substring(t from '[가-힣]{2,8}(구|군|동)') is not null
 and substring(t from '[가-힣]{2,8}(?:구|군|동)')<>public.search_city(t)
 then ' · ' || substring(t from '[가-힣]{2,8}(?:구|군|동)') else '' end end
$$;
create or replace function public.search_category(t text) returns text
language sql immutable parallel safe security invoker set search_path='' as $$
 select case t when 'barber' then '바버숍' when 'bar' then '바' when 'boutique' then '부티크'
 when 'cafe' then '카페' when 'clothing_store' then '의류 매장' when 'department_store' then '백화점'
 when 'furniture_store' then '가구점' when 'photography_store_and_services' then '사진관'
 when 'shoe_store' then '신발 매장' when 'thrift_store' then '중고·빈티지 숍' else coalesce(t,'') end
$$;
revoke all on function public.search_compact(text),public.search_city(text),public.search_area(text),public.search_category(text) from public;
grant execute on function public.search_compact(text),public.search_city(text),public.search_area(text),public.search_category(text) to anon,authenticated,service_role;

create index if not exists places_search_name on public.places using gin(public.search_compact(name) extensions.gin_trgm_ops);
create index if not exists places_search_address on public.places using gin(public.search_compact(address) extensions.gin_trgm_ops);
create index if not exists places_search_category on public.places using gin(public.search_compact(category || ' ' || public.search_category(category)) extensions.gin_trgm_ops);
create index if not exists map_places_search_rationale on public.map_places using gin(public.search_compact(rationale) extensions.gin_trgm_ops);
create index if not exists places_search_geography on public.places using gist((location::extensions.geography));
create index if not exists rail_stations_search_name on public.rail_stations using gin(public.search_compact(name || ' ' || local_name) extensions.gin_trgm_ops);

-- SQL Editor 적용도 로컬 마이그레이션과 같은 이력으로 기록합니다.
do $$ begin
 if to_regclass('supabase_migrations.schema_migrations') is not null then
  insert into supabase_migrations.schema_migrations(version,name,statements) values
   ('20260917100000','anonymous_place_votes',array['SQL Editor: docs/sql/repair-anonymous-votes-and-search-helpers.sql']),
   ('20260918000000','merge_anonymous_votes_on_login',array['SQL Editor: docs/sql/repair-anonymous-votes-and-search-helpers.sql']),
   ('20261008112237','map_public_search',array['SQL Editor: docs/sql/repair-anonymous-votes-and-search-helpers.sql'])
  on conflict(version) do nothing;
 end if;
end $$;
commit;
notify pgrst, 'reload schema';
