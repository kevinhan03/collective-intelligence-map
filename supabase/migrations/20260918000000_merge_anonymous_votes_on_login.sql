-- Fold a signed-out visitor's cookie-scoped votes into their account the
-- moment they sign in, so the same person can't count twice in place_stats.
create function private.merge_anonymous_votes(p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();
begin
 if p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',true); end if;
 insert into public.map_place_votes(map_place_id,user_id,value,updated_at)
 select map_place_id,u,value,updated_at from public.anonymous_map_place_votes where token_hash=p_token_hash
 on conflict(map_place_id,user_id) do update
   set value=excluded.value,updated_at=excluded.updated_at
   where excluded.updated_at>public.map_place_votes.updated_at;
 delete from public.anonymous_map_place_votes where token_hash=p_token_hash;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.merge_anonymous_votes(text) from public;

create function public.merge_anonymous_votes(p_token_hash text) returns jsonb language sql security invoker set search_path='' as $$
 select private.merge_anonymous_votes(p_token_hash)
$$;
revoke all on function public.merge_anonymous_votes(text) from public, anon;
grant execute on function public.merge_anonymous_votes(text) to authenticated;

NOTIFY pgrst, 'reload schema';
