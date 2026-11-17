-- Enforce the curation policy below all RPCs, including service-role wrappers
-- which set the verified actor's JWT subject before writing.
create or replace function private.guard_place_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare domestic boolean;
begin
 -- Allow direct database maintenance/seed jobs without a web identity.
 if auth.uid() is null and session_user=(
   select pg_catalog.pg_get_userbyid(c.relowner) from pg_catalog.pg_class c
   where c.oid='public.places'::regclass
 ) then return new; end if;
 if private.is_admin() then return new; end if;
 if tg_table_name='places' then
  domestic := new.country='KR';
 elsif tg_table_name='theme_maps' then
  domestic := new.country='KR' and new.search_scope<>'world';
 else
  select m.country='KR' and m.search_scope<>'world' and p.country='KR'
    into domestic from public.theme_maps m cross join public.places p
    where m.id=new.map_id and p.id=new.place_id;
 end if;
 if domestic is distinct from true then
  raise exception '해외 지도에는 관리자만 장소를 등록할 수 있습니다.' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.guard_place_registration() from public,anon,authenticated;
drop trigger if exists guard_place_registration on public.places;
create trigger guard_place_registration before insert or update of country on public.places
for each row execute function private.guard_place_registration();
drop trigger if exists guard_place_registration on public.map_places;
create trigger guard_place_registration before insert or update of map_id,place_id on public.map_places
for each row execute function private.guard_place_registration();
drop trigger if exists guard_place_registration on public.theme_maps;
create trigger guard_place_registration before insert or update of country,search_scope on public.theme_maps
for each row execute function private.guard_place_registration();
