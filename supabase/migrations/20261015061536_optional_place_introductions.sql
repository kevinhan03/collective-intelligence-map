begin;
set local lock_timeout = '5s';

alter table public.map_places drop constraint if exists map_places_rationale_check;
alter table public.map_places add constraint map_places_rationale_check
  check (length(btrim(rationale)) between 0 and 1000);

-- Preserve the installed implementations, including creator scope/ownership checks.
do $$
declare signature text; definition text;
begin
  foreach signature in array array['private.submit_proposal(jsonb)', 'private.creator_command(jsonb)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if position('rationale' in definition) = 0 or
       (position('not between 5 and 1000' in definition) = 0 and position('not between 0 and 1000' in definition) = 0) then
      raise exception 'Unexpected proposal implementation: %', signature;
    end if;
    definition := replace(definition,
      'length(btrim(coalesce(payload->>''rationale'',''''))) not between 5 and 1000',
      'length(btrim(coalesce(payload->>''rationale'',''''))) not between 0 and 1000');
    definition := replace(definition,
      'length(btrim(mp.rationale)) not between 5 and 1000',
      'length(btrim(mp.rationale)) not between 0 and 1000');
    definition := replace(definition, 'btrim(payload->>''rationale'')', 'btrim(coalesce(payload->>''rationale'',''''))');
    definition := replace(definition, '추천 이유는 5~1,000자입니다.', '소개는 1,000자 이내로 입력해 주세요.');
    definition := replace(definition, '추천 근거를 입력해 주세요.', '소개는 1,000자 이내로 입력해 주세요.');
    execute definition;
  end loop;
end $$;

-- Reuse comment attribution, RLS, reporting, moderation and soft deletion.
alter table public.comments add column if not exists kind text not null default 'comment'
  check (kind in ('comment', 'introduction'));

create or replace function private.save_place_introduction(m uuid, b text, c uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); result_id uuid;
begin
  if not private.can_contribute() then
    raise exception '소개를 추가할 권한이 없습니다.' using errcode = '42501';
  end if;
  if not private.public_map_place(m) then
    raise exception '공개된 장소를 찾을 수 없습니다.';
  end if;
  if length(btrim(coalesce(b, ''))) not between 2 and 1000 then
    raise exception '소개를 2~1,000자로 입력해 주세요.';
  end if;
  perform private.rate_limit('write', 120);
  perform private.rate_limit('comment', 20);
  if c is null then
    insert into public.comments(map_place_id, author_id, body, kind)
    values (m, u, btrim(b), 'introduction') returning id into result_id;
  else
    update public.comments set body = btrim(b)
    where id = c and map_place_id = m and author_id = u
      and kind = 'introduction' and status = 'visible'
    returning id into result_id;
    if result_id is null then
      raise exception '본인이 작성한 공개 소개만 수정할 수 있습니다.' using errcode = '42501';
    end if;
  end if;
  return result_id;
end $$;
revoke all on function private.save_place_introduction(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.save_place_introduction(uuid,text,uuid) to authenticated;
create or replace function public.save_place_introduction(m uuid, b text, c uuid default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_place_introduction(m, b, c)
$$;
revoke all on function public.save_place_introduction(uuid,text,uuid) from public,anon;
grant execute on function public.save_place_introduction(uuid,text,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
