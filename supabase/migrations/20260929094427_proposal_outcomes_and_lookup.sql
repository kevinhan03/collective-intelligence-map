-- Return the actual stored outcome, including whether this request inserted a
-- map proposal. The submission functions use the same advisory lock.
create function private.submit_proposal_result(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare before_count bigint; result_id uuid; saved public.map_places;
begin
  perform private.require_user();
  perform pg_advisory_xact_lock(781234);
  select count(*) into before_count from public.map_places where map_id = (payload->>'mapId')::uuid;
  result_id := private.submit_proposal(payload);
  select * into saved from public.map_places where id = result_id;
  return jsonb_build_object(
    'id', saved.id, 'placeId', saved.place_id, 'status', saved.status,
    'created', (select count(*) > before_count from public.map_places where map_id = saved.map_id)
  );
end $$;

create function public.submit_proposal_result(payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.submit_proposal_result(payload)
$$;

create function private.submit_resolved_proposal_result(
  payload jsonb, u uuid, p text, external_id_value text, allow_ref boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare before_count bigint; result_id uuid; saved public.map_places;
begin
  perform pg_advisory_xact_lock(781234);
  select count(*) into before_count from public.map_places where map_id = (payload->>'mapId')::uuid;
  result_id := private.submit_resolved_proposal(payload, u, p, external_id_value, allow_ref);
  select * into saved from public.map_places where id = result_id;
  return jsonb_build_object(
    'id', saved.id, 'placeId', saved.place_id, 'status', saved.status,
    'created', (select count(*) > before_count from public.map_places where map_id = saved.map_id)
  );
end $$;

create function public.submit_resolved_proposal_result(
  payload jsonb, u uuid, p text, external_id_value text, allow_ref boolean
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.submit_resolved_proposal_result(payload, u, p, external_id_value, allow_ref)
$$;

-- Fetch one public or pending marker even when it falls outside list limits.
create function public.map_place_for_map(m uuid, target uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select to_jsonb(r) from (
    select mp.id, mp.place_id, mp.map_id, p.name, p.address, p.category,
      extensions.st_y(p.location) lat, extensions.st_x(p.location) lng,
      mp.rationale, mp.status, mp.added_by,
      coalesce(pr.handle, '탈퇴한 기여자') handle, mp.created_at,
      (private.place_stats(mp.id)->>'positive')::int positive,
      (private.place_stats(mp.id)->>'negative')::int negative,
      coalesce((private.place_stats(mp.id)->>'saved_count')::int, 0) saved_count,
      private.place_stats(mp.id)->>'last_verified_at' last_verified_at
    from public.map_places mp
    join public.places p on p.id = mp.place_id
    left join public.profiles pr on pr.id = mp.added_by
    where mp.map_id = m and mp.id = target
      and (private.public_map_place(mp.id) or private.pending_map_place(mp.id))
  ) r
$$;

-- The owner can see every outcome, including rejected proposals and their
-- moderation reason. No other user's proposals are returned.
create index map_places_author_recent on public.map_places(added_by, created_at desc, id desc);
create index moderation_actions_place_recent on private.moderation_actions(map_place_id, created_at desc)
  where action = 'moderate';

create function private.my_proposals(page_num integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare owner_id uuid := private.require_user();
begin
  if page_num < 1 or page_num > 100000 then
    raise exception '올바른 페이지를 선택해 주세요.';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id desc), '[]'::jsonb) from (
      select mp.id, mp.place_id, mp.status, mp.rationale, mp.created_at,
        mp.updated_at, p.name, p.address, t.slug map_slug, t.title map_title,
        case when mp.status = 'rejected' then decision.reason else null end rejection_reason,
        case when mp.status <> 'pending' then coalesce(decision.created_at, mp.updated_at) else null end reviewed_at
      from public.map_places mp
      join public.places p on p.id = mp.place_id
      join public.theme_maps t on t.id = mp.map_id
      left join lateral (
        select a.reason, a.created_at
        from private.moderation_actions a
        where a.map_place_id = mp.id and a.action = 'moderate'
          and a.after_state->>'status' = mp.status
        order by a.created_at desc limit 1
      ) decision on true
      where mp.added_by = owner_id
      order by mp.created_at desc, mp.id desc
      limit 21 offset (page_num - 1) * 20
    ) r
  );
end $$;

create function public.my_proposals(page_num integer) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.my_proposals(page_num)
$$;

revoke all on function private.submit_proposal_result(jsonb),
  private.submit_resolved_proposal_result(jsonb, uuid, text, text, boolean),
  public.submit_proposal_result(jsonb),
  public.submit_resolved_proposal_result(jsonb, uuid, text, text, boolean),
  public.map_place_for_map(uuid, uuid), private.my_proposals(integer),
  public.my_proposals(integer) from public, anon, authenticated;
grant execute on function private.submit_proposal_result(jsonb),
  public.submit_proposal_result(jsonb) to authenticated;
grant execute on function private.submit_resolved_proposal_result(jsonb, uuid, text, text, boolean),
  public.submit_resolved_proposal_result(jsonb, uuid, text, text, boolean) to service_role;
grant execute on function public.map_place_for_map(uuid, uuid) to anon, authenticated;
grant execute on function private.my_proposals(integer), public.my_proposals(integer) to authenticated;

notify pgrst, 'reload schema';
