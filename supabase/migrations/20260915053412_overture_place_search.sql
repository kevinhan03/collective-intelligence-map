-- Search-only inventory. Never copy community activity or unselected POIs into places.
create table public.our_search_places (
 source text not null check(source='overture'), source_id text not null check(length(source_id) between 1 and 300),
 primary_name text not null check(length(primary_name) between 1 and 120), alternate_names text[] not null default '{}',
 country_code text not null check(country_code ~ '^[A-Z]{2}$'), region text, locality text, address text not null default '',
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 category text, location extensions.geometry(Point,4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326)) stored,
 search_text text not null, release text not null, imported_at timestamptz not null default now(),
 primary key(source,source_id)
);
create index search_places_text on public.our_search_places using gin(search_text extensions.gin_trgm_ops);
create index search_places_location on public.our_search_places using gist(location);
alter table public.our_search_places enable row level security;
revoke all on public.our_search_places from anon,authenticated;
grant select,insert,update,delete on public.our_search_places to service_role;
alter table public.places add column source_type text not null default 'user' check(source_type in('user','overture','kakao','google'));
alter table public.places add column region text;
-- Preserve the existing external-id table, including administrator merge behavior.
alter table private.place_provider_refs drop constraint place_provider_refs_provider_check;
alter table private.place_provider_refs add constraint place_provider_refs_provider_check check(provider in('google','kakao','overture','osm'));
update public.places p set source_type=r.provider from private.place_provider_refs r where r.place_id=p.id;

create function public.search_overture_places(q text,m uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r),'[]') from (
 select 'overture' provider,s.source_id "externalId",s.primary_name label,s.address,s.latitude lat,s.longitude lng,s.category,s.locality,s.country_code "countryCode",'Overture Maps' attribution
 from public.our_search_places s join public.theme_maps t on t.id=m
 where t.status='published' and s.country_code=t.country and length(btrim(q)) between 2 and 100
 and s.location operator(extensions.&&) extensions.st_makeenvelope((t.bounds->>'west')::float,(t.bounds->>'south')::float,(t.bounds->>'east')::float,(t.bounds->>'north')::float,4326)
 and (s.search_text ilike '%'||replace(replace(replace(btrim(q),'\','\\'),'%','\%'),'_','\_')||'%' or s.search_text operator(extensions.%) btrim(q))
 order by (lower(s.primary_name)=lower(btrim(q))) desc,extensions.similarity(s.search_text,btrim(q)) desc,
 extensions.st_distance(s.location,extensions.st_centroid(extensions.st_makeenvelope((t.bounds->>'west')::float,(t.bounds->>'south')::float,(t.bounds->>'east')::float,(t.bounds->>'north')::float,4326))),s.source_id limit 20
 ) r
$$;
create function public.overture_place_details(external_id_value text,m uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('provider','overture','externalId',s.source_id,'label',s.primary_name,'address',s.address,'lat',s.latitude,'lng',s.longitude,'category',s.category,'locality',s.locality,'countryCode',s.country_code,'attribution','Overture Maps')
 from public.our_search_places s join public.theme_maps t on t.id=m where s.source='overture' and s.source_id=external_id_value and t.status='published' and t.country=s.country_code
 and s.location operator(extensions.&&) extensions.st_makeenvelope((t.bounds->>'west')::float,(t.bounds->>'south')::float,(t.bounds->>'east')::float,(t.bounds->>'north')::float,4326)
$$;
revoke all on function public.search_overture_places(text,uuid),public.overture_place_details(text,uuid) from public,anon,authenticated;
grant execute on function public.search_overture_places(text,uuid),public.overture_place_details(text,uuid) to service_role;
grant select on public.theme_maps to service_role;

create or replace function public.search_internal_places(q text,m uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r),'[]') from (
 select p.id,p.name,p.address,p.category,p.city locality,extensions.st_y(p.location) lat,extensions.st_x(p.location) lng
 from public.places p join public.theme_maps t on t.id=m where t.status='published' and p.status in('active','pending') and p.country=t.country and length(btrim(q)) between 2 and 100
 and p.location operator(extensions.&&) extensions.st_makeenvelope((t.bounds->>'west')::float,(t.bounds->>'south')::float,(t.bounds->>'east')::float,(t.bounds->>'north')::float,4326)
 and (p.name ilike '%'||replace(replace(replace(btrim(q),'\','\\'),'%','\%'),'_','\_')||'%' or p.name operator(extensions.%) btrim(q))
 order by (lower(p.name)=lower(btrim(q))) desc,extensions.similarity(p.name,btrim(q)) desc,
 extensions.st_distance(p.location,extensions.st_centroid(extensions.st_makeenvelope((t.bounds->>'west')::float,(t.bounds->>'south')::float,(t.bounds->>'east')::float,(t.bounds->>'north')::float,4326))),p.id limit 20) r
$$;

-- A conservative match: exactly normalized name, <=15m AND identical nonempty
-- address. Multiple matches remain separate; no fuzzy automatic merge.
create or replace function private.submit_proposal(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); m public.theme_maps; p uuid:=(payload->>'placeId')::uuid; result_id uuid; lng double precision:=(payload->>'lng')::double precision; lat double precision:=(payload->>'lat')::double precision; auto boolean:=private.is_admin(); matches uuid[];
begin
 if not private.can_contribute() then raise exception '장소를 제안할 권한이 없습니다.' using errcode='42501'; end if;
 perform private.rate_limit('proposal',5);
 select * into m from public.theme_maps where id=(payload->>'mapId')::uuid and status='published';
 if m.id is null then raise exception '공개 맵을 찾을 수 없습니다.'; end if;
 if length(btrim(coalesce(payload->>'rationale',''))) not between 5 and 1000 then raise exception '추천 근거를 입력해 주세요.'; end if;
 -- Same lock as administrator merges. Low-volume MVP; replace with ordered
 -- spatial-cell locks before scaling writes. Covers cross-provider races.
 perform pg_advisory_xact_lock(781234);
 if p is null then
  if lng is null or lat is null or not (lng between -180 and 180 and lat between -90 and 90) or lng<(m.bounds->>'west')::float or lng>(m.bounds->>'east')::float or lat<(m.bounds->>'south')::float or lat>(m.bounds->>'north')::float then raise exception '맵의 도시 범위 안에 있는 장소만 제안해 주세요.'; end if;
  if length(btrim(coalesce(payload->>'name',''))) not between 1 and 120 then raise exception '장소 이름을 입력해 주세요.'; end if;
  select array_agg(v.id) into matches from public.places v where v.status in('active','pending') and v.country=m.country
   and lower(btrim(v.name))=lower(btrim(payload->>'name'))
   and btrim(coalesce(payload->>'address',''))<>'' and lower(btrim(v.address))=lower(btrim(payload->>'address'))
   and extensions.st_dwithin(v.location::extensions.geography,extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,15);
  if cardinality(matches)=1 then p:=matches[1]; end if;
  if p is null then
   insert into public.places(name,address,category,location,country,city,created_by,status) values(btrim(payload->>'name'),coalesce(payload->>'address',''),coalesce(nullif(payload->>'category',''),'기타'),extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326),m.country,m.city,u,case when auto then 'active' else 'pending' end) returning id into p;
   insert into private.place_field_sources(place_id,source_note,reviewed_by,reviewed_at) values(p,coalesce(nullif(btrim(payload->>'sourceNote'),''),'사용자가 직접 알고 있는 장소 정보를 등록했습니다.'),case when auto then u end,case when auto then now() end);
  end if;
 else
  if not exists(select 1 from public.places v where v.id=p and v.status in('active','pending') and v.country=m.country
   and (private.visible_place(v.id) or private.pending_visible_place(v.id) or v.created_by=u)
   and v.location operator(extensions.&&) extensions.st_makeenvelope((m.bounds->>'west')::float,(m.bounds->>'south')::float,(m.bounds->>'east')::float,(m.bounds->>'north')::float,4326)) then raise exception '기존 장소를 찾을 수 없습니다.'; end if;
 end if;
 select id into result_id from public.map_places where map_id=m.id and place_id=p;
 if result_id is not null then return result_id; end if;
 insert into public.map_places(map_id,place_id,added_by,rationale,status) values(m.id,p,u,btrim(payload->>'rationale'),case when auto then 'approved' else 'pending' end) returning id into result_id;
 if auto then update public.places set status='active' where id=p; end if;
 return result_id;
end $$;
create or replace function private.submit_resolved_proposal(payload jsonb,u uuid,p text,external_id_value text,allow_ref boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; existing uuid; pid uuid; original_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 if p not in('overture','kakao') or not allow_ref or length(coalesce(external_id_value,'')) not between 1 and 300 then raise exception 'Unsupported provider persistence'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform private.require_user();
 perform pg_advisory_xact_lock(781234);
 select r.place_id into existing from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status in('active','pending');
 if existing is null and exists(select 1 from private.place_provider_refs r where r.provider=p and r.external_id=external_id_value) then raise exception '이 장소는 현재 추가할 수 없습니다.'; end if;
 payload:=payload-'placeId';
 if existing is not null then payload:=jsonb_set(payload,'{placeId}',to_jsonb(existing)); end if;
 result_id:=private.submit_proposal(payload);
 select place_id into pid from public.map_places where id=result_id;
 insert into private.place_provider_refs(place_id,provider,external_id) values(pid,p,external_id_value) on conflict(provider,external_id) do nothing;
 if existing is null then
  update public.places set source_type=p where id=pid and created_by=u and created_at=now();
  update private.place_field_sources f set source_kind='licensed' where f.place_id=pid and exists(select 1 from public.places v where v.id=pid and v.created_by=u and v.created_at=now());
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);
 return result_id;
end $$;
create or replace function private.resolve_provider_place(p text,external_id_value text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('placeId',v.id,'name',v.name,'address',v.address,'category',v.category,'lat',extensions.st_y(v.location),'lng',extensions.st_x(v.location))
 from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status in('active','pending')
$$;
-- These remain service-role-only RPCs. Explicitly remove inherited PUBLIC access.
revoke all on function private.resolve_provider_place(text,text) from public,anon,authenticated;
NOTIFY pgrst, 'reload schema';
