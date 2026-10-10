-- 지도 전체 검색 설정. 기존 데이터는 삭제하지 않습니다.
-- 기존 역 스키마가 먼저 적용되어 있어야 합니다. 재실행 가능합니다.
begin;
-- Read-only map-wide search. All visibility checks apply even for admin callers.
create or replace function public.search_normalize(t text) returns text
language sql immutable parallel safe security invoker set search_path='' as $$
 select btrim(regexp_replace(lower(normalize(translate(coalesce(t,''),chr(65279),' '),NFKC)), '[[:space:]]+', ' ', 'g'))
$$;
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
create index if not exists places_search_name on public.places using gin(public.search_compact(name) extensions.gin_trgm_ops);
create index if not exists places_search_address on public.places using gin(public.search_compact(address) extensions.gin_trgm_ops);
create index if not exists places_search_category on public.places using gin(public.search_compact(category || ' ' || public.search_category(category)) extensions.gin_trgm_ops);
create index if not exists map_places_search_rationale on public.map_places using gin(public.search_compact(rationale) extensions.gin_trgm_ops);
create index if not exists places_search_geography on public.places using gist((location::extensions.geography));
create index if not exists rail_stations_search_name on public.rail_stations using gin(public.search_compact(name || ' ' || local_name) extensions.gin_trgm_ops);

create or replace function public.search_map_places(payload jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 m uuid:=(payload->>'mapId')::uuid; q text:=public.search_normalize(payload->>'q');
 reg text:=coalesce(payload->>'region',''); ordering text:=coalesce(payload->>'sort','relevance');
 skip integer:=coalesce((payload->>'offset')::integer,0); station_id text:=payload->>'stationId';
 user_lat float8:=(payload->>'lat')::float8; user_lng float8:=(payload->>'lng')::float8;
 station public.rail_stations; chosen jsonb:=null; result jsonb; state text; map_bounds jsonb;
begin
 if not exists(select 1 from public.theme_maps where id=m and status='published') then return null; end if;
 if length(coalesce(payload->>'q',''))>100 or length(reg)>80 or skip not between 0 and 1000000
 or ordering not in('relevance','distance','newest','verified','controversial','popular')
 or (user_lat is null)<>(user_lng is null) or user_lat not between -90 and 90 or user_lng not between -180 and 180
 or (ordering='distance' and user_lat is null) then raise exception 'Invalid search input' using errcode='22023'; end if;
 select bounds into map_bounds from public.theme_maps where id=m;
 select case when count(*)=0 then 'unsupported' when bool_or(updated_at is not null) then 'ready' else 'preparing' end into state
 from public.rail_station_regions where extensions.st_intersects(bounds,
 extensions.st_makeenvelope((map_bounds->>'west')::float8,(map_bounds->>'south')::float8,(map_bounds->>'east')::float8,(map_bounds->>'north')::float8,4326));
 if station_id is not null then
   select s.* into station from public.rail_stations s join public.rail_station_regions r on r.id=s.region_id
   where s.id=station_id and r.updated_at is not null and exists(
     select 1 from public.map_places mp join public.places p on p.id=mp.place_id
     where mp.map_id=m and mp.status in('approved','disputed') and p.status='active' and private.public_map_place(mp.id)
       and extensions.st_dwithin(p.location::extensions.geography,s.location,2000));
   if not found then raise exception 'Unknown station for map' using errcode='22023'; end if;
   chosen:=jsonb_build_object('id',station.id,'name',station.name,'local_name',station.local_name,'kind',station.kind,'region',station.region_id,'lat',station.lat,'lng',station.lng);
 end if;
 with visible as materialized (
   select mp.id,mp.place_id,mp.map_id,p.name,p.address,p.category,
    extensions.st_y(p.location) lat,extensions.st_x(p.location) lng,mp.rationale,mp.status,mp.added_by,
    coalesce(pr.handle,'탈퇴한 기여자') handle,mp.created_at,p.location,
    public.search_city(p.address) city,public.search_area(p.address) area,public.search_category(p.category) category_label
   from public.map_places mp join public.places p on p.id=mp.place_id left join public.profiles pr on pr.id=mp.added_by
   where mp.map_id=m and mp.status in('approved','disputed') and p.status='active' and private.public_map_place(mp.id)
 ), matched as (
   select v.*,case when q='' then 3 when public.search_compact(v.name)=public.search_compact(q) then 0
    when starts_with(public.search_compact(v.name),public.search_compact(q)) then 1
    when strpos(public.search_compact(v.name),public.search_compact(q))>0 then 2 else 3 end match_rank,
    case when station_id is not null then round(extensions.st_distance(v.location::extensions.geography,station.location))::integer end station_distance_m
   from visible v where (reg='' or v.city=reg)
    and (station_id is null or extensions.st_dwithin(v.location::extensions.geography,station.location,2000))
    and not exists(select 1 from unnest(string_to_array(q,' ')) term where term<>'' and not(
      strpos(public.search_compact(v.name),public.search_compact(term))>0 or
      strpos(public.search_compact(v.address),public.search_compact(term))>0 or
      strpos(public.search_compact(v.category),public.search_compact(term))>0 or
      strpos(public.search_compact(v.category_label),public.search_compact(term))>0 or
      strpos(public.search_compact(v.rationale),public.search_compact(term))>0 or
      strpos(public.search_compact(v.area),public.search_compact(term))>0))
 ), with_stats as materialized (
   select x.*,coalesce((st.stats->>'positive')::integer,0) positive,coalesce((st.stats->>'negative')::integer,0) negative,
    coalesce((st.stats->>'saved_count')::integer,0) saved_count,st.stats->>'last_verified_at' last_verified_at
   from matched x cross join lateral (select private.place_stats(x.id) stats offset 0) st
 ), scored as (
   select x.*,case ordering
    when 'newest' then extract(epoch from x.created_at)
    when 'verified' then coalesce(extract(epoch from nullif(x.last_verified_at,'')::timestamptz),0)
    when 'distance' then -extensions.st_distancesphere(x.location,extensions.st_setsrid(extensions.st_makepoint(user_lng,user_lat),4326))
    when 'popular' then x.positive
    when 'controversial' then case when x.positive>0 and x.negative>0 then (x.positive+x.negative)*least(x.positive,x.negative)::float8/greatest(x.positive,x.negative) else 0 end
    else case when x.positive+x.negative=0 then 0 else
      (x.positive::float8/(x.positive+x.negative)+3.8416/(2*(x.positive+x.negative))-
      1.96*sqrt((x.positive::float8/(x.positive+x.negative)*(1-x.positive::float8/(x.positive+x.negative))+3.8416/(4*(x.positive+x.negative)))/(x.positive+x.negative))) / (1+3.8416/(x.positive+x.negative)) end end score
   from with_stats x
 ), page as (
   select * from scored order by case when ordering='relevance' then match_rank else 0 end, score desc nulls last,id limit 20 offset skip
 ), terms as (
   select distinct name term,'place' kind from visible union select distinct area,'area' from visible where area<>''
   union select distinct category_label,'category' from visible where category_label<>''
 ), text_suggestions as (
   select jsonb_build_object('term',term,'kind',kind) value,term,kind from terms
   where q<>'' and strpos(public.search_compact(term),public.search_compact(q))>0 order by kind,term limit 5
 ), station_suggestions as (
   select jsonb_build_object('term',s.name,'kind','station','station',jsonb_build_object('id',s.id,'name',s.name,'local_name',s.local_name,'kind',s.kind,'region',s.region_id,'lat',s.lat,'lng',s.lng)) value,s.name term,'station'::text kind
   from public.rail_stations s join public.rail_station_regions r on r.id=s.region_id
   where q<>'' and r.updated_at is not null and (strpos(public.search_compact(s.name),public.search_compact(q))>0 or strpos(public.search_compact(s.local_name),public.search_compact(q))>0)
    and exists(select 1 from visible v where extensions.st_dwithin(s.location,v.location::extensions.geography,2000))
   order by s.name,s.region_id,s.id limit 5
 ), suggestions as (select * from text_suggestions union all select * from station_suggestions)
 select jsonb_build_object('mode','full','items',coalesce((select jsonb_agg(to_jsonb(p)-'location'-'city'-'area'-'category_label'-'match_rank'-'score' order by case when ordering='relevance' then match_rank else 0 end,score desc nulls last,id) from page p),'[]'::jsonb),
 'total',(select count(*) from matched),'hasMore',(select count(*)>skip+20 from matched),
 'suggestions',coalesce((select jsonb_agg(value order by kind,term) from suggestions),'[]'::jsonb),
 'station',chosen,'stationsStatus',state) into result;
 return result;
end $$;
revoke all on function public.search_normalize(text),public.search_compact(text),public.search_city(text),public.search_area(text),public.search_category(text),public.search_map_places(jsonb) from public;
grant execute on function public.search_normalize(text),public.search_compact(text),public.search_city(text),public.search_area(text),public.search_category(text),public.search_map_places(jsonb) to anon,authenticated,service_role;

-- SQL Editor 적용도 로컬 마이그레이션과 같은 이력으로 기록합니다.
do $$ begin
 if to_regclass('supabase_migrations.schema_migrations') is not null then
  insert into supabase_migrations.schema_migrations(version,name,statements)
  values('20261008112237','map_public_search',array['SQL Editor: docs/sql/add-map-public-search.sql'])
  on conflict(version) do nothing;
 end if;
end $$;
commit;
notify pgrst, 'reload schema';

