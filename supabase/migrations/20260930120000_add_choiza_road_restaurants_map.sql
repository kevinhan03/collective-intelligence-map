insert into public.theme_maps (
  slug, title, description, rules, country, city, tags, bounds, status
)
values (
  'choiza-road-restaurants',
  '최자로드 맛집',
  '최자로드에 소개된 한국 곳곳의 맛집을 함께 기록하고 확인하는 지도입니다.',
  '포함: 최자로드 콘텐츠에 소개된 식당. 제외: 소개 여부를 확인할 수 없는 장소, 광고성 등록, 중복 장소. 소개된 콘텐츠와 직접 방문한 경험을 추천 근거에 적어 주세요.',
  'KR',
  'Korea',
  array['최자로드', '맛집', '식당'],
  '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb,
  'published'
)
on conflict (slug) do nothing;
