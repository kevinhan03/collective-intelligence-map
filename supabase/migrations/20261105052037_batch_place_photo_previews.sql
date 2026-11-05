-- Public previews only, including when invoked by an uploader or administrator.
create or replace function public.place_photo_previews(place_ids uuid[])
returns table(place_id uuid, photo_id uuid)
language plpgsql stable security invoker set search_path='' as $$
begin
  if place_ids is null or cardinality(place_ids) not between 1 and 50
    or array_ndims(place_ids)<>1 or array_position(place_ids,null) is not null then
    raise exception 'Expected 1 to 50 place IDs' using errcode='22023';
  end if;
  return query
    select requested.id, photo.id
    from (select distinct unnest(place_ids) id) requested
    left join lateral (
      select ph.id from public.place_photos ph
      where ph.place_id=requested.id and ph.status='visible'
        and private.visible_place(ph.place_id)
      order by ph.created_at desc, ph.id desc limit 1
    ) photo on true;
end
$$;
revoke all on function public.place_photo_previews(uuid[]) from public;
grant execute on function public.place_photo_previews(uuid[]) to anon, authenticated;
