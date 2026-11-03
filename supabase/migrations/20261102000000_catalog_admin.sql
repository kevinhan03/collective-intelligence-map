-- Private images and audit records are never exposed through the Data API.
create table private.catalog_images (
 id uuid primary key default gen_random_uuid(), map_id uuid not null references public.theme_maps on delete cascade,
 owner_id uuid references auth.users on delete set null, path text not null unique,
 state text not null default 'reserved' check(state in('reserved','ready','active','retired','deleting')),
 expires_at timestamptz not null default now()+interval '24 hours'
);
create table public.catalog_settings (
 map_id uuid primary key references public.theme_maps on delete cascade,
 value jsonb not null check(jsonb_typeof(value)='object'), version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users on delete set null
);
create table private.catalog_audit (
 id bigint generated always as identity primary key, map_id uuid not null,
 actor_id uuid references auth.users on delete set null, before_value jsonb, after_value jsonb not null,
 created_at timestamptz not null default now()
);
create index catalog_settings_image on public.catalog_settings((value->>'imageId')) where value->>'imageId' is not null;
create index catalog_images_expiry on private.catalog_images(expires_at);
create index catalog_images_owner_staging on private.catalog_images(owner_id) where state in ('reserved','ready');
alter table public.catalog_settings enable row level security;
alter table private.catalog_images enable row level security;
alter table private.catalog_audit enable row level security;
revoke all on public.catalog_settings from public,anon,authenticated;
grant select(map_id,value,version) on public.catalog_settings to anon,authenticated;
grant all on public.catalog_settings to service_role;
revoke all on private.catalog_images,private.catalog_audit from public,anon,authenticated;
create policy catalog_public_read on public.catalog_settings for select to anon,authenticated
 using(exists(select 1 from public.theme_maps m where m.id=map_id and m.status='published' and m.kind='community' and m.hidden_at is null));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('catalog-images','catalog-images',false,5242880,array['image/webp']) on conflict(id) do nothing;

create function private.admin_catalog_command(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a text:=payload->>'action'; item jsonb; mid uuid; old public.catalog_settings; v jsonb;
 img private.catalog_images; image_uuid uuid; allocated uuid; result jsonb;
begin
 if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 if a='snapshot' then
   return coalesce((select jsonb_agg(to_jsonb(c)) from public.catalog_settings c join public.theme_maps m on m.id=c.map_id where m.kind='community' and m.status='published' and m.hidden_at is null),'[]'::jsonb);
 elsif a='reserve' then
   mid:=(payload->>'mapId')::uuid;
   if not exists(select 1 from public.theme_maps where id=mid and kind='community' and status='published' and hidden_at is null) then raise exception '편집할 지도를 찾을 수 없습니다.'; end if;
   -- Bound abandoned upload reservations per administrator.
   if (select count(*) from private.catalog_images where owner_id=auth.uid() and state in('reserved','ready') and expires_at>now())>=100 then raise exception '임시 이미지가 너무 많습니다. 기존 작업을 적용하거나 만료 후 다시 시도해 주세요.'; end if;
   allocated:=gen_random_uuid();
   insert into private.catalog_images(id,map_id,owner_id,path) values(allocated,mid,auth.uid(),mid::text||'/'||allocated::text||'.webp') returning * into img;
   return jsonb_build_object('id',img.id,'path',img.path,'expiresAt',img.expires_at);
 elsif a='ready' then
   update private.catalog_images set state='ready' where id=(payload->>'imageId')::uuid and owner_id=auth.uid() and state='reserved' and expires_at>now()
      and exists(select 1 from storage.objects o where o.bucket_id='catalog-images' and o.name=catalog_images.path) returning * into img;
   if not found then raise exception '이미지가 만료되었습니다. 다시 선택해 주세요.'; end if;
   return jsonb_build_object('id',img.id,'expiresAt',img.expires_at);
 elsif a='apply' then
   if jsonb_typeof(payload->'changes') is distinct from 'array' then raise exception '변경 내용을 확인해 주세요.'; end if;
   if jsonb_array_length(payload->'changes') not between 1 and 100 then raise exception '한 번에 1~100개 지도를 적용할 수 있습니다.'; end if;
   if (select count(*)<>count(distinct e->>'mapId') from jsonb_array_elements(payload->'changes') e) then raise exception '중복된 지도입니다.'; end if;
   -- Serialize editor writes including settings not yet created; lock maps in a stable order.
   for item in select e from jsonb_array_elements(payload->'changes') e order by e->>'mapId' loop
     mid:=(item->>'mapId')::uuid;
     perform 1 from public.theme_maps where id=mid and kind='community' and status='published' and hidden_at is null for update;
     if not found then raise exception '편집할 지도를 찾을 수 없습니다.'; end if;
     select * into old from public.catalog_settings where map_id=mid;
     if jsonb_typeof(item->'version') is distinct from 'number' or (item->>'version')::numeric<0 or (item->>'version')::numeric<>trunc((item->>'version')::numeric) then raise exception '버전을 확인해 주세요.'; end if;
     if coalesce(old.version,0)<>(item->>'version')::integer then raise exception '다른 관리자가 수정했습니다.' using errcode='40001'; end if;
     if jsonb_typeof(item->'title') is distinct from 'string' or length(btrim(item->>'title')) not between 1 and 80
       or jsonb_typeof(item->'region') is distinct from 'string' or length(item->>'region')>60
       or (item->>'category' is not null and item->>'category' not in('food','fashion','travel','rest'))
       or not (item ? 'category') or not(item ? 'imageId') then raise exception '표시 정보를 확인해 주세요.'; end if;
     if jsonb_typeof(item->'aliases') is distinct from 'array' then raise exception '검색 별칭을 확인해 주세요.'; end if;
     if jsonb_array_length(item->'aliases')>20 or exists(select 1 from jsonb_array_elements(item->'aliases') t where jsonb_typeof(t)<>'string' or length(btrim(t#>>'{}')) not between 1 and 60) then raise exception '검색 별칭은 60자 이하로 20개까지 입력할 수 있습니다.'; end if;
     if jsonb_typeof(item->'focalX') is distinct from 'number' or jsonb_typeof(item->'focalY') is distinct from 'number' then raise exception '사진 위치를 확인해 주세요.'; end if;
     if (item->>'focalX')::numeric not between 0 and 100 or (item->>'focalY')::numeric not between 0 and 100 then raise exception '사진 위치를 확인해 주세요.'; end if;
     image_uuid:=(item->>'imageId')::uuid;
     if image_uuid is distinct from (old.value->>'imageId')::uuid then
       if image_uuid is null then raise exception '새 사진을 선택하거나 이 지도의 변경을 되돌려 주세요.'; end if;
       select * into img from private.catalog_images where id=image_uuid for update;
       if not found or img.map_id<>mid or img.owner_id<>auth.uid() or img.state<>'ready' or img.expires_at<=now() then raise exception '임시 이미지가 만료되었거나 사용할 수 없습니다. 사진을 다시 선택해 주세요.'; end if;
       update private.catalog_images set state='active' where id=image_uuid;
       update private.catalog_images set state='retired',expires_at=now()+interval '24 hours' where id=(old.value->>'imageId')::uuid;
     end if;
     v:=coalesce(old.value,jsonb_build_object('image','','order',2147483647,'wholeSubject',false));
     if image_uuid is distinct from (old.value->>'imageId')::uuid then v:=v||jsonb_build_object('wholeSubject',false); end if;
     v:=v||jsonb_build_object('title',btrim(item->>'title'),'category',item->'category','region',btrim(item->>'region'),
       'aliases',item->'aliases','imageId',image_uuid,'focalX',item->'focalX','focalY',item->'focalY',
       'focalPoint',(item->>'focalX')||'% '||(item->>'focalY')||'%');
     insert into public.catalog_settings(map_id,value,version,updated_by) values(mid,v,1,auth.uid())
       on conflict(map_id) do update set value=excluded.value,version=catalog_settings.version+1,updated_at=now(),updated_by=auth.uid();
     insert into private.catalog_audit(map_id,actor_id,before_value,after_value) values(mid,auth.uid(),old.value,v);
   end loop;
   return jsonb_build_object('ok',true);
 end if;
 raise exception '지원하지 않는 작업입니다.';
end $$;
revoke all on function private.admin_catalog_command(jsonb) from public,anon;
grant execute on function private.admin_catalog_command(jsonb) to authenticated;
create function public.admin_catalog_command(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_catalog_command(payload) $$;
revoke all on function public.admin_catalog_command(jsonb) from public,anon;
grant execute on function public.admin_catalog_command(jsonb) to authenticated;

create function private.catalog_image_access(image_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('path',i.path) from private.catalog_images i where i.id=image_id and (
   exists(select 1 from public.catalog_settings c join public.theme_maps m on m.id=c.map_id where c.value->>'imageId'=i.id::text and m.status='published' and m.kind='community' and m.hidden_at is null)
   or (private.is_admin() and i.owner_id=auth.uid() and i.state in('ready','reserved') and i.expires_at>now())
 )
$$;
create function public.catalog_image_access(image_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.catalog_image_access(image_id) $$;
revoke all on function private.catalog_image_access(uuid),public.catalog_image_access(uuid) from public;
grant execute on function private.catalog_image_access(uuid),public.catalog_image_access(uuid) to anon,authenticated;

-- Claim before storage removal. Claimed images cannot race with an apply.
create function private.catalog_image_cleanup(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if payload->>'action'='ack' then
   delete from private.catalog_images where id=(payload->>'id')::uuid and state='deleting';
   return 'true'::jsonb;
 end if;
 with jobs as (select i.id from private.catalog_images i where (i.expires_at<now() or i.state='deleting') and not exists(select 1 from public.catalog_settings c where c.value->>'imageId'=i.id::text) order by i.id limit 100 for update skip locked),
 claimed as (update private.catalog_images i set state='deleting' from jobs where i.id=jobs.id returning i.id,i.path)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
 return result;
end $$;
create function public.catalog_image_cleanup(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.catalog_image_cleanup(payload) $$;
revoke all on function private.catalog_image_cleanup(jsonb),public.catalog_image_cleanup(jsonb) from public,anon,authenticated;
grant execute on function private.catalog_image_cleanup(jsonb),public.catalog_image_cleanup(jsonb) to service_role;

-- Seed only existing community maps; original map records are untouched.
insert into public.catalog_settings(map_id,value)
select m.id,e->'value' from jsonb_array_elements('[{"slug":"korea-vintage","value":{"title":"전국 빈티지숍","category":"fashion","aliases":["빈티지샵","vintage","세컨핸드"],"image":"/korea-vintage-shop.jpg","focalPoint":"50% 52%","order":0,"featured":true,"reason":"오래된 옷 속에서 나만의 취향을 발견해요","imageId":null,"focalX":50,"focalY":52}},{"slug":"tokyo-fashion","value":{"title":"도쿄 패션 스토어","category":"fashion","aliases":["tokyo","東京","일본 쇼핑"],"image":"/tokyo-fashion-store-interior.jpg","order":1,"imageId":null,"focalX":50,"focalY":50}},{"slug":"korea-fashion-store","value":{"title":"국내 브랜드·편집숍","category":"fashion","aliases":["디자이너","쇼룸","플래그십","국내 브랜드"],"image":"/korea-fashion-store.jpg","focalPoint":"50% 65%","order":2,"imageId":null,"focalX":50,"focalY":65}},{"slug":"seoul-taco-restaurant","value":{"region":"서울","title":"서울 타코 맛집","category":"food","aliases":["taco","멕시칸"],"image":"/seoul-taco-restaurant.jpg","order":3,"imageId":null,"focalX":50,"focalY":50}},{"slug":"korea-best-burger","value":{"title":"전국 수제버거","category":"food","aliases":["햄버거","burger"],"image":"/korea-best-burger-whole.jpeg","focalPoint":"50% 70%","wholeSubject":true,"order":4,"imageId":null,"focalX":50,"focalY":70}},{"slug":"choiza-road-restaurants","value":{"title":"최자로드 맛집","category":"food","aliases":["최자","최자로드"],"image":"/choiza-road-restaurants.jpeg","order":5,"imageId":null,"focalX":50,"focalY":50}},{"slug":"seoul-night-view","value":{"title":"서울 야경 명소","category":"travel","aliases":["야경","전망","night view","서울"],"image":"/seoul-night-view.jpg","order":6,"imageId":null,"focalX":50,"focalY":50}},{"slug":"korea-sauna-map","value":{"title":"전국 사우나·숯가마","category":"rest","aliases":["sauna","찜질방","목욕","숯가마"],"image":"/korea-sauna-map.webp","order":7,"imageId":null,"focalX":50,"focalY":50}},{"slug":"korea-ramen-restaurant","value":{"title":"전국 라멘 맛집","category":"food","aliases":["ramen","일식"],"image":"/korea-ramen-restaurant.jpg","order":8,"imageId":null,"focalX":50,"focalY":50}}]'::jsonb) e
join public.theme_maps m on m.slug=e->>'slug' and m.kind='community'
on conflict(map_id) do nothing;
