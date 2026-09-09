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
