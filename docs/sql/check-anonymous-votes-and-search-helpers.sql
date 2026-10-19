-- 읽기 전용 확인: 모든 열이 true여야 합니다.
select
  to_regclass('public.anonymous_map_place_votes') is not null as anonymous_table_exists,
  not has_table_privilege('anon','public.anonymous_map_place_votes','select')
    and not has_table_privilege('authenticated','public.anonymous_map_place_votes','select')
    and has_table_privilege('service_role','public.anonymous_map_place_votes','select') as anonymous_table_private,
  has_function_privilege('service_role','public.record_anonymous_vote(uuid,text,smallint)','execute')
    and not has_function_privilege('anon','public.record_anonymous_vote(uuid,text,smallint)','execute') as record_vote_ok,
  has_function_privilege('authenticated','private.merge_anonymous_votes(text)','execute')
    and not has_function_privilege('anon','private.merge_anonymous_votes(text)','execute')
    and has_function_privilege('authenticated','public.merge_anonymous_votes(text)','execute')
    and not has_function_privilege('anon','public.merge_anonymous_votes(text)','execute') as merge_votes_ok,
  exists(select 1 from pg_trigger where tgname='move_anonymous_votes_after_merge' and not tgisinternal) as merge_trigger_ok,
  to_regprocedure('private.guard_creator_vote()') is null
    or exists(select 1 from pg_trigger where tgname='guard_creator_vote' and tgrelid='public.anonymous_map_place_votes'::regclass) as creator_guard_ok,
  public.search_compact('빈티지 숍')='빈티지숍'
    and public.search_city('서울 용산구 용산동2가 45-9')='서울'
    and public.search_area('서울 용산구 용산동2가 45-9')='서울 · 용산구'
    and public.search_category('cafe')='카페' as search_helpers_ok;

-- 공개 지도 한 개의 검색이 오류 없이 응답하는지 확인합니다. mode가 'full'이어야 합니다.
select t.title,
  public.search_map_places(jsonb_build_object('mapId',t.id,'q','','offset',0))->>'mode' as mode,
  public.search_map_places(jsonb_build_object('mapId',t.id,'q','','offset',0))->>'total' as total
from public.theme_maps t where t.status='published' order by t.id limit 1;
