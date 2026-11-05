-- theme_maps.owner_id added by creator support conflicts with the former
-- PL/pgSQL variable. Keep the authenticated author scope unambiguous.
create or replace function private.my_proposals(page_num integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_author_id uuid := private.require_user();
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
      where mp.added_by = v_author_id
      order by mp.created_at desc, mp.id desc
      limit 21 offset (page_num - 1) * 20
    ) r
  );
end $$;

