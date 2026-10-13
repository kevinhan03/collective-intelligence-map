-- 전체를 실행하세요. 기존 파일과 데이터는 삭제하지 마세요.
begin;
-- Small metadata-only migration. Existing places and community maps are preserved.
do $$ begin
 if pg_database_size(current_database()) > 450*1024*1024 then raise exception 'DB 용량이 450MB를 초과했습니다. 적용을 중단합니다.'; end if;
end $$;
alter table public.theme_maps add column if not exists kind text not null default 'community' check(kind in('community','creator'));
alter table public.theme_maps add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.theme_maps add column if not exists position integer not null default 0;
alter table public.theme_maps add column if not exists cover_path text;
alter table public.theme_maps add column if not exists hidden_at timestamptz;
alter table public.theme_maps add column if not exists hidden_reason text;
alter table public.map_places add column if not exists position integer not null default 0;
create table if not exists public.creator_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 instagram text not null default '' check(instagram='' or instagram ~ '^https://www\.instagram\.com/[A-Za-z0-9_.]{1,30}/$'),
 featured_map_id uuid references public.theme_maps(id) on delete set null
);
alter table public.creator_profiles enable row level security;
create or replace function private.public_map(m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.theme_maps t where t.id=m and t.status='published' and t.hidden_at is null and (t.kind='community' or (t.owner_id is not null and not exists(select 1 from private.user_roles r where r.user_id=t.owner_id and r.suspended))))
$$;
create or replace function private.owns_creator_map(m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.theme_maps where id=m and kind='creator' and owner_id=(select auth.uid()))
$$;
revoke all on function private.owns_creator_map(uuid) from public;
grant execute on function private.owns_creator_map(uuid) to anon,authenticated,service_role;
drop policy if exists creator_profile_read on public.creator_profiles;
create policy creator_profile_read on public.creator_profiles for select using(user_id=(select auth.uid()) or exists(select 1 from public.theme_maps m where m.owner_id=user_id and private.public_map(m.id)));
grant select on public.creator_profiles to anon,authenticated;
-- Replacing every SELECT policy avoids an older permissive policy leaking hidden maps.
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='theme_maps' and cmd='SELECT' loop execute format('drop policy %I on public.theme_maps',p.policyname); end loop;
 for p in select policyname from pg_policies where schemaname='public' and tablename='map_places' and cmd='SELECT' loop execute format('drop policy %I on public.map_places',p.policyname); end loop;
end $$;
create policy creator_aware_map_read on public.theme_maps for select using(private.public_map(id) or private.owns_creator_map(id) or (private.is_admin() and (kind='community' or status='published')));
create policy creator_aware_place_read on public.map_places for select using(
 private.public_map_place(id) or (private.is_admin() and exists(select 1 from public.theme_maps m where m.id=map_id and (m.kind='community' or m.status='published'))) or
 (exists(select 1 from public.theme_maps m where m.id=map_id and m.kind='community') and (private.pending_map_place(id) or added_by=(select auth.uid()))) or private.owns_creator_map(map_id)
);
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='places' and cmd='SELECT' loop execute format('drop policy %I on public.places',p.policyname); end loop;
end $$;
create or replace function private.admin_visible_creator_place(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_admin() and (not exists(select 1 from public.map_places mp join public.theme_maps m on m.id=mp.map_id where mp.place_id=p and m.kind='creator') or exists(select 1 from public.map_places mp join public.theme_maps m on m.id=mp.map_id where mp.place_id=p and (m.kind='community' or m.status='published')))
$$;
revoke all on function private.admin_visible_creator_place(uuid) from public;
grant execute on function private.admin_visible_creator_place(uuid) to anon,authenticated;
create policy creator_aware_physical_read on public.places for select using(private.visible_place(id) or private.pending_visible_place(id) or created_by=(select auth.uid()) or private.admin_visible_creator_place(id));
-- New draft physical places cannot be added to the public pending-review feed.
create or replace function private.pending_visible_place(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.map_places mp join public.theme_maps m on m.id=mp.map_id where mp.place_id=p and m.kind='community' and private.pending_map_place(mp.id))
$$;
create table if not exists private.creator_cover_cleanup(path text primary key, created_at timestamptz not null default now());
revoke all on private.creator_cover_cleanup from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('creator-map-covers','creator-map-covers',false,5242880,array['image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table private.moderation_actions add column if not exists map_id uuid references public.theme_maps;
create or replace function private.creator_command(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); a text:=payload->>'action'; m public.theme_maps; pid uuid; mid uuid:=(payload->>'mapId')::uuid; item public.map_places; ids uuid[]; i integer; country_value text; lng float8; lat float8; result jsonb; old_path text; draft_place public.places; canonical uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,723));
 perform private.rate_limit('creator',120);
 if a in('add_place','status') then perform pg_advisory_xact_lock(781234); end if;
 if a='profile' then
  if length(coalesce(payload->>'displayName',''))>80 or length(coalesce(payload->>'bio',''))>500 then raise exception '소개 또는 이름이 너무 깁니다.'; end if;
  if nullif(payload->>'featuredMapId','') is not null and not exists(select 1 from public.theme_maps where id=(payload->>'featuredMapId')::uuid and owner_id=u and kind='creator' and private.public_map(id)) then raise exception '본인의 공개 지도만 대표로 지정할 수 있습니다.'; end if;
  insert into public.creator_profiles(user_id,display_name,instagram,featured_map_id) values(u,coalesce(payload->>'displayName',''),coalesce(payload->>'instagram',''),nullif(payload->>'featuredMapId','')::uuid)
   on conflict(user_id) do update set display_name=excluded.display_name,instagram=excluded.instagram,featured_map_id=excluded.featured_map_id;
  update public.profiles set bio=coalesce(payload->>'bio','') where id=u;
  return jsonb_build_object('ok',true);
 end if;
 if a='create' then
  if (select count(*) from public.theme_maps where owner_id=u and kind='creator' and status<>'archived')>=10 then raise exception '보관되지 않은 지도는 최대 10개입니다.'; end if;
  if length(btrim(coalesce(payload->>'title',''))) not between 1 and 80 or length(coalesce(payload->>'description',''))>500 then raise exception '제목과 소개 길이를 확인해 주세요.'; end if;
  country_value:=payload->>'country';
  if country_value not in('KR','JP','world') or country_value is null then raise exception '검색 범위를 선택해 주세요.'; end if;
  mid:=pg_catalog.gen_random_uuid();
  insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,search_scope,kind,owner_id,position)
   values(mid,'c-'||replace(mid::text,'-',''),btrim(payload->>'title'),coalesce(payload->>'description',''),'크리에이터가 직접 고른 장소',case when country_value='world' then null else country_value end,'',
    case country_value when 'KR' then '{"west":124,"south":33,"east":132,"north":39}'::jsonb when 'JP' then '{"west":122,"south":24,"east":146,"north":46}'::jsonb else '{"west":-180,"south":-85,"east":180,"north":85}'::jsonb end,
    case when country_value='world' then 'world' else 'country' end,'creator',u,(select coalesce(max(position),-1)+1 from public.theme_maps where owner_id=u));
  return jsonb_build_object('id',mid);
 end if;
 if a='order_maps' then
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'ids');
  if ids is null or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or exists(select 1 from unnest(ids) x where not exists(select 1 from public.theme_maps where id=x and owner_id=u and kind='creator')) then raise exception '본인의 지도만 한 번씩 정렬할 수 있습니다.'; end if;
  for i in 1..cardinality(ids) loop update public.theme_maps set position=i-1 where id=ids[i]; end loop;
  return jsonb_build_object('ok',true);
 end if;
 select * into m from public.theme_maps where id=mid for update;
 if m.id is null or m.kind<>'creator' then raise exception '크리에이터 지도가 없습니다.'; end if;
 if a='hide' then
  if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  if length(btrim(coalesce(payload->>'reason',''))) not between 5 and 1000 then raise exception '조치 사유를 입력해 주세요.'; end if;
  update public.theme_maps set hidden_at=now(),hidden_reason=btrim(payload->>'reason') where id=mid;
  update public.creator_profiles set featured_map_id=null where featured_map_id=mid;
  insert into private.moderation_actions(actor_id,action,map_id,reason,before_state,after_state) values(u,'hide_creator_map',mid,btrim(payload->>'reason'),to_jsonb(m),jsonb_build_object('hidden',true));
  return jsonb_build_object('ok',true);
 end if;
 if m.owner_id is distinct from u then raise exception '본인의 지도만 수정할 수 있습니다.' using errcode='42501'; end if;
 if a='update' then
  if length(btrim(coalesce(payload->>'title',''))) not between 1 and 80 or length(coalesce(payload->>'description',''))>500 then raise exception '제목과 소개 길이를 확인해 주세요.'; end if;
  -- Scope cannot silently strand already-added places. Validate every association.
  country_value:=payload->>'country';
  if country_value is null or country_value not in('KR','JP','world') then raise exception '검색 범위를 선택해 주세요.'; end if;
  if country_value<>'world' and exists(select 1 from public.map_places mp join public.places p on p.id=mp.place_id where mp.map_id=mid and mp.status<>'archived' and p.country<>country_value) then raise exception '범위 밖 장소를 먼저 제거해 주세요.'; end if;
  update public.theme_maps set title=btrim(payload->>'title'),description=coalesce(payload->>'description',''),country=case when country_value='world' then null else country_value end,search_scope=case when country_value='world' then 'world' else 'country' end,
   bounds=case country_value when 'KR' then '{"west":124,"south":33,"east":132,"north":39}'::jsonb when 'JP' then '{"west":122,"south":24,"east":146,"north":46}'::jsonb else '{"west":-180,"south":-85,"east":180,"north":85}'::jsonb end where id=mid;
 elsif a='status' then
  if payload->>'status' not in('draft','published','archived') or payload->>'status' is null then raise exception '잘못된 지도 상태입니다.'; end if;
  if m.status='archived' and payload->>'status'<>'archived' and (select count(*) from public.theme_maps where owner_id=u and kind='creator' and status<>'archived')>=10 then raise exception '지도는 최대 10개입니다.'; end if;
  if payload->>'status'='published' then
   if m.hidden_at is not null then raise exception '운영자가 숨긴 지도는 공개할 수 없습니다.'; end if;
   perform pg_advisory_xact_lock(781234);
   if exists(select 1 from public.map_places mp join public.places p on p.id=mp.place_id where mp.map_id=mid and mp.status<>'archived' and (length(btrim(mp.rationale)) not between 5 and 1000 or length(btrim(p.address))=0 or p.status in('archived','merged') or not public.proposal_scope_contains(m.search_scope,m.country,m.bounds,p.country,extensions.st_x(p.location),extensions.st_y(p.location)))) then raise exception '장소 정보와 검색 범위를 확인해 주세요.'; end if;
   -- A matching public place may have appeared since the draft was saved.
   for draft_place in select p.* from public.places p join public.map_places mp on mp.place_id=p.id where mp.map_id=mid and mp.status<>'archived' and p.status='pending' and p.created_by=u loop
    select p.id into canonical from public.places p where p.id<>draft_place.id and p.status='active' and private.visible_place(p.id) and p.country=draft_place.country and lower(btrim(p.name))=lower(btrim(draft_place.name)) and lower(btrim(p.address))=lower(btrim(draft_place.address)) and extensions.st_dwithin(p.location::extensions.geography,draft_place.location::extensions.geography,15) order by p.id limit 1;
    if canonical is not null then
     update private.place_provider_refs set place_id=canonical where place_id=draft_place.id;
     if exists(select 1 from public.map_places where map_id=mid and place_id=canonical) then
      update public.map_places target set status='draft',rationale=source.rationale,position=source.position from public.map_places source where target.map_id=mid and target.place_id=canonical and target.status='archived' and source.map_id=mid and source.place_id=draft_place.id;
      update public.map_places set status='archived' where map_id=mid and place_id=draft_place.id;
     else update public.map_places set place_id=canonical where map_id=mid and place_id=draft_place.id; end if;
    end if;
   end loop;
   update public.places p set status='active' where p.status='pending' and p.created_by=u and exists(select 1 from public.map_places mp where mp.map_id=mid and mp.place_id=p.id and mp.status<>'archived');
   if exists(select 1 from public.map_places mp join public.places p on p.id=mp.place_id where mp.map_id=mid and mp.status<>'archived' and p.status<>'active') then raise exception '공개할 수 없는 장소가 있습니다.'; end if;
   update public.map_places set status='approved' where map_id=mid and status='draft';
  end if;
  update public.theme_maps set status=payload->>'status' where id=mid;
  if payload->>'status'<>'published' then update public.creator_profiles set featured_map_id=null where featured_map_id=mid; end if;
  if payload->>'status'='archived' and m.cover_path is not null then insert into private.creator_cover_cleanup(path) values(m.cover_path) on conflict do nothing; update public.theme_maps set cover_path=null where id=mid; end if;
 elsif a='add_place' then
  if m.status='archived' or m.hidden_at is not null then raise exception '보관되거나 숨김 처리된 지도는 수정할 수 없습니다.'; end if;
  if length(btrim(coalesce(payload->>'rationale',''))) not between 5 and 1000 then raise exception '추천 이유는 5~1,000자입니다.'; end if;
  perform pg_advisory_xact_lock(781234);
  pid:=nullif(payload->>'placeId','')::uuid;
  if pid is null then
   country_value:=coalesce(nullif(payload->>'countryCode',''),m.country); lng:=(payload->>'lng')::float8; lat:=(payload->>'lat')::float8;
   if country_value is null or country_value !~ '^[A-Z]{2}$' or lng is null or lat is null or not public.proposal_scope_contains(m.search_scope,m.country,m.bounds,country_value,lng,lat) then raise exception '지도 범위 안의 위치를 확인해 주세요.'; end if;
   if length(btrim(coalesce(payload->>'name',''))) not between 1 and 120 or length(btrim(coalesce(payload->>'address',''))) not between 1 and 250 then raise exception '장소 이름과 주소를 입력해 주세요.'; end if;
   select p.id into pid from public.places p where (private.visible_place(p.id) or p.created_by=u) and p.status in('active','pending') and p.country=country_value and lower(btrim(p.name))=lower(btrim(payload->>'name')) and lower(btrim(p.address))=lower(btrim(payload->>'address')) and extensions.st_dwithin(p.location::extensions.geography,extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography,15) order by p.id limit 1;
   if pid is null then
    insert into public.places(name,address,category,location,country,city,status,created_by) values(btrim(payload->>'name'),btrim(payload->>'address'),coalesce(nullif(payload->>'category',''),'기타'),extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326),country_value,coalesce(payload->>'locality',''),case when m.status='published' then 'active' else 'pending' end,u) returning id into pid;
    insert into private.place_field_sources(place_id,source_note) values(pid,coalesce(nullif(payload->>'sourceNote',''),'사용자가 직접 알고 있는 장소 정보를 등록했습니다.'));
   end if;
  end if;
  if not exists(select 1 from public.places p where p.id=pid and p.status in('active','pending') and (private.visible_place(p.id) or p.created_by=u) and public.proposal_scope_contains(m.search_scope,m.country,m.bounds,p.country,extensions.st_x(p.location),extensions.st_y(p.location))) then raise exception '공개 또는 본인의 장소를 선택해 주세요.'; end if;
  select * into item from public.map_places where map_id=mid and place_id=pid;
  if item.id is not null and item.status<>'archived' then return jsonb_build_object('id',item.id,'placeId',pid,'status',item.status,'created',false); end if;
  if (select count(*) from public.map_places where map_id=mid and status<>'archived')>=200 then raise exception '지도당 장소는 최대 200개입니다.'; end if;
  if m.status='published' then update public.places set status='active' where id=pid and status='pending' and created_by=u; end if;
  if item.id is null then insert into public.map_places(map_id,place_id,added_by,rationale,status,position) values(mid,pid,u,btrim(payload->>'rationale'),case when m.status='published' then 'approved' else 'draft' end,(select coalesce(max(position),-1)+1 from public.map_places where map_id=mid)) returning * into item;
  else update public.map_places set rationale=btrim(payload->>'rationale'),status=case when m.status='published' then 'approved' else 'draft' end where id=item.id returning * into item; end if;
  return jsonb_build_object('id',item.id,'placeId',pid,'status',item.status,'created',true);
 elsif a in('edit_place','remove_place') then
  if a='edit_place' and length(btrim(coalesce(payload->>'rationale',''))) not between 5 and 1000 then raise exception '추천 이유는 5~1,000자입니다.'; end if;
  update public.map_places set rationale=case when a='edit_place' then btrim(payload->>'rationale') else rationale end,status=case when a='remove_place' then 'archived' else status end,updated_at=now() where id=(payload->>'id')::uuid and map_id=mid;
  if not found then raise exception '이 지도의 장소가 아닙니다.'; end if;
 elsif a='order_places' then
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'ids');
  if ids is null or cardinality(ids)<>(select count(*) from public.map_places where map_id=mid and status<>'archived') or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or exists(select 1 from unnest(ids) x where not exists(select 1 from public.map_places where id=x and map_id=mid and status<>'archived')) then raise exception '현재 지도의 모든 장소를 한 번씩 정렬해 주세요.'; end if;
  for i in 1..cardinality(ids) loop update public.map_places set position=i-1 where id=ids[i]; end loop;
 elsif a='cover_reserve' then
  if m.status='archived' or m.hidden_at is not null then raise exception '보관되거나 숨긴 지도에는 커버를 올릴 수 없습니다.'; end if;
  old_path:=u::text||'/'||mid::text||'/'||pg_catalog.gen_random_uuid()::text||'.webp';
  insert into private.creator_cover_cleanup(path) values(old_path);
  return jsonb_build_object('path',old_path);
 elsif a='cover' then
  if m.status='archived' or m.hidden_at is not null then raise exception '보관되거나 숨긴 지도의 커버는 수정할 수 없습니다.'; end if;
  old_path:=nullif(payload->>'path','');
  if old_path is not null and (old_path not like u::text||'/'||mid::text||'/%' or not exists(select 1 from private.creator_cover_cleanup where path=old_path and created_at>now()-interval '1 hour') or not exists(select 1 from storage.objects where bucket_id='creator-map-covers' and name=old_path)) then raise exception '예약된 커버만 사용할 수 있습니다.'; end if;
  if m.cover_path is not null then insert into private.creator_cover_cleanup(path) values(m.cover_path) on conflict do nothing; end if;
  update public.theme_maps set cover_path=old_path where id=mid;
  delete from private.creator_cover_cleanup where path=old_path;
 else raise exception '지원하지 않는 작업입니다.';
 end if;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.creator_command(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.creator_command(payload) $$;
revoke all on function private.creator_command(jsonb),public.creator_command(jsonb) from public,anon;
grant execute on function private.creator_command(jsonb),public.creator_command(jsonb) to authenticated;

create or replace function private.creator_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=private.require_user(); begin
 return jsonb_build_object('profile',(select to_jsonb(c) from public.creator_profiles c where user_id=u), 'maps',coalesce((select jsonb_agg(to_jsonb(m) order by m.position,m.id) from public.theme_maps m where m.kind='creator' and m.owner_id=u),'[]'::jsonb));
end $$;
create or replace function public.creator_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$ select private.creator_snapshot() $$;
revoke all on function private.creator_snapshot() from public,anon;
grant execute on function private.creator_snapshot() to authenticated;
create or replace function public.creator_places(m uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',mp.id,'place_id',p.id,'map_id',mp.map_id,'name',p.name,'address',p.address,'category',p.category,'lat',extensions.st_y(p.location),'lng',extensions.st_x(p.location),'rationale',mp.rationale,'status',mp.status,'added_by',mp.added_by,'handle',pr.handle,'positive',0,'negative',0,'saved_count',0,'created_at',mp.created_at,'last_verified_at',null,'position',mp.position) order by mp.position,mp.id),'[]'::jsonb)
 from public.map_places mp join public.places p on p.id=mp.place_id left join public.profiles pr on pr.id=mp.added_by
 where mp.map_id=m and mp.status<>'archived' and (private.owns_creator_map(m) or private.public_map_place(mp.id))
$$;
revoke all on function public.creator_snapshot(),public.creator_places(uuid) from public,anon,authenticated;
grant execute on function public.creator_snapshot() to authenticated;
grant execute on function public.creator_places(uuid) to anon,authenticated;
-- Public catalog is invoker/RLS-filtered. Drafts/hidden maps cannot appear here.
create or replace function public.creator_catalog() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('map',to_jsonb(m),'handle',p.handle,'profile',to_jsonb(c)) order by m.position,m.id),'[]'::jsonb)
 from public.theme_maps m join public.profiles p on p.id=m.owner_id left join public.creator_profiles c on c.user_id=m.owner_id where m.kind='creator' and private.public_map(m.id)
$$;
revoke all on function public.creator_catalog() from public;
grant execute on function public.creator_catalog() to anon,authenticated;
create or replace function private.creator_cover_jobs() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(path),'[]'::jsonb) from (select path from private.creator_cover_cleanup q where created_at<now()-interval '1 hour' and not exists(select 1 from public.theme_maps m where m.cover_path=q.path) order by created_at limit 100) jobs
$$;
create or replace function private.creator_cover_cleaned(target text) returns void language sql security definer set search_path='' as $$ delete from private.creator_cover_cleanup where path=target and not exists(select 1 from public.theme_maps where cover_path=target) $$;
create or replace function public.creator_cover_jobs() returns jsonb language sql security invoker set search_path='' as $$ select private.creator_cover_jobs() $$;
create or replace function public.creator_cover_cleaned(target text) returns void language sql security invoker set search_path='' as $$ select private.creator_cover_cleaned(target) $$;
revoke all on function private.creator_cover_jobs(),private.creator_cover_cleaned(text),public.creator_cover_jobs(),public.creator_cover_cleaned(text) from public,anon,authenticated;
grant execute on function private.creator_cover_jobs(),private.creator_cover_cleaned(text),public.creator_cover_jobs(),public.creator_cover_cleaned(text) to service_role;
-- Stop visitor proposals before they can create a creator-map association.
create or replace function private.guard_creator_association() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.theme_maps m where m.id=new.map_id and m.kind='creator' and m.owner_id is distinct from new.added_by) then raise exception '크리에이터 지도에는 소유자만 장소를 추가할 수 있습니다.' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists guard_creator_association on public.map_places;
create trigger guard_creator_association before insert on public.map_places for each row execute function private.guard_creator_association();
notify pgrst,'reload schema';

create or replace function public.search_overture_places(q text,m uuid) returns jsonb
language plpgsql stable security invoker set search_path='' set plan_cache_mode=force_custom_plan as $$
declare t public.theme_maps; query text:=public.search_normalize(q); pattern text;
 target_country text; extent extensions.geometry;
begin
 select * into t from public.theme_maps where id=m and (private.public_map(id) or private.owns_creator_map(id) or (current_user='service_role' and kind='creator'));
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
 where (private.public_map(t.id) or private.owns_creator_map(t.id) or (current_user='service_role' and t.kind='creator')) and s.source='overture' and s.source_id=external_id_value
 and public.proposal_scope_contains(t.search_scope,t.country,t.bounds,s.country_code,s.longitude,s.latitude)
$$;
create or replace function public.search_internal_places(q text,m uuid) returns jsonb
language plpgsql stable security invoker set search_path='' set plan_cache_mode=force_custom_plan as $$
declare t public.theme_maps; query text:=public.search_normalize(q); pattern text; target_country text; extent extensions.geometry;
begin
 select * into t from public.theme_maps where id=m and (private.public_map(id) or private.owns_creator_map(id) or (current_user='service_role' and kind='creator'));
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


create or replace function public.search_map_places(payload jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 m uuid:=(payload->>'mapId')::uuid; q text:=public.search_normalize(payload->>'q');
 reg text:=coalesce(payload->>'region',''); ordering text:=coalesce(payload->>'sort','relevance');
 skip integer:=coalesce((payload->>'offset')::integer,0); station_id text:=payload->>'stationId';
 user_lat float8:=(payload->>'lat')::float8; user_lng float8:=(payload->>'lng')::float8;
 station public.rail_stations; chosen jsonb:=null; result jsonb; state text; map_bounds jsonb; is_creator boolean;
begin
 if not exists(select 1 from public.theme_maps where id=m and status='published') then return null; end if;
 if length(coalesce(payload->>'q',''))>100 or length(reg)>80 or skip not between 0 and 1000000
 or ordering not in('relevance','distance','newest','verified','controversial','popular')
 or (user_lat is null)<>(user_lng is null) or user_lat not between -90 and 90 or user_lng not between -180 and 180
 or (ordering='distance' and user_lat is null) then raise exception 'Invalid search input' using errcode='22023'; end if;
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
   select mp.id,mp.place_id,mp.map_id,p.name,p.address,p.category,
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
grant execute on function private.public_map(uuid), private.public_map_place(uuid) to service_role;

create or replace function private.guard_creator_vote() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.map_places mp join public.theme_maps m on m.id=mp.map_id where mp.id=new.map_place_id and m.kind='creator') then raise exception '크리에이터 지도는 소유자가 지정한 순서로 제공됩니다.' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists guard_creator_vote on public.map_place_votes;
create trigger guard_creator_vote before insert or update on public.map_place_votes for each row execute function private.guard_creator_vote();
-- Anonymous voting is an optional earlier feature, not a creator prerequisite.
do $$ begin
 if to_regclass('public.anonymous_map_place_votes') is not null then
  execute 'drop trigger if exists guard_creator_vote on public.anonymous_map_place_votes';
  execute 'create trigger guard_creator_vote before insert or update on public.anonymous_map_place_votes for each row execute function private.guard_creator_vote()';
 end if;
end $$;
-- Small separate moderation queue for whole-map reports, without changing old target constraints.
create table if not exists private.creator_map_reports (
 id uuid primary key default pg_catalog.gen_random_uuid(), map_id uuid not null references public.theme_maps,
 reporter_id uuid references public.profiles on delete set null, reason text not null check(length(reason) between 5 and 1000),
 status text not null default 'open' check(status in('open','resolved')), created_at timestamptz not null default now()
);
revoke all on private.creator_map_reports from public,anon,authenticated;

create or replace function private.creator_report(m uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();begin
 perform private.rate_limit('creator_report',20);
 if not exists(select 1 from public.theme_maps where id=m and kind='creator' and private.public_map(id)) then raise exception '공개 지도를 찾을 수 없습니다.'; end if;
 if not exists(select 1 from private.creator_map_reports where map_id=m and reporter_id=u and status='open') then insert into private.creator_map_reports(map_id,reporter_id,reason) values(m,u,reason); end if;
end $$;
create or replace function public.creator_report(m uuid,reason text) returns void language sql security invoker set search_path='' as $$ select private.creator_report(m,reason) $$;
revoke all on function private.creator_report(uuid,text),public.creator_report(uuid,text) from public,anon;
grant execute on function private.creator_report(uuid,text),public.creator_report(uuid,text) to authenticated;
create or replace function private.creator_admin_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 return jsonb_build_object('reports',coalesce((select jsonb_agg(to_jsonb(x)) from (select r.*,m.title,m.slug,m.hidden_at from private.creator_map_reports r join public.theme_maps m on m.id=r.map_id where r.status='open' order by r.created_at limit 200) x),'[]'::jsonb),'actions',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from private.moderation_actions where map_id is not null order by created_at desc limit 50) x),'[]'::jsonb));
end $$;
create or replace function public.creator_admin_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$ select private.creator_admin_snapshot() $$;
revoke all on function private.creator_admin_snapshot(),public.creator_admin_snapshot() from public,anon;
grant execute on function private.creator_admin_snapshot(),public.creator_admin_snapshot() to authenticated;
create or replace function private.creator_resolve_report(target uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare r private.creator_map_reports; u uuid:=private.require_user();begin
 if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 if length(btrim(reason)) not between 5 and 1000 then raise exception '사유는 5~1,000자입니다.'; end if;
 select * into r from private.creator_map_reports where id=target for update;
 if r.id is null then raise exception '신고가 없습니다.'; end if;
 update private.creator_map_reports set status='resolved' where id=target;
 insert into private.moderation_actions(actor_id,action,map_id,reason,before_state,after_state) values(u,'resolve_creator_report',r.map_id,reason,to_jsonb(r),jsonb_build_object('status','resolved'));
end $$;
create or replace function public.creator_resolve_report(target uuid,reason text) returns void language sql security invoker set search_path='' as $$ select private.creator_resolve_report(target,reason) $$;
revoke all on function private.creator_resolve_report(uuid,text),public.creator_resolve_report(uuid,text) from public,anon;
grant execute on function private.creator_resolve_report(uuid,text),public.creator_resolve_report(uuid,text) to authenticated;
-- Signed provider submissions use the same owner transaction and canonical reference lock.
create or replace function private.creator_add_resolved(payload jsonb,u uuid,p text,external_id_value text) returns jsonb language plpgsql security definer set search_path='' as $$
declare original_sub text:=current_setting('request.jwt.claim.sub',true); existing uuid; result jsonb; pid uuid; begin
 if p not in('overture','kakao') or length(coalesce(external_id_value,'')) not between 1 and 300 then raise exception '올바른 공급자 참조가 아닙니다.'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform private.require_user();
 -- Same lock order as creator_command, preventing concurrent map/reference inversion.
 perform pg_advisory_xact_lock(hashtextextended(u::text,723));
 perform pg_advisory_xact_lock(781234);
 select r.place_id into existing from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status in('active','pending') and (private.visible_place(v.id) or v.created_by=u);
 payload:=payload-'placeId';
 if existing is not null then payload:=jsonb_set(payload,'{placeId}',to_jsonb(existing)); end if;
 result:=private.creator_command(payload||'{"action":"add_place"}'::jsonb);
 pid:=(result->>'placeId')::uuid;
 insert into private.place_provider_refs(place_id,provider,external_id) values(pid,p,external_id_value) on conflict(provider,external_id) do nothing;
 update public.places set source_type=p where id=pid and created_by=u and created_at=now();
 update private.place_field_sources f set source_kind='licensed' where place_id=pid and exists(select 1 from public.places v where v.id=pid and v.created_by=u and v.created_at=now());
 perform set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);
 return result;
end $$;
create or replace function public.creator_add_resolved(payload jsonb,u uuid,p text,external_id_value text) returns jsonb language sql security invoker set search_path='' as $$ select private.creator_add_resolved(payload,u,p,external_id_value) $$;
revoke all on function private.creator_add_resolved(jsonb,uuid,text,text),public.creator_add_resolved(jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function private.creator_add_resolved(jsonb,uuid,text,text),public.creator_add_resolved(jsonb,uuid,text,text) to service_role;
alter table private.creator_cover_cleanup enable row level security;
alter table private.creator_map_reports enable row level security;
do $$ begin if pg_database_size(current_database()) > 450*1024*1024 then raise exception '적용 후 DB 용량이 450MB를 초과했습니다.'; end if; end $$;

revoke all on function private.guard_creator_association(),private.guard_creator_vote() from public,anon,authenticated;

-- Community submissions retain their approval rules while ignoring private creator references.
create or replace function private.submit_resolved_proposal(payload jsonb,u uuid,p text,external_id_value text,allow_ref boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; existing uuid; pid uuid; original_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 if p not in('overture','kakao') or not allow_ref or length(coalesce(external_id_value,'')) not between 1 and 300 then raise exception 'Unsupported provider persistence'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform private.require_user();
 perform pg_advisory_xact_lock(781234);
 select r.place_id into existing from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status in('active','pending') and (private.visible_place(v.id) or private.pending_visible_place(v.id) or v.created_by=u);
 if existing is null and exists(select 1 from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status not in('active','pending')) then raise exception '이 장소는 현재 추가할 수 없습니다.'; end if;
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

do $$ begin
 if to_regclass('supabase_migrations.schema_migrations') is not null then
  insert into supabase_migrations.schema_migrations(version,name,statements) values('20261013173542','creator_maps',array['SQL Editor creator maps']) on conflict(version) do nothing;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
