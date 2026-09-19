-- Signed-out visitors get one reversible vote per browser token and place.
-- The token itself stays in an HttpOnly cookie; only its SHA-256 digest reaches
-- Postgres, so this table is not a browser-identification store.
create table public.anonymous_map_place_votes (
  map_place_id uuid not null references public.map_places(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (map_place_id, token_hash)
);
alter table public.anonymous_map_place_votes enable row level security;
revoke all on public.anonymous_map_place_votes from anon, authenticated, public;
grant select, insert, update, delete on public.anonymous_map_place_votes to service_role;

create or replace function private.place_stats(m uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'positive',
    (select count(*) from public.map_place_votes where map_place_id=m and value=1) +
    (select count(*) from public.anonymous_map_place_votes where map_place_id=m and value=1),
  'negative',
    (select count(*) from public.map_place_votes where map_place_id=m and value=-1) +
    (select count(*) from public.anonymous_map_place_votes where map_place_id=m and value=-1),
  'saved_count',(select count(*) from public.saves where map_place_id=m),
  'last_verified_at',(
    select max(updated_at) from (
      select updated_at from public.map_place_votes where map_place_id=m
      union all
      select updated_at from public.anonymous_map_place_votes where map_place_id=m
    ) votes
  )
 ) where private.public_map_place(m) or private.pending_map_place(m) or private.is_admin()
$$;

create function private.record_anonymous_vote(
  p_target uuid,
  p_token_hash text,
  p_value smallint
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception '올바르지 않은 투표 식별자입니다.' using errcode='22023'; end if;
 if p_value not in (-1, 0, 1) then raise exception '잘못된 투표입니다.' using errcode='22023'; end if;
 if not (private.public_map_place(p_target) or private.pending_map_place(p_target)) then raise exception '공개된 장소를 찾을 수 없습니다.' using errcode='42501'; end if;
 if p_value=0 then
  delete from public.anonymous_map_place_votes where map_place_id=p_target and token_hash=p_token_hash;
 else
  insert into public.anonymous_map_place_votes(map_place_id,token_hash,value)
  values(p_target,p_token_hash,p_value)
  on conflict(map_place_id,token_hash) do update set value=excluded.value,updated_at=now();
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.record_anonymous_vote(uuid,text,smallint) from public;
grant execute on function private.record_anonymous_vote(uuid,text,smallint) to service_role;

create function public.record_anonymous_vote(
  p_target uuid,
  p_token_hash text,
  p_value smallint
) returns jsonb language sql security invoker set search_path='' as $$
 select private.record_anonymous_vote(p_target,p_token_hash,p_value)
$$;
revoke all on function public.record_anonymous_vote(uuid,text,smallint) from public, anon, authenticated;
grant execute on function public.record_anonymous_vote(uuid,text,smallint) to service_role;

create function private.move_anonymous_votes_after_merge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.merged_into_id is not null and new.merged_into_id is distinct from old.merged_into_id then
  insert into public.anonymous_map_place_votes(map_place_id,token_hash,value,created_at,updated_at)
  select new.merged_into_id,token_hash,value,created_at,updated_at
  from public.anonymous_map_place_votes
  where map_place_id=old.id
  on conflict(map_place_id,token_hash) do update
    set value=excluded.value,updated_at=excluded.updated_at
    where excluded.updated_at>public.anonymous_map_place_votes.updated_at;
  delete from public.anonymous_map_place_votes where map_place_id=old.id;
 end if;
 return new;
end $$;
revoke all on function private.move_anonymous_votes_after_merge() from public;
create trigger move_anonymous_votes_after_merge
after update of merged_into_id on public.map_places
for each row execute function private.move_anonymous_votes_after_merge();

NOTIFY pgrst, 'reload schema';
