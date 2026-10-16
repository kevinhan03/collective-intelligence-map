begin;
set local lock_timeout = '5s';

-- Keep individual reactions private; only aggregate counts and the caller's
-- own state are returned by the bounded, public-place-scoped read function.
create table private.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user on private.comment_likes(user_id);
alter table private.comment_likes enable row level security;
revoke all on private.comment_likes from public, anon, authenticated;

create function private.place_comment_thread(m uuid, page_offset integer default 0, page_size integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if page_offset < 0 or page_size not between 1 and 100 then
    raise exception '댓글 조회 범위를 확인해 주세요.';
  end if;
  if not private.public_map_place(m) then
    return jsonb_build_object('comments', '[]'::jsonb, 'total', 0);
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.comments c where c.map_place_id=m and c.status='visible' and c.kind='comment'),
    'comments', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from (
      select c.id,c.map_place_id,c.author_id,c.body,c.created_at,
        coalesce(p.handle,'탈퇴한 기여자') as handle,p.avatar_path,
        (select count(*) from private.comment_likes l where l.comment_id=c.id) as likes,
        exists(select 1 from private.comment_likes l where l.comment_id=c.id and l.user_id=auth.uid()) as liked
      from public.comments c left join public.profiles p on p.id=c.author_id
      where c.map_place_id=m and c.status='visible' and c.kind='comment'
      order by c.created_at,c.id limit page_size offset page_offset
    ) t)
  );
end $$;
revoke all on function private.place_comment_thread(uuid,integer,integer) from public;
grant execute on function private.place_comment_thread(uuid,integer,integer) to anon,authenticated;
create function public.place_comment_thread(m uuid, page_offset integer default 0, page_size integer default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.place_comment_thread(m,page_offset,page_size)
$$;
revoke all on function public.place_comment_thread(uuid,integer,integer) from public;
grant execute on function public.place_comment_thread(uuid,integer,integer) to anon,authenticated;

create function private.set_comment_like(c uuid, enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user();
begin
  if not private.can_contribute() then
    raise exception '반응을 남길 권한이 없습니다.' using errcode='42501';
  end if;
  -- Serialize opposing requests for this user's comment reaction.
  perform pg_advisory_xact_lock(hashtextextended(c::text || u::text, 0));
  perform 1 from public.comments where id=c and status='visible' and kind='comment'
    and private.public_map_place(map_place_id) for share;
  if not found then
    raise exception '공개된 댓글을 찾을 수 없습니다.' using errcode='42501';
  end if;
  perform private.rate_limit('write',120);
  if enabled then
    insert into private.comment_likes(comment_id,user_id) values(c,u) on conflict do nothing;
  else
    delete from private.comment_likes where comment_id=c and user_id=u;
  end if;
  return jsonb_build_object('liked',enabled,'likes',(select count(*) from private.comment_likes where comment_id=c));
end $$;
revoke all on function private.set_comment_like(uuid,boolean) from public,anon;
grant execute on function private.set_comment_like(uuid,boolean) to authenticated;
create function public.set_comment_like(c uuid, enabled boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.set_comment_like(c,enabled)
$$;
revoke all on function public.set_comment_like(uuid,boolean) from public,anon;
grant execute on function public.set_comment_like(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
