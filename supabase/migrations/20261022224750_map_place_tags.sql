-- Map-scoped place classification. Existing theme_maps.tags stays unchanged.
begin;
do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.map_places'::regclass and conname='map_places_map_id_id_key') then alter table public.map_places add constraint map_places_map_id_id_key unique(map_id,id); end if; end $$;
create table if not exists public.map_tags (
 id uuid primary key default gen_random_uuid(),
 map_id uuid not null references public.theme_maps(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 20 and name !~ '[[:space:]#]'),
 name_key text generated always as (lower(normalize(name,NFKC))) stored,
 archived boolean not null default false,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(map_id,id)
);
create unique index if not exists map_tags_active_name on public.map_tags(map_id,name_key) where not archived;
create table if not exists public.map_place_tags (
 map_id uuid not null,
 map_place_id uuid not null,
 tag_id uuid not null,
 primary key(map_place_id,tag_id),
 foreign key(map_id,map_place_id) references public.map_places(map_id,id) on delete cascade,
 foreign key(map_id,tag_id) references public.map_tags(map_id,id) on delete cascade
);
create index if not exists map_place_tags_lookup on public.map_place_tags(map_id,tag_id,map_place_id);
alter table public.map_tags enable row level security;
alter table public.map_place_tags enable row level security;

-- Kept private because the policy must check suspension without exposing roles.
create or replace function private.can_manage_map_tags(m uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and not exists(select 1 from private.user_roles where user_id=auth.uid() and suspended)
 and exists(select 1 from public.theme_maps where id=m and
 (private.is_admin() or (kind='creator' and owner_id=auth.uid())))
$$;
revoke all on function private.can_manage_map_tags(uuid) from public;
grant execute on function private.can_manage_map_tags(uuid) to anon,authenticated;
drop policy if exists map_tags_read on public.map_tags;
create policy map_tags_read on public.map_tags for select to anon,authenticated
 using(not archived and (private.public_map(map_id) or private.can_manage_map_tags(map_id)));
drop policy if exists map_place_tags_read on public.map_place_tags;
create policy map_place_tags_read on public.map_place_tags for select to anon,authenticated
 using((private.public_map_place(map_place_id) or private.can_manage_map_tags(map_id))
 and exists(select 1 from public.map_tags t where t.id=tag_id and t.map_id=map_place_tags.map_id and not t.archived));
-- All writes go through the authenticated, atomic command; no direct table writes.
revoke all on public.map_tags,public.map_place_tags from public,anon,authenticated;
grant select on public.map_tags,public.map_place_tags to anon,authenticated;

create or replace function public.map_tag_catalog(m uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('tags',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by created_at,id)
 from public.map_tags where map_id=m and not archived),'[]'::jsonb),
 'canManage',private.can_manage_map_tags(m))
 where exists(select 1 from public.theme_maps where id=m)
$$;
create or replace function public.map_place_tag_assignments(m uuid, ids uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(x.map_place_id,x.tag_ids),'{}'::jsonb) from (
 select a.map_place_id,jsonb_agg(a.tag_id order by a.tag_id) tag_ids
 from public.map_place_tags a join public.map_tags t on t.id=a.tag_id and not t.archived
 where a.map_id=m and a.map_place_id=any(ids) and cardinality(ids)<=501 group by a.map_place_id) x
$$;
create or replace function public.map_place_tag_ids(target uuid) returns uuid[]
language sql stable security invoker set search_path='' as $$
 select coalesce(array_agg(a.tag_id order by a.tag_id),'{}'::uuid[])
 from public.map_place_tags a join public.map_tags t on t.id=a.tag_id and not t.archived where a.map_place_id=target
$$;
revoke all on function public.map_tag_catalog(uuid),public.map_place_tag_assignments(uuid,uuid[]),public.map_place_tag_ids(uuid) from public;
grant execute on function public.map_tag_catalog(uuid),public.map_place_tag_assignments(uuid,uuid[]),public.map_place_tag_ids(uuid) to anon,authenticated;

-- Definer is required for the atomic restricted write; explicit user, suspension,
-- map permission and same-map checks precede every mutation. Public wrapper is invoker.
create or replace function private.map_tag_command(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); m uuid:=(payload->>'mapId')::uuid;
 a text:=payload->>'action'; tid uuid:=(payload->>'id')::uuid; target uuid:=(payload->>'mapPlaceId')::uuid;
 label text; selected_ids uuid[];
begin
 if not private.can_manage_map_tags(m) then raise exception '이 지도의 태그를 수정할 권한이 없습니다.' using errcode='42501'; end if;
 perform private.rate_limit('map_tags',120);
 perform 1 from public.theme_maps where id=m for update;
 if a in('create','rename') then
   label:=normalize(regexp_replace(btrim(coalesce(payload->>'name','')),'^#+','','g'),NFKC);
   if char_length(label) not between 1 and 20 or label ~ '[[:space:]#]' then raise exception '태그는 공백 없이 1~20자로 입력해 주세요.'; end if;
   if a='create' then
     if (select count(*) from public.map_tags where map_id=m and not archived)>=30 then raise exception '태그는 지도당 최대 30개입니다.'; end if;
     insert into public.map_tags(map_id,name,created_by) values(m,label,u) returning id into tid;
   else
     update public.map_tags set name=label where id=tid and map_id=m and not archived;
     if not found then raise exception '태그를 찾을 수 없습니다.'; end if;
   end if;
 elsif a='archive' then
   update public.map_tags set archived=true where id=tid and map_id=m and not archived;
   if not found then raise exception '태그를 찾을 수 없습니다.'; end if;
 elsif a='assign' then
   if not exists(select 1 from public.map_places where id=target and map_id=m and status<>'archived') then raise exception '이 지도에 포함된 장소를 선택해 주세요.'; end if;
   if jsonb_typeof(payload->'tagIds') is distinct from 'array' or jsonb_array_length(payload->'tagIds')>10 then raise exception '장소에는 최대 10개 태그를 지정할 수 있습니다.'; end if;
   select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into selected_ids from jsonb_array_elements_text(payload->'tagIds');
   if exists(select 1 from unnest(selected_ids) x where not exists(select 1 from public.map_tags where id=x and map_id=m and not archived)) then raise exception '이 지도에서 만든 활성 태그만 선택해 주세요.'; end if;
   delete from public.map_place_tags where map_place_id=target and tag_id not in(select id from public.map_tags where archived);
   insert into public.map_place_tags(map_id,map_place_id,tag_id) select m,target,x from unnest(selected_ids) x on conflict do nothing;
 else raise exception '알 수 없는 태그 작업입니다.';
 end if;
 return jsonb_build_object('id',tid,'ok',true);
end $$;
create or replace function public.map_tag_command(payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.map_tag_command(payload) $$;
revoke all on function private.map_tag_command(jsonb),public.map_tag_command(jsonb) from public;
grant execute on function private.map_tag_command(jsonb),public.map_tag_command(jsonb) to authenticated;

create or replace function public.search_map_places(payload jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 m uuid:=(payload->>'mapId')::uuid; q text:=public.search_normalize(payload->>'q');
 reg text:=coalesce(payload->>'region',''); ordering text:=coalesce(payload->>'sort','relevance');
 skip integer:=coalesce((payload->>'offset')::integer,0); station_id text:=payload->>'stationId';
 user_lat float8:=(payload->>'lat')::float8; user_lng float8:=(payload->>'lng')::float8;
 selected_tags uuid[];
 station public.rail_stations; chosen jsonb:=null; result jsonb; state text; map_bounds jsonb; is_creator boolean;
begin
 if not exists(select 1 from public.theme_maps where id=m and status='published') then return null; end if;
 if length(coalesce(payload->>'q',''))>100 or length(reg)>80 or skip not between 0 and 1000000
 or ordering not in('relevance','distance','newest','verified','controversial','popular')
 or (user_lat is null)<>(user_lng is null) or user_lat not between -90 and 90 or user_lng not between -180 and 180
 or (ordering='distance' and user_lat is null) then raise exception 'Invalid search input' using errcode='22023'; end if;
 if jsonb_typeof(coalesce(payload->'tagIds','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(payload->'tagIds','[]'::jsonb))>10 then raise exception 'Invalid tags' using errcode='22023'; end if;
 select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into selected_tags from jsonb_array_elements_text(coalesce(payload->'tagIds','[]'::jsonb));
 select bounds,kind='creator' into map_bounds,is_creator from public.theme_maps where id=m;
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
   select mp.id,mp.place_id,mp.map_id,p.name,p.address,p.category,public.map_place_tag_ids(mp.id) tag_ids,
    extensions.st_y(p.location) lat,extensions.st_x(p.location) lng,mp.rationale,mp.status,mp.added_by,
    coalesce(pr.handle,'탈퇴한 기여자') handle,mp.created_at,mp.position,p.location,
    public.search_city(p.address) city,public.search_area(p.address) area,public.search_category(p.category) category_label
   from public.map_places mp join public.places p on p.id=mp.place_id left join public.profiles pr on pr.id=mp.added_by
   where mp.map_id=m and mp.status in('approved','disputed') and p.status='active' and private.public_map_place(mp.id)
 ), matched as (
   select v.*,case when q='' then 3 when public.search_compact(v.name)=public.search_compact(q) then 0
    when starts_with(public.search_compact(v.name),public.search_compact(q)) then 1
    when strpos(public.search_compact(v.name),public.search_compact(q))>0 then 2 else 3 end match_rank,
    case when station_id is not null then round(extensions.st_distance(v.location::extensions.geography,station.location))::integer end station_distance_m
   from visible v where (reg='' or v.city=reg) and selected_tags <@ v.tag_ids
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
   select * from scored order by case when ordering='relevance' then match_rank else 0 end, case when ordering='relevance' and is_creator then position end, case when is_creator and ordering='relevance' then 0 else score end desc nulls last,id limit 20 offset skip
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
 select jsonb_build_object('mode','full','items',coalesce((select jsonb_agg(to_jsonb(p)-'location'-'city'-'area'-'category_label'-'match_rank'-'score' order by case when ordering='relevance' then match_rank else 0 end,case when ordering='relevance' and is_creator then position end,case when is_creator and ordering='relevance' then 0 else score end desc nulls last,id) from page p),'[]'::jsonb),
 'total',(select count(*) from matched),'hasMore',(select count(*)>skip+20 from matched),
 'suggestions',coalesce((select jsonb_agg(value order by kind,term) from suggestions),'[]'::jsonb),
 'station',chosen,'stationsStatus',state) into result;
 return result;
end $$;

commit;
