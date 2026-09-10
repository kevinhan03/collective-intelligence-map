-- Fresh project only. Review before applying. Transactional bootstrap of approved MVP schema.
BEGIN;

-- 20260909165405_community_mvp.sql
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 handle text not null unique check(handle ~ '^[a-zA-Z0-9_]{3,30}$'),
 bio text not null default '' check(length(bio)<=500), avatar_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.user_roles (user_id uuid primary key references auth.users on delete cascade, role text not null check(role in ('contributor','admin')), suspended boolean not null default false);
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.user_roles where user_id=auth.uid() and role='admin' and not suspended) $$;
create function private.can_contribute() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.user_roles where user_id=auth.uid() and not suspended) $$;
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id,handle) values(new.id,'u_'||replace(new.id::text,'-','')::varchar(24)); return new; end $$;
create trigger new_user_profile after insert on auth.users for each row execute function private.new_profile();

create table public.theme_maps (
 id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null, description text not null,
 rules text not null, country text not null check(country ~ '^[A-Z]{2}$'), city text not null, tags text[] not null default '{}',
 bounds jsonb not null, status text not null default 'draft' check(status in('draft','published','archived')),
 created_at timestamptz not null default now()
);
create table public.places (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120), address text not null default '' check(length(address)<=250),
 category text not null default '패션', location extensions.geometry(Point,4326) not null,
 country text not null, city text not null,
 status text not null default 'pending' check(status in('pending','active','archived','merged')),
 created_by uuid references public.profiles on delete set null, merged_into_id uuid references public.places,
 created_at timestamptz not null default now(), check(merged_into_id is null or merged_into_id<>id),
 check(extensions.st_x(location) between -180 and 180 and extensions.st_y(location) between -90 and 90)
);
create index places_location_gist on public.places using gist(location);
create index places_name_trgm on public.places using gin(name extensions.gin_trgm_ops);
create index places_creator on public.places(created_by);
create table private.place_field_sources (
 place_id uuid primary key references public.places, source_note text not null check(length(source_note) between 15 and 1000),
 source_kind text not null default 'independent_submission' check(source_kind in('independent_submission','licensed')),
 reviewed_by uuid references public.profiles, reviewed_at timestamptz
);
create table private.place_provider_refs (
 id uuid primary key default gen_random_uuid(), place_id uuid not null references public.places,
 provider text not null check(provider in('google','kakao')), external_id text not null check(length(external_id) between 1 and 300),
 refreshed_at timestamptz not null default now(), unique(provider,external_id)
);
create index provider_refs_place on private.place_provider_refs(place_id);
create table public.map_places (
 id uuid primary key default gen_random_uuid(), map_id uuid not null references public.theme_maps,
 place_id uuid not null references public.places, added_by uuid references public.profiles on delete set null,
 rationale text not null check(length(rationale) between 15 and 1000),
 status text not null default 'pending' check(status in('draft','pending','approved','rejected','disputed','archived')),
 merged_into_id uuid references public.map_places, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(map_id,place_id)
);
create index map_places_map_status on public.map_places(map_id,status);
create index map_places_place on public.map_places(place_id);
create index map_places_author on public.map_places(added_by);
create table public.map_place_votes (
 map_place_id uuid not null references public.map_places, user_id uuid not null references public.profiles on delete cascade,
 value smallint not null check(value in(-1,1)), updated_at timestamptz not null default now(), primary key(map_place_id,user_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), map_place_id uuid not null references public.map_places, author_id uuid references public.profiles on delete set null,
 body text not null check(length(body) between 2 and 2000), status text not null default 'visible' check(status in('visible','hidden','deleted')),
 created_at timestamptz not null default now()
);
create index comments_place_time on public.comments(map_place_id,created_at);
create index comments_author on public.comments(author_id);
create table public.saves (user_id uuid not null references public.profiles on delete cascade,map_place_id uuid not null references public.map_places,created_at timestamptz not null default now(),primary key(user_id,map_place_id));
create table public.map_follows (user_id uuid not null references public.profiles on delete cascade,map_id uuid not null references public.theme_maps,created_at timestamptz not null default now(),primary key(user_id,map_id));
create table public.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid references public.profiles on delete set null,
 map_place_id uuid references public.map_places, comment_id uuid references public.comments,
 reason text not null check(length(reason) between 5 and 1000),status text not null default 'open' check(status in('open','resolved')),
 created_at timestamptz not null default now(),check(num_nonnulls(map_place_id,comment_id)=1)
);
create unique index report_open_place on public.reports(reporter_id,map_place_id) where status='open';
create unique index report_open_comment on public.reports(reporter_id,comment_id) where status='open';
create table private.moderation_actions (
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles on delete set null,
 action text not null, place_id uuid references public.places, map_place_id uuid references public.map_places, report_id uuid references public.reports,comment_id uuid references public.comments,
 reason text not null, before_state jsonb,after_state jsonb,created_at timestamptz not null default now()
);
create table private.write_limits(user_id uuid references public.profiles on delete cascade,bucket text,period timestamptz,count integer not null,primary key(user_id,bucket,period));
create index votes_user on public.map_place_votes(user_id);
create index saves_place on public.saves(map_place_id);
create index follows_map on public.map_follows(map_id);
create index reports_reporter on public.reports(reporter_id);

create function private.public_map(m uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.theme_maps where id=m and status='published') $$;
create function private.public_map_place(m uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.map_places mp join public.places p on p.id=mp.place_id where mp.id=m and mp.status in('approved','disputed') and p.status='active' and private.public_map(mp.map_id)) $$;
create function private.visible_place(p uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.map_places where place_id=p and private.public_map_place(id)) $$;

alter table public.profiles enable row level security;
alter table public.theme_maps enable row level security;
alter table public.places enable row level security;
alter table public.map_places enable row level security;
alter table public.map_place_votes enable row level security;
alter table public.comments enable row level security;
alter table public.saves enable row level security;
alter table public.map_follows enable row level security;
alter table public.reports enable row level security;
alter table private.user_roles enable row level security;
alter table private.place_field_sources enable row level security;
alter table private.place_provider_refs enable row level security;
alter table private.moderation_actions enable row level security;
alter table private.write_limits enable row level security;

create policy profiles_read on public.profiles for select using(true);
create policy maps_read on public.theme_maps for select using(status='published' or private.is_admin());
create policy places_read on public.places for select using(private.visible_place(id) or created_by=(select auth.uid()) or private.is_admin());
create policy map_places_read on public.map_places for select using(private.public_map_place(id) or added_by=(select auth.uid()) or private.is_admin());
create policy votes_read on public.map_place_votes for select using(user_id=(select auth.uid()) or private.is_admin());
create policy comments_read on public.comments for select using((status='visible' and private.public_map_place(map_place_id)) or author_id=(select auth.uid()) or private.is_admin());
create policy saves_read on public.saves for select using(user_id=(select auth.uid()));
create policy follows_read on public.map_follows for select using(user_id=(select auth.uid()));
create policy reports_read on public.reports for select using(reporter_id=(select auth.uid()) or private.is_admin());
-- No direct mutation grants: all writes go through authenticated, rate-limited transactions.
revoke all on public.profiles,public.theme_maps,public.places,public.map_places,public.map_place_votes,public.comments,public.saves,public.map_follows,public.reports from anon,authenticated;
grant select on public.profiles,public.theme_maps,public.places,public.map_places,public.comments to anon,authenticated;
grant select on public.map_place_votes,public.saves,public.map_follows,public.reports to authenticated;
revoke all on all tables in schema private from anon,authenticated;
revoke execute on all functions in schema private from public;
grant execute on function private.is_admin(),private.can_contribute(),private.public_map(uuid),private.public_map_place(uuid),private.visible_place(uuid) to anon,authenticated;

create function private.map_stats(m uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('place_count',(select count(*) from public.map_places where map_id=m and private.public_map_place(id)), 'follower_count',(select count(*) from public.map_follows where map_id=m),'contributor_count',(select count(distinct added_by) from public.map_places where map_id=m and private.public_map_place(id))) where private.public_map(m) or private.is_admin()
$$;
create function public.map_stats(m uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.map_stats(m) $$;
create function private.place_stats(m uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('positive',(select count(*) from public.map_place_votes where map_place_id=m and value=1),'negative',(select count(*) from public.map_place_votes where map_place_id=m and value=-1),'saved_count',(select count(*) from public.saves where map_place_id=m),'last_verified_at',(select max(updated_at) from public.map_place_votes where map_place_id=m)) where private.public_map_place(m) or private.is_admin()
$$;
create function private.viewer_role() returns text language sql stable security definer set search_path='' as $$ select coalesce((select role from private.user_roles where user_id=auth.uid() and not suspended),'member') $$;
create function public.viewer_role() returns text language sql stable security invoker set search_path='' as $$ select private.viewer_role() $$;

create function public.map_places_in_bounds(m uuid,w double precision,s double precision,e double precision,n double precision) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r),'[]'::jsonb) from (
 select mp.id,mp.place_id,mp.map_id,p.name,p.address,p.category,extensions.st_y(p.location) lat,extensions.st_x(p.location) lng,mp.rationale,mp.status,mp.added_by,coalesce(pr.handle,'탈퇴한 기여자') handle,mp.created_at,
 (private.place_stats(mp.id)->>'positive')::int positive,(private.place_stats(mp.id)->>'negative')::int negative,(private.place_stats(mp.id)->>'saved_count')::int saved_count,private.place_stats(mp.id)->>'last_verified_at' last_verified_at
 from public.map_places mp join public.places p on p.id=mp.place_id left join public.profiles pr on pr.id=mp.added_by
 where mp.map_id=m and private.public_map_place(mp.id) and s<n and s>=-90 and n<=90 and w between -180 and 180 and e between -180 and 180
 and (case when w<=e then p.location operator(extensions.&&) extensions.st_makeenvelope(w,s,e,n,4326) else p.location operator(extensions.&&) extensions.st_makeenvelope(w,s,180,n,4326) or p.location operator(extensions.&&) extensions.st_makeenvelope(-180,s,e,n,4326) end)
 order by mp.id limit 501) r
$$;
create function public.search_internal_places(q text,m uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r),'[]'::jsonb) from(select p.id,p.name,p.address,p.category,extensions.st_y(p.location) lat,extensions.st_x(p.location) lng from public.places p join public.theme_maps t on t.id=m where p.status='active' and p.country=t.country and p.city=t.city and length(q) between 2 and 100 and p.name ilike '%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%' order by p.name,p.id limit 20)r
$$;
revoke execute on function public.map_stats(uuid),public.viewer_role(),public.map_places_in_bounds(uuid,double precision,double precision,double precision,double precision),public.search_internal_places(text,uuid) from public;
revoke execute on function private.map_stats(uuid),private.place_stats(uuid),private.viewer_role() from public;
grant execute on function private.map_stats(uuid),private.place_stats(uuid) to anon,authenticated;
grant execute on function private.viewer_role(),public.viewer_role() to authenticated;
grant execute on function public.map_stats(uuid),public.map_places_in_bounds(uuid,double precision,double precision,double precision,double precision),public.search_internal_places(text,uuid) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_select on storage.objects for select to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);


-- 20260909165406_community_operations.sql
create function private.require_user() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null or not exists(select 1 from auth.users where id=u) then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
 if exists(select 1 from private.user_roles where user_id=u and suspended) then raise exception '활동이 제한된 계정입니다.' using errcode='42501'; end if;
 return u; end $$;
create function private.rate_limit(bucket_name text,max_count integer) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c integer; begin
 insert into private.write_limits(user_id,bucket,period,count) values(u,bucket_name,date_trunc('hour',now()),1)
 on conflict(user_id,bucket,period) do update set count=private.write_limits.count+1 returning count into c;
 if c>max_count then raise exception '요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' using errcode='P0001'; end if;
 end $$;

create function private.community_command(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); a text:=payload->>'action'; target uuid:=(payload->>'id')::uuid; v integer; old_status text; result_id uuid; src public.places; dest public.places; mp record; other uuid; reason text:=btrim(payload->>'reason');
begin
 perform private.rate_limit('write',120);
 if a in('vote','comment') and not private.can_contribute() then raise exception '초대 기여자만 참여할 수 있습니다.' using errcode='42501'; end if;
 if a in('vote','save','comment') and not private.public_map_place(target) then raise exception '공개된 장소를 찾을 수 없습니다.'; end if;
 if a='vote' then
  v:=(payload->>'value')::integer;
  if v not in(-1,0,1) or v is null then raise exception '잘못된 투표'; end if;
  if v=0 then delete from public.map_place_votes where map_place_id=target and user_id=u;
  else insert into public.map_place_votes(map_place_id,user_id,value) values(target,u,v) on conflict(map_place_id,user_id) do update set value=excluded.value,updated_at=now(); end if;
 elsif a='save' then
  if (payload->>'enabled')::boolean then insert into public.saves(user_id,map_place_id) values(u,target) on conflict do nothing; else delete from public.saves where user_id=u and map_place_id=target; end if;
 elsif a='follow' then
  if not private.public_map(target) then raise exception '공개 맵이 아닙니다.'; end if;
  if (payload->>'enabled')::boolean then insert into public.map_follows(user_id,map_id) values(u,target) on conflict do nothing; else delete from public.map_follows where user_id=u and map_id=target; end if;
 elsif a='comment' then
  perform private.rate_limit('comment',20);
  insert into public.comments(map_place_id,author_id,body) values(target,u,btrim(payload->>'body')) returning id into result_id;
 elsif a='delete_comment' then
  update public.comments set status='deleted' where id=target and author_id=u;
  if not found then raise exception '댓글을 삭제할 수 없습니다.'; end if;
 elsif a='report' then
  perform private.rate_limit('report',10);
  if payload->>'target'='map_place' and private.public_map_place(target) then
   insert into public.reports(reporter_id,map_place_id,reason) values(u,target,reason) on conflict do nothing;
  elsif payload->>'target'='comment' and exists(select 1 from public.comments where id=target and status='visible' and private.public_map_place(map_place_id)) then
   insert into public.reports(reporter_id,comment_id,reason) values(u,target,reason) on conflict do nothing;
  else raise exception '신고 대상을 찾을 수 없습니다.'; end if;
 elsif a='profile' then
  if payload->>'avatar_path' is not null and (payload->>'avatar_path' not like u::text||'/%' or not exists(select 1 from storage.objects where bucket_id='avatars' and name=payload->>'avatar_path')) then raise exception '올바른 프로필 이미지를 선택해 주세요.'; end if;
  update public.profiles set handle=payload->>'handle',bio=coalesce(payload->>'bio',''),avatar_path=coalesce(payload->>'avatar_path',avatar_path),updated_at=now() where id=u;
 elsif a in('moderate','resolve_report','hide_comment','merge','provider_settings') then
  if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  if a<>'provider_settings' and (reason is null or length(reason) not between 5 and 1000) then raise exception '처리 사유를 입력해 주세요.'; end if;
  if a='moderate' then
   select status into old_status from public.map_places where id=target for update;
   if not found then raise exception '제안을 찾을 수 없습니다.'; end if;
   if not ((old_status in('pending','rejected') and payload->>'status' in('approved','rejected')) or (old_status in('approved','disputed') and payload->>'status' in('approved','disputed','archived'))) then raise exception '허용되지 않은 상태 변경입니다.'; end if;
   if payload->>'status'='approved' then
    if not exists(select 1 from public.map_places m join private.place_field_sources f on f.place_id=m.place_id join public.places p on p.id=m.place_id where m.id=target and p.status in('pending','active')) then raise exception '독립적인 장소 출처를 검토해야 승인할 수 있습니다.'; end if;
    update private.place_field_sources set reviewed_by=u,reviewed_at=now() where place_id=(select place_id from public.map_places where id=target);
    update public.places set status='active' where id=(select place_id from public.map_places where id=target);
   end if;
   update public.map_places set status=payload->>'status',updated_at=now() where id=target;
   insert into private.moderation_actions(actor_id,action,map_place_id,reason,before_state,after_state) values(u,a,target,reason,jsonb_build_object('status',old_status),jsonb_build_object('status',payload->>'status'));
  elsif a='resolve_report' then
   update public.reports set status='resolved' where id=target and status='open';
   if not found then raise exception '처리할 신고가 없습니다.'; end if;
   insert into private.moderation_actions(actor_id,action,report_id,reason) values(u,a,target,reason);
  elsif a='hide_comment' then
   update public.comments set status='hidden' where id=target;
   if not found then raise exception '댓글이 없습니다.'; end if;
   insert into private.moderation_actions(actor_id,action,comment_id,reason) values(u,a,target,reason);
  elsif a='merge' then
   if target=(payload->>'targetId')::uuid then raise exception '동일 장소는 병합할 수 없습니다.'; end if;
   -- Global transaction lock keeps cross-map merges serialized and avoids conflicting votes.
   perform pg_advisory_xact_lock(781234);
   lock table public.map_place_votes,public.saves,public.comments,public.reports,public.map_places,private.place_provider_refs in share row exclusive mode;
   select * into src from public.places where id=target for update;
   select * into dest from public.places where id=(payload->>'targetId')::uuid for update;
   if src.id is null or dest.id is null or src.status='merged' or dest.status<>'active' or src.country<>dest.country or src.city<>dest.city then raise exception '병합 대상 상태 또는 도시가 올바르지 않습니다.'; end if;
   for mp in select * from public.map_places where place_id=src.id loop
    select id into other from public.map_places where map_id=mp.map_id and place_id=dest.id;
    if other is null then update public.map_places set place_id=dest.id,updated_at=now() where id=mp.id;
    else
     insert into public.map_place_votes(map_place_id,user_id,value,updated_at) select other,user_id,value,updated_at from public.map_place_votes where map_place_id=mp.id
     on conflict(map_place_id,user_id) do update set value=excluded.value,updated_at=excluded.updated_at where excluded.updated_at>public.map_place_votes.updated_at;
     delete from public.map_place_votes where map_place_id=mp.id;
     insert into public.saves(user_id,map_place_id,created_at) select user_id,other,created_at from public.saves where map_place_id=mp.id on conflict do nothing;
     delete from public.saves where map_place_id=mp.id;
     update public.comments set map_place_id=other where map_place_id=mp.id;
     update public.reports r set status='resolved' where r.map_place_id=mp.id and r.status='open' and exists(select 1 from public.reports r2 where r2.map_place_id=other and r2.reporter_id=r.reporter_id and r2.status='open');
     update public.reports set map_place_id=other where map_place_id=mp.id;
     update public.map_places set status='archived',merged_into_id=other,updated_at=now() where id=mp.id;
    end if;
   end loop;
   update private.place_provider_refs set place_id=dest.id where place_id=src.id;
   update public.places set status='merged',merged_into_id=dest.id where id=src.id;
   insert into private.moderation_actions(actor_id,action,place_id,reason,before_state,after_state) values(u,a,src.id,reason,to_jsonb(src),jsonb_build_object('merged_into_id',dest.id));
  else
   update private.provider_settings set enabled=(payload->>'enabled')::boolean,daily_limit=(payload->>'daily_limit')::int,monthly_limit=(payload->>'monthly_limit')::int,monthly_budget_micros=(payload->>'monthly_budget_micros')::bigint where provider=payload->>'provider';
   insert into private.moderation_actions(actor_id,action,reason,after_state) values(u,a,'Provider usage settings updated',payload);
  end if;
 else raise exception '지원하지 않는 작업입니다.'; end if;
 return jsonb_build_object('ok',true,'id',result_id);
end $$;
create function public.community_command(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.community_command(payload) $$;

create function private.submit_proposal(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); m public.theme_maps; p uuid:=(payload->>'placeId')::uuid; result_id uuid; lng double precision:=(payload->>'lng')::double precision; lat double precision:=(payload->>'lat')::double precision;
begin
 if not private.can_contribute() then raise exception '장소 제안은 초대 기여자에게 열려 있습니다.' using errcode='42501'; end if;
 perform private.rate_limit('proposal',5);
 select * into m from public.theme_maps where id=(payload->>'mapId')::uuid and status='published';
 if m.id is null then raise exception '공개 맵을 찾을 수 없습니다.'; end if;
 if p is null then
  if lng is null or lat is null or lng<(m.bounds->>'west')::float or lng>(m.bounds->>'east')::float or lat<(m.bounds->>'south')::float or lat>(m.bounds->>'north')::float then raise exception '맵의 도시 범위 안에 있는 장소만 제안해 주세요.'; end if;
  insert into public.places(name,address,category,location,country,city,created_by) values(btrim(payload->>'name'),coalesce(payload->>'address',''),coalesce(payload->>'category','패션'),extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326),m.country,m.city,u) returning id into p;
  insert into private.place_field_sources(place_id,source_note) values(p,btrim(payload->>'sourceNote'));
 else
  if not exists(select 1 from public.places where id=p and status='active' and country=m.country and city=m.city and private.visible_place(id)) then raise exception '기존 장소를 찾을 수 없습니다.'; end if;
 end if;
 insert into public.map_places(map_id,place_id,added_by,rationale) values(m.id,p,u,btrim(payload->>'rationale')) returning id into result_id;
 return result_id;
end $$;
create function public.submit_proposal(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.submit_proposal(payload) $$;

create function private.admin_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 return jsonb_build_object(
 'proposals',(select coalesce(jsonb_agg(r),'[]') from(select mp.*,p.name,p.address,p.status place_status,extensions.st_x(p.location) lng,extensions.st_y(p.location) lat,f.source_note,t.title map_title,pr.handle from public.map_places mp join public.places p on p.id=mp.place_id join public.theme_maps t on t.id=mp.map_id left join private.place_field_sources f on f.place_id=p.id left join public.profiles pr on pr.id=mp.added_by where mp.status in('pending','approved','disputed') order by (mp.status='pending') desc,mp.created_at limit 100)r),
 'reports',(select coalesce(jsonb_agg(r),'[]') from(select r.*,c.body,p.name from public.reports r left join public.comments c on c.id=r.comment_id left join public.map_places mp on mp.id=r.map_place_id left join public.places p on p.id=mp.place_id where r.status='open' order by r.created_at limit 100)r),
 'actions',(select coalesce(jsonb_agg(r),'[]') from(select * from private.moderation_actions order by created_at desc limit 50)r),
 'duplicates',(select coalesce(jsonb_agg(r),'[]') from(select a.id source_id,a.name source_name,b.id target_id,b.name target_name,round(extensions.st_distance(a.location::extensions.geography,b.location::extensions.geography)) distance_m from public.places a join public.places b on a.id<>b.id and a.country=b.country and a.city=b.city and a.status<>'merged' and b.status='active' and extensions.st_dwithin(a.location::extensions.geography,b.location::extensions.geography,100) where a.id<b.id or a.status='pending' limit 50)r));
 end $$;
create function public.admin_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_snapshot() $$;
revoke execute on all functions in schema private from public;
revoke execute on function public.community_command(jsonb),public.submit_proposal(jsonb),public.admin_snapshot() from public;
grant execute on function private.community_command(jsonb),private.submit_proposal(jsonb),private.admin_snapshot(),public.community_command(jsonb),public.submit_proposal(jsonb),public.admin_snapshot() to authenticated;


-- 20260909165407_provider_budget.sql
create table private.provider_settings(provider text primary key check(provider in('google','kakao')),enabled boolean not null default false,daily_limit integer not null default 100 check(daily_limit between 0 and 10000),monthly_limit integer not null default 1000 check(monthly_limit between 0 and 100000),monthly_budget_micros bigint not null default 10000000 check(monthly_budget_micros between 0 and 1000000000));
insert into private.provider_settings(provider) values('google'),('kakao');
create table private.provider_usage_events(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles on delete set null,provider text not null,operation text not null,status text not null default 'reserved',estimated_micros bigint not null,latency_ms integer,created_at timestamptz not null default now());
create index provider_usage_time on private.provider_usage_events(provider,created_at);
create table private.provider_sessions(id uuid primary key,user_id uuid not null references public.profiles on delete cascade,map_id uuid not null references public.theme_maps,created_at timestamptz not null default now(),requests integer not null default 0,ended boolean not null default false);
alter table private.provider_settings enable row level security;
alter table private.provider_usage_events enable row level security;
alter table private.provider_sessions enable row level security;
revoke all on private.provider_settings,private.provider_usage_events,private.provider_sessions from anon,authenticated;

create function private.reserve_provider(p text,op text,u uuid,m uuid,session_id uuid,cost bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare settings private.provider_settings; sid private.provider_sessions; r uuid; daily integer; monthly integer; amount bigint;
begin
 if cost<0 or cost>1000000 or op not in('autocomplete','details','keyword') then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from private.user_roles where user_id=u and not suspended) or not private.public_map(m) then raise exception 'Forbidden'; end if;
 select * into settings from private.provider_settings where provider=p for update;
 if not found or not settings.enabled then raise exception '외부 검색이 일시 중지되어 있습니다.'; end if;
 select count(*) filter(where created_at>=date_trunc('day',now())),count(*),coalesce(sum(estimated_micros),0) into daily,monthly,amount from private.provider_usage_events where provider=p and created_at>=date_trunc('month',now());
 if daily>=settings.daily_limit or monthly>=settings.monthly_limit or amount+cost>settings.monthly_budget_micros then raise exception '외부 검색 예산에 도달했습니다.'; end if;
 if (select count(*) from private.provider_usage_events where user_id=u and created_at>now()-interval '1 hour')>=60 then raise exception '검색 요청 한도에 도달했습니다.'; end if;
 if p='google' then
  insert into private.provider_sessions(id,user_id,map_id) values(session_id,u,m) on conflict do nothing;
  select * into sid from private.provider_sessions where id=session_id for update;
  if sid.user_id<>u or sid.map_id<>m or sid.ended or sid.created_at<now()-interval '15 minutes' or sid.requests>=20 then raise exception '검색 세션이 만료되었습니다. 다시 검색해 주세요.'; end if;
  if op='details' and sid.requests=0 then raise exception '검색부터 시작해 주세요.'; end if;
  update private.provider_sessions set requests=requests+1,ended=(op='details') where id=session_id;
 end if;
 insert into private.provider_usage_events(user_id,provider,operation,estimated_micros) values(u,p,op,cost) returning id into r;
 return r;
end $$;
create function public.reserve_provider(p text,op text,u uuid,m uuid,session_id uuid,cost bigint) returns uuid language sql security invoker set search_path='' as $$ select private.reserve_provider(p,op,u,m,session_id,cost) $$;
create function private.finish_provider(r uuid,result text,ms integer) returns void language sql security definer set search_path='' as $$ update private.provider_usage_events set status=left(result,40),latency_ms=ms where id=r $$;
create function public.finish_provider(r uuid,result text,ms integer) returns void language sql security invoker set search_path='' as $$ select private.finish_provider(r,result,ms) $$;
create function private.resolve_provider(p text,external_id_value text) returns uuid language sql stable security definer set search_path='' as $$ select r.place_id from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status='active' $$;
create function public.resolve_provider(p text,external_id_value text) returns uuid language sql stable security invoker set search_path='' as $$ select private.resolve_provider(p,external_id_value) $$;
create function private.link_provider(mp uuid,u uuid,p text,external_id_value text) returns void language plpgsql security definer set search_path='' as $$ declare pid uuid; begin
 select place_id into pid from public.map_places where id=mp and added_by=u;
 if pid is null then raise exception 'Missing proposal'; end if;
 insert into private.place_provider_refs(place_id,provider,external_id) values(pid,p,external_id_value) on conflict(provider,external_id) do nothing;
end $$;
create function public.link_provider(mp uuid,u uuid,p text,external_id_value text) returns void language sql security invoker set search_path='' as $$ select private.link_provider(mp,u,p,external_id_value) $$;
create function private.usage_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 return jsonb_build_object('settings',(select jsonb_agg(s) from private.provider_settings s),'events',(select coalesce(jsonb_agg(r),'[]') from(select id,provider,operation,status,estimated_micros,latency_ms,created_at from private.provider_usage_events order by created_at desc limit 100)r),'totals',(select coalesce(jsonb_agg(r),'[]') from(select provider,count(*) requests,sum(estimated_micros) estimated_micros from private.provider_usage_events where created_at>=date_trunc('month',now()) group by provider)r)); end $$;
create function public.usage_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$ select private.usage_snapshot() $$;
revoke execute on all functions in schema private from public;
revoke execute on function public.reserve_provider(text,text,uuid,uuid,uuid,bigint),public.finish_provider(uuid,text,integer),public.resolve_provider(text,text),public.link_provider(uuid,uuid,text,text),public.usage_snapshot() from public;
grant execute on function private.reserve_provider(text,text,uuid,uuid,uuid,bigint),private.finish_provider(uuid,text,integer),private.resolve_provider(text,text),private.link_provider(uuid,uuid,text,text),public.reserve_provider(text,text,uuid,uuid,uuid,bigint),public.finish_provider(uuid,text,integer),public.resolve_provider(text,text),public.link_provider(uuid,uuid,text,text) to service_role;
grant execute on function private.usage_snapshot(),public.usage_snapshot() to authenticated;
-- Verified server claims only. Canonical creation and optional ref binding are atomic.
create function private.submit_resolved_proposal(payload jsonb,u uuid,p text,external_id_value text,allow_ref boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; existing uuid; begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform pg_advisory_xact_lock(hashtextextended(p||':'||external_id_value,0));
 if allow_ref then
  select r.place_id into existing from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status='active';
  if existing is not null then payload:=jsonb_set(payload,'{placeId}',to_jsonb(existing)); end if;
  if exists(select 1 from private.place_provider_refs where provider=p and external_id=external_id_value) and existing is null then raise exception '이 장소는 이미 검토 대기 중입니다.'; end if;
 end if;
 result_id:=private.submit_proposal(payload);
 if allow_ref then perform private.link_provider(result_id,u,p,external_id_value); end if;
 return result_id;
end $$;
create function public.submit_resolved_proposal(payload jsonb,u uuid,p text,external_id_value text,allow_ref boolean) returns uuid language sql security invoker set search_path='' as $$ select private.submit_resolved_proposal(payload,u,p,external_id_value,allow_ref) $$;
revoke execute on function private.submit_resolved_proposal(jsonb,uuid,text,text,boolean),public.submit_resolved_proposal(jsonb,uuid,text,text,boolean) from public;
grant execute on function private.submit_resolved_proposal(jsonb,uuid,text,text,boolean),public.submit_resolved_proposal(jsonb,uuid,text,text,boolean) to service_role;


-- 20260909172050_direct_place_reads.sql
create view public.map_place_cards with (security_invoker=true) as
 select mp.id,mp.place_id,mp.map_id,p.name,p.address,p.category,extensions.st_y(p.location) lat,extensions.st_x(p.location) lng,
 mp.rationale,mp.status,mp.added_by,coalesce(pr.handle,'탈퇴한 기여자') handle,mp.created_at,t.slug map_slug,t.title map_title,
 (private.place_stats(mp.id)->>'positive')::int positive,(private.place_stats(mp.id)->>'negative')::int negative,
 (private.place_stats(mp.id)->>'saved_count')::int saved_count,private.place_stats(mp.id)->>'last_verified_at' last_verified_at
 from public.map_places mp join public.places p on p.id=mp.place_id join public.theme_maps t on t.id=mp.map_id left join public.profiles pr on pr.id=mp.added_by
 where private.public_map_place(mp.id);
grant select on public.map_place_cards to anon,authenticated;
create function public.saved_place_cards() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r),'[]') from(select c.*,s.created_at saved_at from public.saves s join public.map_place_cards c on c.id=s.map_place_id where s.user_id=(select auth.uid()) order by s.created_at desc,s.map_place_id limit 501)r
$$;
revoke execute on function public.saved_place_cards() from public;
grant execute on function public.saved_place_cards() to authenticated;

-- Production-safe seed: a community only. No fictional venues/users/votes.
insert into public.theme_maps(id,slug,title,description,rules,country,city,tags,bounds,status)
values('11111111-1111-4111-8111-111111111111','tokyo-fashion','Tokyo Fashion','도쿄의 패션을 발견하는 사람들의 공개 지도. 독립 편집숍부터 빈티지 아카이브까지, 함께 추천하고 검증합니다.','포함: 독립 편집숍, 빈티지, 아카이브, 디자이너 공간. 제외: 주제 근거 없는 일반 쇼핑몰, 광고성 등록. 방문 경험과 구체적인 추천 근거를 남겨 주세요.','JP','Tokyo',array['빈티지','독립 편집숍','디자이너','아카이브'],'{"west":139.5,"south":35.5,"east":139.95,"north":35.85}','published')
on conflict(id) do nothing;

COMMIT;
