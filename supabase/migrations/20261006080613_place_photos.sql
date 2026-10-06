create table public.place_photos (
 id uuid primary key,
 place_id uuid not null references public.places,
 author_id uuid references public.profiles on delete set null,
 caption text not null default '' check(length(caption)<=300),
 file_path text not null,
 thumbnail_path text not null,
 width integer,
 height integer,
 status text not null default 'uploading' check(status in ('uploading','visible','hidden','deleted')),
 lease uuid,
 cleanup_paths text[] not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status not in ('visible','hidden') or (width>0 and height>0 and width is not null and height is not null))
);
create index place_photos_listing on public.place_photos(place_id,created_at desc,id desc) where status='visible';
create index place_photos_place on public.place_photos(place_id);
create index place_photos_author on public.place_photos(author_id);
alter table public.place_photos enable row level security;
create policy photos_read on public.place_photos for select using ((status='visible' and private.visible_place(place_id)) or author_id=(select auth.uid()) or private.is_admin());
revoke all on public.place_photos from anon,authenticated;
grant select on public.place_photos to anon,authenticated;
grant all on public.place_photos to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('place-photos','place-photos',false,3145728,array['image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No object policies for visitors or members: only the validated server writes/reads files.

alter table public.reports add column photo_id uuid references public.place_photos;
alter table public.reports drop constraint reports_check;
alter table public.reports add constraint reports_check check(num_nonnulls(map_place_id,comment_id,photo_id)=1);
create unique index report_open_photo on public.reports(reporter_id,photo_id) where status='open';
alter table private.moderation_actions add column photo_id uuid references public.place_photos;
create index reports_photo on public.reports(photo_id) where photo_id is not null;
create index moderation_actions_photo on private.moderation_actions(photo_id) where photo_id is not null;

create function private.reserve_place_photo(p_id uuid,p_place uuid,p_caption text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); r public.place_photos;
begin
 if not private.can_contribute() then raise exception '사진을 등록할 권한이 없습니다.' using errcode='42501'; end if;
 if not private.visible_place(p_place) then raise exception '공개된 장소를 찾을 수 없습니다.'; end if;
 perform private.rate_limit('photo',20);
 -- Serialize both initial creation and retries for this upload ID.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into r from public.place_photos where id=p_id for update;
 if r.id is not null then
  if r.author_id is distinct from u or r.place_id<>p_place then raise exception '이 사진에 대한 권한이 없습니다.' using errcode='42501'; end if;
  if r.status='visible' then return to_jsonb(r); end if;
  if r.status in ('hidden','deleted') then raise exception '삭제되거나 숨김 처리된 사진입니다.'; end if;
  if r.lease is not null and r.updated_at>now()-interval '10 minutes' then raise exception '사진을 처리 중입니다. 잠시 후 다시 시도해 주세요.'; end if;
  update public.place_photos set caption=p_caption,lease=p_lease,
   cleanup_paths=cleanup_paths||array[file_path,thumbnail_path],
   file_path=u::text||'/'||p_id::text||'/'||p_lease::text||'.webp',
   thumbnail_path=u::text||'/'||p_id::text||'/'||p_lease::text||'-thumb.webp',updated_at=now()
   where id=p_id returning * into r;
 else
  insert into public.place_photos(id,place_id,author_id,caption,lease,file_path,thumbnail_path)
  values(p_id,p_place,u,p_caption,p_lease,u::text||'/'||p_id::text||'/'||p_lease::text||'.webp',u::text||'/'||p_id::text||'/'||p_lease::text||'-thumb.webp') returning * into r;
 end if;
 return to_jsonb(r);
end $$;
create function public.reserve_place_photo(p_id uuid,p_place uuid,p_caption text,p_lease uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.reserve_place_photo(p_id,p_place,p_caption,p_lease) $$;
revoke all on function private.reserve_place_photo(uuid,uuid,text,uuid),public.reserve_place_photo(uuid,uuid,text,uuid) from public;
grant execute on function private.reserve_place_photo(uuid,uuid,text,uuid),public.reserve_place_photo(uuid,uuid,text,uuid) to authenticated;

create function public.finish_place_photo(p_id uuid,p_lease uuid,p_width integer,p_height integer) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update public.place_photos set status='visible',lease=null,width=p_width,height=p_height,updated_at=now()
 where id=p_id and lease=p_lease and status='uploading' and private.visible_place(place_id)
 and not exists(select 1 from private.user_roles where user_id=author_id and suspended);
 return found;
end $$;
create function public.fail_place_photo(p_id uuid,p_lease uuid) returns void language sql security invoker set search_path='' as $$
 update public.place_photos set lease=null,cleanup_paths=cleanup_paths||array[file_path,thumbnail_path],updated_at=now() where id=p_id and lease=p_lease and status='uploading'
$$;
create function public.ack_photo_cleanup(p_id uuid,p_paths text[]) returns void language sql security invoker set search_path='' as $$
 update public.place_photos set cleanup_paths=array(select x from unnest(cleanup_paths) x where not(x=any(p_paths))) where id=p_id
$$;
revoke all on function public.finish_place_photo(uuid,uuid,integer,integer),public.fail_place_photo(uuid,uuid),public.ack_photo_cleanup(uuid,text[]) from public,anon,authenticated;
grant execute on function public.finish_place_photo(uuid,uuid,integer,integer),public.fail_place_photo(uuid,uuid),public.ack_photo_cleanup(uuid,text[]) to service_role;

-- Preserve the current command implementation, including anonymous-vote/admin changes.
alter function private.community_command(jsonb) rename to community_command_before_photos;
revoke all on function private.community_command_before_photos(jsonb) from public,anon,authenticated;
create function private.community_command(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a text:=payload->>'action'; u uuid; target uuid; r public.place_photos; reason text:=btrim(payload->>'reason');
begin
 if a not in ('delete_photo','hide_photo') and not(a='report' and payload->>'target'='photo') then
  return private.community_command_before_photos(payload);
 end if;
 u:=private.require_user(); target:=(payload->>'id')::uuid;
 perform private.rate_limit('write',120);
 if not private.can_contribute() then raise exception '참여 권한이 없습니다.' using errcode='42501'; end if;
 select * into r from public.place_photos where id=target for update;
 if r.id is null then raise exception '사진을 찾을 수 없습니다.'; end if;
 if a='delete_photo' then
  if r.author_id is distinct from u then raise exception '본인 사진만 삭제할 수 있습니다.' using errcode='42501'; end if;
  update public.place_photos set status='deleted',lease=null,cleanup_paths=cleanup_paths||array[file_path,thumbnail_path],updated_at=now() where id=target;
 elsif a='hide_photo' then
  if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  if reason is null or length(reason) not between 5 and 1000 then raise exception '처리 사유를 입력해 주세요.'; end if;
  if r.status not in ('visible','hidden') then raise exception '공개 사진이 아닙니다.'; end if;
  update public.place_photos set status='hidden',updated_at=now() where id=target;
  insert into private.moderation_actions(actor_id,action,photo_id,place_id,reason,before_state,after_state)
  values(u,a,target,r.place_id,reason,jsonb_build_object('status',r.status),jsonb_build_object('status','hidden'));
 else
  perform private.rate_limit('report',10);
  if r.status<>'visible' or not private.visible_place(r.place_id) then raise exception '신고 대상을 찾을 수 없습니다.'; end if;
  insert into public.reports(reporter_id,photo_id,reason) values(u,target,reason) on conflict do nothing;
 end if;
 return jsonb_build_object('ok',true,'id',target);
end $$;
revoke all on function private.community_command(jsonb) from public;
grant execute on function private.community_command(jsonb) to authenticated;

create function private.move_photos_after_merge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='merged' and new.merged_into_id is distinct from old.merged_into_id then
  update public.place_photos set place_id=new.merged_into_id where place_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.move_photos_after_merge() from public;
create trigger move_photos_after_merge after update of merged_into_id on public.places for each row execute function private.move_photos_after_merge();

alter function private.admin_snapshot() rename to admin_snapshot_before_photos;
revoke all on function private.admin_snapshot_before_photos() from public,anon,authenticated;
create function private.admin_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 result:=private.admin_snapshot_before_photos();
 return result||jsonb_build_object('reports',(select coalesce(jsonb_agg(x),'[]'::jsonb) from(
  select r.*,coalesce(c.body,ph.caption) body,coalesce(p.name,pp.name) name,ph.status photo_status
  from public.reports r left join public.comments c on c.id=r.comment_id
  left join public.map_places mp on mp.id=r.map_place_id left join public.places p on p.id=mp.place_id
  left join public.place_photos ph on ph.id=r.photo_id left join public.places pp on pp.id=ph.place_id
  where r.status='open' order by r.created_at limit 100
 ) x));
end $$;
revoke all on function private.admin_snapshot() from public;
grant execute on function private.admin_snapshot() to authenticated;
NOTIFY pgrst,'reload schema';
grant execute on function private.visible_place(uuid) to service_role;
grant select on private.user_roles to service_role;
create function public.expire_photo_uploads() returns setof uuid language sql security invoker set search_path='' as $$
 update public.place_photos set status='deleted',lease=null,cleanup_paths=cleanup_paths||array[file_path,thumbnail_path],updated_at=now()
 where status='uploading' and updated_at<now()-interval '1 hour' returning id
$$;
revoke all on function public.expire_photo_uploads() from public,anon,authenticated;
grant execute on function public.expire_photo_uploads() to service_role;
