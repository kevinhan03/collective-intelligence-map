-- 1) Admin-submitted proposals publish immediately instead of sitting in the
-- pending queue. Every other contributor's proposal still needs review.
create or replace function private.submit_proposal(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); m public.theme_maps; p uuid:=(payload->>'placeId')::uuid; result_id uuid; lng double precision:=(payload->>'lng')::double precision; lat double precision:=(payload->>'lat')::double precision; auto boolean:=private.is_admin();
begin
 if not private.can_contribute() then raise exception '장소 제안은 초대 기여자에게 열려 있습니다.' using errcode='42501'; end if;
 perform private.rate_limit('proposal',5);
 select * into m from public.theme_maps where id=(payload->>'mapId')::uuid and status='published';
 if m.id is null then raise exception '공개 맵을 찾을 수 없습니다.'; end if;
 if p is null then
  if lng is null or lat is null or lng<(m.bounds->>'west')::float or lng>(m.bounds->>'east')::float or lat<(m.bounds->>'south')::float or lat>(m.bounds->>'north')::float then raise exception '맵의 도시 범위 안에 있는 장소만 제안해 주세요.'; end if;
  insert into public.places(name,address,category,location,country,city,created_by,status) values(btrim(payload->>'name'),coalesce(payload->>'address',''),coalesce(payload->>'category','패션'),extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326),m.country,m.city,u,case when auto then 'active' else 'pending' end) returning id into p;
  insert into private.place_field_sources(place_id,source_note,reviewed_by,reviewed_at) values(p,btrim(payload->>'sourceNote'),case when auto then u end,case when auto then now() end);
 else
  if not exists(select 1 from public.places where id=p and status='active' and country=m.country and city=m.city and private.visible_place(id)) then raise exception '기존 장소를 찾을 수 없습니다.'; end if;
 end if;
 insert into public.map_places(map_id,place_id,added_by,rationale,status) values(m.id,p,u,btrim(payload->>'rationale'),case when auto then 'approved' else 'pending' end) returning id into result_id;
 if auto then
  insert into private.moderation_actions(actor_id,action,map_place_id,reason,before_state,after_state) values(u,'moderate',result_id,'운영자 제안 자동 승인',jsonb_build_object('status','pending'),jsonb_build_object('status','approved'));
 end if;
 return result_id;
end $$;

-- 2) Pending proposals on public maps become visible for read (and voting)
-- to every visitor, not just the proposer and admins, so members can weigh
-- in on fit before an admin decides. Saving/commenting still require the
-- existing approved status.
create function private.pending_map_place(m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.map_places mp join public.places p on p.id=mp.place_id where mp.id=m and mp.status='pending' and p.status in('pending','active') and private.public_map(mp.map_id))
$$;
create function public.pending_map_place(m uuid) returns boolean language sql stable security invoker set search_path='' as $$ select private.pending_map_place(m) $$;
revoke execute on function public.pending_map_place(uuid) from public;
grant execute on function private.pending_map_place(uuid),public.pending_map_place(uuid) to anon,authenticated;

create function private.pending_visible_place(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.map_places where place_id=p and private.pending_map_place(id))
$$;
revoke all on function private.pending_visible_place(uuid) from public;
grant execute on function private.pending_visible_place(uuid) to anon,authenticated;

drop policy map_places_read on public.map_places;
create policy map_places_read on public.map_places for select using(private.public_map_place(id) or private.pending_map_place(id) or added_by=(select auth.uid()) or private.is_admin());
drop policy places_read on public.places;
create policy places_read on public.places for select using(private.visible_place(id) or private.pending_visible_place(id) or created_by=(select auth.uid()) or private.is_admin());

-- Stats (used for the 적합/부적합 tally) now compute for pending items too.
create or replace function private.place_stats(m uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('positive',(select count(*) from public.map_place_votes where map_place_id=m and value=1),'negative',(select count(*) from public.map_place_votes where map_place_id=m and value=-1),'saved_count',(select count(*) from public.saves where map_place_id=m),'last_verified_at',(select max(updated_at) from public.map_place_votes where map_place_id=m)) where private.public_map_place(m) or private.pending_map_place(m) or private.is_admin()
$$;

-- Voting is the "적합한지 아닌지" signal members leave on pending places, so
-- allow it there too. save/comment are unchanged (approved places only).
create or replace function private.community_command(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); a text:=payload->>'action'; target uuid:=(payload->>'id')::uuid; v integer; old_status text; result_id uuid; src public.places; dest public.places; mp record; other uuid; reason text:=btrim(payload->>'reason');
begin
 perform private.rate_limit('write',120);
 if a in('vote','comment') and not private.can_contribute() then raise exception '초대 기여자만 참여할 수 있습니다.' using errcode='42501'; end if;
 if a in('save','comment') and not private.public_map_place(target) then raise exception '공개된 장소를 찾을 수 없습니다.'; end if;
 if a='vote' and not (private.public_map_place(target) or private.pending_map_place(target)) then raise exception '공개된 장소를 찾을 수 없습니다.'; end if;
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

-- 3) Read-model for the theme map's own pending-review panel (list + tally),
-- separate from the admin console's full moderation queue.
create function public.map_pending_places(m uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r),'[]'::jsonb) from (
 select mp.id,mp.place_id,mp.map_id,p.name,p.address,p.category,extensions.st_y(p.location) lat,extensions.st_x(p.location) lng,mp.rationale,mp.status,mp.added_by,coalesce(pr.handle,'탈퇴한 기여자') handle,mp.created_at,
 (private.place_stats(mp.id)->>'positive')::int positive,(private.place_stats(mp.id)->>'negative')::int negative,
 coalesce((private.place_stats(mp.id)->>'saved_count')::int,0) saved_count,private.place_stats(mp.id)->>'last_verified_at' last_verified_at
 from public.map_places mp join public.places p on p.id=mp.place_id left join public.profiles pr on pr.id=mp.added_by
 where mp.map_id=m and private.pending_map_place(mp.id)
 order by mp.created_at desc limit 50
 ) r
$$;
revoke execute on function public.map_pending_places(uuid) from public;
grant execute on function public.map_pending_places(uuid) to anon,authenticated;

NOTIFY pgrst, 'reload schema';
