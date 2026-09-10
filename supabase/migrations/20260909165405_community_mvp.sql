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
