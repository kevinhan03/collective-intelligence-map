-- Map saves reuse map_follows. Hype is private per-account state with public
-- aggregates; raw identities are never exposed in popularity results.
create table public.map_hypes (
  user_id uuid not null references public.profiles on delete cascade,
  map_id uuid not null references public.theme_maps on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, map_id)
);
create index map_hypes_active_map on public.map_hypes(map_id, created_at) where enabled;
alter table public.map_hypes enable row level security;
revoke all on public.map_hypes from public, anon, authenticated;
grant select on public.map_hypes to authenticated;
grant all on public.map_hypes to service_role;
create policy map_hypes_own_read on public.map_hypes for select to authenticated
  using (user_id = (select auth.uid()));

create function private.map_engagement_stats()
returns table(map_id uuid, hype_count int, hype_week_count int, saved_count int)
language sql stable security definer set search_path = '' as $$
  select t.id,
    (select count(*)::int from public.map_hypes h where h.map_id=t.id and h.enabled),
    (select count(*)::int from public.map_hypes h where h.map_id=t.id and h.enabled and h.created_at >= now()-interval '7 days'),
    (select count(*)::int from public.map_follows f where f.map_id=t.id)
  from public.theme_maps t where private.public_map(t.id)
$$;
create function public.map_engagement_stats()
returns table(map_id uuid, hype_count int, hype_week_count int, saved_count int)
language sql stable security invoker set search_path = '' as $$
  select * from private.map_engagement_stats()
$$;
revoke all on function private.map_engagement_stats(), public.map_engagement_stats() from public, anon, authenticated;
grant execute on function private.map_engagement_stats(), public.map_engagement_stats() to anon, authenticated;

create function private.set_map_hype(p_map uuid, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); result jsonb;
begin
  if p_enabled is null then raise exception '추천 상태가 필요합니다.' using errcode='22023'; end if;
  if not private.public_map(p_map) then raise exception '공개 지도를 찾을 수 없습니다.' using errcode='42501'; end if;
  perform private.rate_limit('map_hype', 60);
  -- Serialize one user's changes, including the no-row-yet case.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text || ':' || p_map::text, 0));
  if p_enabled then
    insert into public.map_hypes(user_id,map_id) values(u,p_map)
    on conflict(user_id,map_id) do update set enabled=true;
  else
    update public.map_hypes set enabled=false where user_id=u and map_id=p_map;
  end if;
  -- Preserve first-created time across unlike/re-like so toggles cannot renew
  -- old recommendations indefinitely in the seven-day ranking.
  select jsonb_build_object('hyped',p_enabled,'hype_count',s.hype_count,
    'hype_week_count',s.hype_week_count,'saved_count',s.saved_count)
  into result from private.map_engagement_stats() s where s.map_id=p_map;
  return result;
end $$;
create function public.set_map_hype(p_map uuid, p_enabled boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.set_map_hype(p_map,p_enabled)
$$;
revoke all on function private.set_map_hype(uuid,boolean), public.set_map_hype(uuid,boolean) from public, anon, authenticated;
grant execute on function private.set_map_hype(uuid,boolean), public.set_map_hype(uuid,boolean) to authenticated;
