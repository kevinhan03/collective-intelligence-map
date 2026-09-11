-- Bulk variant of map_stats: computes stats for every published map in one
-- round trip instead of one RPC call per map (fixes an N+1 on the homepage
-- map list). Mirrors private.map_stats(uuid)'s logic exactly, just iterated
-- over all published theme_maps via correlated subqueries in a single query.
create function private.map_stats_all() returns table(map_id uuid, place_count int, follower_count int, contributor_count int) language sql stable security definer set search_path='' as $$
 select t.id,
   (select count(*) from public.map_places where map_id=t.id and private.public_map_place(id))::int,
   (select count(*) from public.map_follows where map_id=t.id)::int,
   (select count(distinct added_by) from public.map_places where map_id=t.id and private.public_map_place(id))::int
 from public.theme_maps t
 where t.status='published'
$$;
create function public.map_stats_all() returns table(map_id uuid, place_count int, follower_count int, contributor_count int) language sql stable security invoker set search_path='' as $$ select * from private.map_stats_all() $$;
revoke execute on function public.map_stats_all() from public;
revoke execute on function private.map_stats_all() from public;
grant execute on function private.map_stats_all() to anon,authenticated;
grant execute on function public.map_stats_all() to anon,authenticated;
