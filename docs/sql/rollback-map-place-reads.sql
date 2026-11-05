CREATE OR REPLACE FUNCTION public.map_places_in_bounds(m uuid, w double precision, s double precision, e double precision, n double precision)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(r),'[]'::jsonb) from (
 select mp.id,mp.place_id,mp.map_id,p.name,p.address,p.category,extensions.st_y(p.location) lat,extensions.st_x(p.location) lng,mp.rationale,mp.status,mp.added_by,coalesce(pr.handle,'탈퇴한 기여자') handle,mp.created_at,
 (private.place_stats(mp.id)->>'positive')::int positive,(private.place_stats(mp.id)->>'negative')::int negative,(private.place_stats(mp.id)->>'saved_count')::int saved_count,private.place_stats(mp.id)->>'last_verified_at' last_verified_at
 from public.map_places mp join public.places p on p.id=mp.place_id left join public.profiles pr on pr.id=mp.added_by
 where mp.map_id=m and private.public_map_place(mp.id) and s<n and s>=-90 and n<=90 and w between -180 and 180 and e between -180 and 180
 and (case when w<=e then p.location operator(extensions.&&) extensions.st_makeenvelope(w,s,e,n,4326) else p.location operator(extensions.&&) extensions.st_makeenvelope(w,s,180,n,4326) or p.location operator(extensions.&&) extensions.st_makeenvelope(-180,s,e,n,4326) end)
 order by mp.id limit 501) r
$function$
;
