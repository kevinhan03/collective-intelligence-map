-- Members can contribute; moderation remains restricted to the existing admin role.
create or replace function private.can_contribute() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid())
 and not exists(select 1 from private.user_roles where user_id=auth.uid() and suspended)
$$;
alter table public.map_places drop constraint map_places_rationale_check;
alter table public.map_places add constraint map_places_rationale_check check(length(btrim(rationale)) between 5 and 1000);
-- Map creation has no public mutation endpoint. Keep direct writes unavailable.
revoke insert,update,delete on public.theme_maps from anon,authenticated;

create table private.place_checks (
 map_place_id uuid not null references public.map_places on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 kind text not null check(kind in ('visited','open','needs_review')),
 checked_at timestamptz not null default now(),
 primary key(map_place_id,user_id)
);
alter table private.place_checks enable row level security;
revoke all on private.place_checks from anon,authenticated;
create index place_checks_recent on private.place_checks(map_place_id,checked_at);
create function private.place_check_summary(m uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.public_map_place(m) then raise exception '공개된 장소를 찾을 수 없습니다.'; end if;
 return (select jsonb_build_object('visited',count(*) filter(where kind='visited'),
 'open',count(*) filter(where kind='open'),'needs_review',count(*) filter(where kind='needs_review'),
 'last_checked_at',max(checked_at)) from private.place_checks where map_place_id=m and checked_at>now()-interval '90 days');
end $$;
create function public.place_check_summary(m uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.place_check_summary(m) $$;
revoke all on function private.place_check_summary(uuid),public.place_check_summary(uuid) from public;
grant execute on function private.place_check_summary(uuid),public.place_check_summary(uuid) to anon,authenticated;

create or replace function private.community_command(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); a text:=payload->>'action'; target uuid:=(payload->>'id')::uuid; v integer; old_status text; result_id uuid; src public.places; dest public.places; mp record; other uuid; reason text:=btrim(payload->>'reason');
begin
 perform private.rate_limit('write',120);
 if a in('vote','comment') and not private.can_contribute() then raise exception '초대 기여자만 참여할 수 있습니다.' using errcode='42501'; end if;
 if a in('vote','save','comment') and not private.public_map_place(target) then raise exception '공개된 장소를 찾을 수 없습니다.'; end if;
 if a='verify_place' then
  if not private.public_map_place(target) then raise exception '공개된 장소를 찾을 수 없습니다.'; end if;
  if payload->>'kind' not in ('visited','open','needs_review') or payload->>'kind' is null then raise exception '잘못된 확인 항목'; end if;
  insert into private.place_checks(map_place_id,user_id,kind) values(target,u,payload->>'kind')
  on conflict(map_place_id,user_id) do update set kind=excluded.kind,checked_at=now();
  return jsonb_build_object('ok',true);
 elsif a='vote' then
  v:=(payload->>'value')::integer;
  if v not in(-1,0,1) or v is null then raise exception '잘못된 투표'; end if;
  if v=0 then delete from public.map_place_votes where map_place_id=target and user_id=u;
  else insert into public.map_place_votes(map_place_id,user_id,value) values(target,u,v) on conflict(map_place_id,user_id) do update set value=excluded.value,updated_at=now(); end if;
 elsif a='save' then
  if (payload->>'enabled')::boolean then insert into public.saves(user_id,map_place_id) values(u,target) on conflict do nothing; else delete from public.saves where user_id=u and map_place_id=target; end if;
 elsif a='follow' then
  if not private.public_map(target) then raise exception '공개 맵이 아닙니다.'; end if;
  if (payload->>'enabled')::boolean then insert into public.map_follows(user_id,map_id) values(u,target) on conflict do nothing; else delete from public.map_follows where user_id=u and map_id=target; end if;
 elsif a='comment' then
  perform private.rate_limit('comment',20);
  insert into public.comments(map_place_id,author_id,body) values(target,u,btrim(payload->>'body')) returning id into result_id;
 elsif a='delete_comment' then
  update public.comments set status='deleted' where id=target and author_id=u;
  if not found then raise exception '댓글을 삭제할 수 없습니다.'; end if;
 elsif a='report' then
  perform private.rate_limit('report',10);
  if payload->>'target'='map_place' and private.public_map_place(target) then
   insert into public.reports(reporter_id,map_place_id,reason) values(u,target,reason) on conflict do nothing;
  elsif payload->>'target'='comment' and exists(select 1 from public.comments where id=target and status='visible' and private.public_map_place(map_place_id)) then
   insert into public.reports(reporter_id,comment_id,reason) values(u,target,reason) on conflict do nothing;
  else raise exception '신고 대상을 찾을 수 없습니다.'; end if;
 elsif a='profile' then
  if payload->>'avatar_path' is not null and (payload->>'avatar_path' not like u::text||'/%' or not exists(select 1 from storage.objects where bucket_id='avatars' and name=payload->>'avatar_path')) then raise exception '올바른 프로필 이미지를 선택해 주세요.'; end if;
  update public.profiles set handle=payload->>'handle',bio=coalesce(payload->>'bio',''),avatar_path=coalesce(payload->>'avatar_path',avatar_path),updated_at=now() where id=u;
 elsif a in('moderate','resolve_report','hide_comment','merge','provider_settings') then
  if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  if a<>'provider_settings' and (reason is null or length(reason) not between 5 and 1000) then raise exception '처리 사유를 입력해 주세요.'; end if;
  if a='moderate' then
   select status into old_status from public.map_places where id=target for update;
   if not found then raise exception '제안을 찾을 수 없습니다.'; end if;
   if not ((old_status in('pending','rejected') and payload->>'status' in('approved','rejected')) or (old_status in('approved','disputed') and payload->>'status' in('approved','disputed','archived'))) then raise exception '허용되지 않은 상태 변경입니다.'; end if;
   if payload->>'status'='approved' then
    if not exists(select 1 from public.map_places m join private.place_field_sources f on f.place_id=m.place_id join public.places p on p.id=m.place_id where m.id=target and p.status in('pending','active')) then raise exception '독립적인 장소 출처를 검토해야 승인할 수 있습니다.'; end if;
    update private.place_field_sources set reviewed_by=u,reviewed_at=now() where place_id=(select place_id from public.map_places where id=target);
    update public.places set status='active' where id=(select place_id from public.map_places where id=target);
   end if;
   update public.map_places set status=payload->>'status',updated_at=now() where id=target;
   insert into private.moderation_actions(actor_id,action,map_place_id,reason,before_state,after_state) values(u,a,target,reason,jsonb_build_object('status',old_status),jsonb_build_object('status',payload->>'status'));
  elsif a='resolve_report' then
   update public.reports set status='resolved' where id=target and status='open';
   if not found then raise exception '처리할 신고가 없습니다.'; end if;
   insert into private.moderation_actions(actor_id,action,report_id,reason) values(u,a,target,reason);
  elsif a='hide_comment' then
   update public.comments set status='hidden' where id=target;
   if not found then raise exception '댓글이 없습니다.'; end if;
   insert into private.moderation_actions(actor_id,action,comment_id,reason) values(u,a,target,reason);
  elsif a='merge' then
   if target=(payload->>'targetId')::uuid then raise exception '동일 장소는 병합할 수 없습니다.'; end if;
   -- Global transaction lock keeps cross-map merges serialized and avoids conflicting votes.
   perform pg_advisory_xact_lock(781234);
   lock table public.map_place_votes,public.saves,public.comments,public.reports,public.map_places,private.place_provider_refs in share row exclusive mode;
   select * into src from public.places where id=target for update;
   select * into dest from public.places where id=(payload->>'targetId')::uuid for update;
   if src.id is null or dest.id is null or src.status='merged' or dest.status<>'active' or src.country<>dest.country or src.city<>dest.city then raise exception '병합 대상 상태 또는 도시가 올바르지 않습니다.'; end if;
   for mp in select * from public.map_places where place_id=src.id loop
    select id into other from public.map_places where map_id=mp.map_id and place_id=dest.id;
    if other is null then update public.map_places set place_id=dest.id,updated_at=now() where id=mp.id;
    else
     insert into public.map_place_votes(map_place_id,user_id,value,updated_at) select other,user_id,value,updated_at from public.map_place_votes where map_place_id=mp.id
     on conflict(map_place_id,user_id) do update set value=excluded.value,updated_at=excluded.updated_at where excluded.updated_at>public.map_place_votes.updated_at;
     delete from public.map_place_votes where map_place_id=mp.id;
     insert into public.saves(user_id,map_place_id,created_at) select user_id,other,created_at from public.saves where map_place_id=mp.id on conflict do nothing;
     delete from public.saves where map_place_id=mp.id;
     update public.comments set map_place_id=other where map_place_id=mp.id;
     update public.reports r set status='resolved' where r.map_place_id=mp.id and r.status='open' and exists(select 1 from public.reports r2 where r2.map_place_id=other and r2.reporter_id=r.reporter_id and r2.status='open');
     update public.reports set map_place_id=other where map_place_id=mp.id;
     update public.map_places set status='archived',merged_into_id=other,updated_at=now() where id=mp.id;
    end if;
   end loop;
   update private.place_provider_refs set place_id=dest.id where place_id=src.id;
   update public.places set status='merged',merged_into_id=dest.id where id=src.id;
   insert into private.moderation_actions(actor_id,action,place_id,reason,before_state,after_state) values(u,a,src.id,reason,to_jsonb(src),jsonb_build_object('merged_into_id',dest.id));
  else
   update private.provider_settings set enabled=(payload->>'enabled')::boolean,daily_limit=(payload->>'daily_limit')::int,monthly_limit=(payload->>'monthly_limit')::int,monthly_budget_micros=(payload->>'monthly_budget_micros')::bigint where provider=payload->>'provider';
   insert into private.moderation_actions(actor_id,action,reason,after_state) values(u,a,'Provider usage settings updated',payload);
  end if;
 else raise exception '지원하지 않는 작업입니다.'; end if;
 return jsonb_build_object('ok',true,'id',result_id);
end $$;

-- Google Places Autocomplete sessions are capped at twelve autocomplete calls
-- plus one terminating Details request. This prevents a script from spending
-- the monthly budget by minting an unlimited number of search requests.
create or replace function private.reserve_provider(
  p text,
  op text,
  u uuid,
  m uuid,
  session_id uuid,
  cost bigint
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  settings private.provider_settings;
  sid private.provider_sessions;
  r uuid;
  daily integer;
  monthly integer;
  amount bigint;
begin
  if cost < 0 or cost > 1000000 or op not in ('autocomplete', 'details', 'keyword') then
    raise exception 'Invalid reservation';
  end if;
  if not exists (select 1 from public.profiles where id=u)
    or exists(select 1 from private.user_roles where user_id=u and suspended)
    or not private.public_map(m) then
    raise exception 'Forbidden';
  end if;
  select * into settings from private.provider_settings where provider = p for update;
  if not found or not settings.enabled then
    raise exception '외부 검색이 일시 중지되어 있습니다.';
  end if;
  select
    count(*) filter (where created_at >= date_trunc('day', now())),
    count(*),
    coalesce(sum(estimated_micros), 0)
  into daily, monthly, amount
  from private.provider_usage_events
  where provider = p and created_at >= date_trunc('month', now());
  if daily >= settings.daily_limit
    or monthly >= settings.monthly_limit
    or amount + cost > settings.monthly_budget_micros then
    raise exception '외부 검색 예산에 도달했습니다.';
  end if;
  if (
    select count(*) from private.provider_usage_events
    where user_id = u and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception '검색 요청 한도에 도달했습니다.';
  end if;
  if p = 'google' then
    insert into private.provider_sessions(id, user_id, map_id)
    values (session_id, u, m)
    on conflict do nothing;
    select * into sid from private.provider_sessions where id = session_id for update;
    if sid.user_id <> u
      or sid.map_id <> m
      or sid.ended
      or sid.created_at < now() - interval '15 minutes' then
      raise exception '검색 세션이 만료되었습니다. 다시 검색해 주세요.';
    end if;
    if op = 'autocomplete' and sid.requests >= 12 then
      raise exception '이번 검색의 입력 횟수가 한도에 도달했습니다. 다시 검색해 주세요.';
    end if;
    if op = 'details' and sid.requests = 0 then
      raise exception '검색부터 시작해 주세요.';
    end if;
    update private.provider_sessions
      set requests = requests + 1, ended = (op = 'details')
      where id = session_id;
  end if;
  insert into private.provider_usage_events(user_id, provider, operation, estimated_micros)
  values (u, p, op, cost)
  returning id into r;
  return r;
end $$;

create or replace function private.admin_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 return jsonb_build_object(
 'proposals',(select coalesce(jsonb_agg(r),'[]') from(select mp.*,
(select count(*) from private.place_checks ck where ck.map_place_id=mp.id and ck.kind='needs_review' and ck.checked_at>now()-interval '90 days') review_count,
(select count(*) from public.map_place_votes v where v.map_place_id=mp.id and v.value=-1) negative_count,p.name,p.address,p.status place_status,extensions.st_x(p.location) lng,extensions.st_y(p.location) lat,f.source_note,t.title map_title,pr.handle from public.map_places mp join public.places p on p.id=mp.place_id join public.theme_maps t on t.id=mp.map_id left join private.place_field_sources f on f.place_id=p.id left join public.profiles pr on pr.id=mp.added_by where mp.status in('pending','approved','disputed') order by (mp.status='pending') desc,mp.created_at limit 100)r),
 'reports',(select coalesce(jsonb_agg(r),'[]') from(select r.*,c.body,p.name from public.reports r left join public.comments c on c.id=r.comment_id left join public.map_places mp on mp.id=r.map_place_id left join public.places p on p.id=mp.place_id where r.status='open' order by r.created_at limit 100)r),
 'actions',(select coalesce(jsonb_agg(r),'[]') from(select * from private.moderation_actions order by created_at desc limit 50)r),
 'duplicates',(select coalesce(jsonb_agg(r),'[]') from(select a.id source_id,a.name source_name,b.id target_id,b.name target_name,round(extensions.st_distance(a.location::extensions.geography,b.location::extensions.geography)) distance_m from public.places a join public.places b on a.id<>b.id and a.country=b.country and a.city=b.city and a.status<>'merged' and b.status='active' and extensions.st_dwithin(a.location::extensions.geography,b.location::extensions.geography,100) where a.id<b.id or a.status='pending' limit 50)r));
 end $$;

NOTIFY pgrst, 'reload schema';
