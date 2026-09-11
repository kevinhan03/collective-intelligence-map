-- The initial Korean community. Venues are intentionally contributed through
-- the Kakao-backed proposal flow instead of being copied from a provider.
insert into public.theme_maps(
  id, slug, title, description, rules, country, city, tags, bounds, status
)
values(
  '22222222-2222-4222-8222-222222222222',
  'korea-vintage',
  'Korea Vintage',
  '한국 곳곳의 빈티지 숍을 발견하는 공개 지도입니다. 오래된 의류와 아카이브, 개성 있는 선별을 함께 추천하고 검증합니다.',
  '포함: 빈티지 의류·잡화, 아카이브, 리세일, 독립 빈티지 숍. 제외: 주제 근거 없는 일반 의류 매장, 광고성 등록, 중복 장소. 방문 경험과 구체적인 추천 근거를 남겨 주세요.',
  'KR',
  'Korea',
  array['빈티지','아카이브','리세일','독립 숍'],
  '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb,
  'published'
)
on conflict (id) do nothing;
