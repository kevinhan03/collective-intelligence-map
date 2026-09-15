-- Google Places is no longer part of the live search path. Overture searches
-- run against the local index, while Kakao is the only metered provider.
update private.provider_settings
set daily_limit = 500,
    monthly_limit = 10000
where provider = 'kakao';

update private.provider_settings
set enabled = false
where provider = 'google';

-- Keep an abuse guard for writes, while allowing an active contributor to add
-- a useful batch of places in one session.
create or replace function private.submit_proposal(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); m public.theme_maps; p uuid:=(payload->>'placeId')::uuid; result_id uuid; lng double precision:=(payload->>'lng')::double precision; lat double precision:=(payload->>'lat')::double precision; auto boolean:=private.is_admin(); matches uuid[];
begin
 if not private.can_contribute() then raise exception '장소를 제안할 권한이 없습니다.' using errcode='42501'; end if;
 perform private.rate_limit('proposal',20);
 select * into m from public.theme_maps where id=(payload->>'mapId')::uuid and status='published';
 if m.id is null then raise exception '공개 맵을 찾을 수 없습니다.'; end if;
 if length(btrim(coalesce(payload->>'rationale',''))) not between 5 and 1000 then raise exception '추천 근거를 입력해 주세요.'; end if;
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
