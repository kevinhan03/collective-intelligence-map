create table public.rail_station_regions (
  id text primary key,
  bounds extensions.geometry(Polygon,4326) not null,
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz
);
create table public.rail_stations (
  id text primary key,
  region_id text not null references public.rail_station_regions(id),
  name text not null check(length(name) between 1 and 300),
  local_name text not null,
  kind text not null check(kind in ('subway','train')),
  lat double precision not null check(lat between -90 and 90),
  lng double precision not null check(lng between -180 and 180),
  location extensions.geography(Point,4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography) stored,
  source text not null default 'OpenStreetMap',
  updated_at timestamptz not null default now()
);
create index rail_stations_location on public.rail_stations using gist(location);
alter table public.rail_station_regions enable row level security;
alter table public.rail_stations enable row level security;
create policy rail_regions_read on public.rail_station_regions for select to anon,authenticated using(true);
create policy rail_stations_read on public.rail_stations for select to anon,authenticated using(true);
revoke all on public.rail_station_regions,public.rail_stations from anon,authenticated;
grant select on public.rail_station_regions,public.rail_stations to anon,authenticated;
grant all on public.rail_station_regions,public.rail_stations to service_role;
insert into public.rail_station_regions(id,bounds) values
 ('seoul',extensions.st_makeenvelope(126.75,37.35,127.25,37.75,4326)),
 ('tokyo',extensions.st_makeenvelope(139.45,35.45,139.95,35.9,4326));

create function public.nearby_rail_stations(p uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare place public.places; region public.rail_station_regions; result jsonb;
begin
 select * into place from public.places where id=p and status='active';
 if not found or not exists(select 1 from public.map_places where place_id=p and private.public_map_place(id)) then return null; end if;
 select * into region from public.rail_station_regions
 where extensions.st_covers(bounds,place.location) order by id limit 1;
 if not found then return jsonb_build_object('status','unsupported','stations','[]'::jsonb); end if;
 if region.updated_at is null then return jsonb_build_object('status','preparing','stations','[]'::jsonb); end if;
 select coalesce(jsonb_agg(row),'[]'::jsonb) into result from (
   select s.id,s.name,s.local_name,s.kind,s.lat,s.lng,
    round(extensions.st_distance(s.location,place.location::extensions.geography))::integer distance_m
   from public.rail_stations s where s.region_id=region.id
    and extensions.st_dwithin(s.location,place.location::extensions.geography,2000)
   order by extensions.st_distance(s.location,place.location::extensions.geography),s.id limit 3
 ) row;
 return jsonb_build_object('status','ready','stations',result);
end $$;
revoke all on function public.nearby_rail_stations(uuid) from public;
grant execute on function public.nearby_rail_stations(uuid) to anon,authenticated;

-- One transaction replaces a complete, validated region snapshot. Failure keeps old data.
create function public.replace_rail_station_region(r text, stations jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare area extensions.geometry;
begin
 select bounds into area from public.rail_station_regions where id=r for update;
 if not found or jsonb_typeof(stations)<>'array' or jsonb_array_length(stations)=0 then
  raise exception 'A nonempty complete station snapshot is required';
 end if;
 if exists(select 1 from jsonb_to_recordset(stations) as x(id text,name text,local_name text,kind text,lat float8,lng float8)
   where x.id is null or x.name is null or x.local_name is null or x.kind is null or x.lat is null or x.lng is null
    or x.kind not in ('subway','train') or not extensions.st_covers(area,extensions.st_setsrid(extensions.st_makepoint(x.lng,x.lat),4326))) then
  raise exception 'Invalid station snapshot';
 end if;
 delete from public.rail_stations where region_id=r;
 insert into public.rail_stations(id,region_id,name,local_name,kind,lat,lng)
 select id,r,name,local_name,kind,lat,lng from jsonb_to_recordset(stations) as x(id text,name text,local_name text,kind text,lat float8,lng float8);
 update public.rail_station_regions set updated_at=now(),revision=gen_random_uuid() where id=r;
end $$;
revoke all on function public.replace_rail_station_region(text,jsonb) from public,anon,authenticated;
grant execute on function public.replace_rail_station_region(text,jsonb) to service_role;

create or replace function private.place_check_summary(m uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.public_map_place(m) then raise exception '공개된 장소를 찾을 수 없습니다.'; end if;
 return (select jsonb_build_object('visited',count(*) filter(where kind='visited'),
 'open',count(*) filter(where kind='open'),'needs_review',count(*) filter(where kind='needs_review'),
 'last_checked_at',max(checked_at),'last_open_checked_at',max(checked_at) filter(where kind='open'))
 from private.place_checks where map_place_id=m and checked_at>now()-interval '90 days');
end $$;
