-- Selecting a search candidate always paid for a fresh provider Details call,
-- even when that exact external place was already resolved to a canonical
-- place in an earlier proposal (place_provider_refs). Give the app a way to
-- fetch that canonical place's fields for free so it can skip the paid call
-- when a match already exists.
create function private.resolve_provider_place(p text,external_id_value text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('placeId',v.id,'name',v.name,'address',v.address,'category',v.category,'lat',extensions.st_y(v.location),'lng',extensions.st_x(v.location))
 from private.place_provider_refs r join public.places v on v.id=r.place_id
 where r.provider=p and r.external_id=external_id_value and v.status='active'
$$;
create function public.resolve_provider_place(p text,external_id_value text) returns jsonb language sql stable security invoker set search_path='' as $$ select private.resolve_provider_place(p,external_id_value) $$;
revoke execute on function public.resolve_provider_place(text,text) from public;
grant execute on function private.resolve_provider_place(text,text),public.resolve_provider_place(text,text) to service_role;

NOTIFY pgrst, 'reload schema';
