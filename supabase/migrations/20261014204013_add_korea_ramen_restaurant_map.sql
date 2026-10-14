-- Korean ramen restaurants; places are contributed through the existing proposal flow.
insert into public.theme_maps (
  id, slug, title, description, rules, country, city, tags, bounds, status
)
values (
  '99999999-9999-4999-8999-999999999999',
  'korea-ramen-restaurant',
  'Korea Ramen Restaurant',
  '국내 곳곳의 라멘 전문점을 모아가는 지도입니다. 진한 돈코츠부터 개성 있는 쇼유, 시오, 이에케까지 직접 먹어 본 한 그릇을 함께 추천해 주세요.',
  '포함: 라멘을 주 메뉴로 제공하는 전문점. 제외: 라멘이 부메뉴인 일반 일식당, 인스턴트 라면 전문점, 광고성 등록, 중복 장소. 방문한 메뉴와 추천 이유를 남겨 주세요.',
  'KR',
  'Korea',
  array['라멘', '일식', '맛집'],
  '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb,
  'published'
)
on conflict (slug) do nothing;
