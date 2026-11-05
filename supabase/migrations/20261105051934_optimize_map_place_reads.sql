-- Preserve public visibility and wire shape; limit before evaluating statistics.
create or replace function public.map_places_in_bounds(
  m uuid, w double precision, s double precision, e double precision, n double precision
) returns jsonb language sql stable security invoker set search_path='' as $$
  with candidates as materialized (
    select mp.id, mp.place_id, mp.map_id, p.name, p.address, p.category,
      extensions.st_y(p.location) lat, extensions.st_x(p.location) lng,
      mp.rationale, mp.status, mp.added_by,
      coalesce(pr.handle, '탈퇴한 기여자') handle, mp.created_at
    from public.map_places mp
    join public.places p on p.id=mp.place_id
    left join public.profiles pr on pr.id=mp.added_by
    where mp.map_id=m and private.public_map_place(mp.id)
      and s<n and s>=-90 and n<=90 and w between -180 and 180 and e between -180 and 180
      and (case when w<=e then
        p.location operator(extensions.&&) extensions.st_makeenvelope(w,s,e,n,4326)
      else
        p.location operator(extensions.&&) extensions.st_makeenvelope(w,s,180,n,4326)
        or p.location operator(extensions.&&) extensions.st_makeenvelope(-180,s,e,n,4326)
      end)
    order by mp.id limit 501
  )
  select coalesce(jsonb_agg(r order by r.id), '[]'::jsonb) from (
    select c.*, (st.stats->>'positive')::int positive,
      (st.stats->>'negative')::int negative,
      (st.stats->>'saved_count')::int saved_count,
      st.stats->>'last_verified_at' last_verified_at
    from candidates c
    cross join lateral (select private.place_stats(c.id) stats offset 0) st
  ) r
$$;
