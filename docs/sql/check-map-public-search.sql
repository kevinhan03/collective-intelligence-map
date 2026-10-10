-- 읽기 전용 확인: 세 열 모두 true여야 합니다.
select
  to_regprocedure('public.search_map_places(jsonb)') is not null as search_function_exists,
  coalesce((select not prosecdef from pg_proc where oid=to_regprocedure('public.search_map_places(jsonb)')),false)
    and has_function_privilege('anon','public.search_map_places(jsonb)','execute')
    and has_function_privilege('authenticated','public.search_map_places(jsonb)','execute') as read_permissions_ok,
  public.search_normalize('　ＡＲＣＨＩＶＥ　Room　')='archive room'
    and public.search_compact('빈티지 숍')='빈티지숍' as normalization_ok;

-- 공개 지도 한 개의 기본 검색 응답을 확인합니다(최대 20건).
select t.title,public.search_map_places(jsonb_build_object('mapId',t.id,'q','','offset',0)) as result
from public.theme_maps t where t.status='published' order by t.id limit 1;
