-- Korean fashion labels and select shops outside department stores.
insert into public.theme_maps (
  id, slug, title, description, rules, country, city, tags, bounds, status
)
values (
  '88888888-8888-4888-8888-888888888888',
  'korea-fashion-store',
  'Korea Fashion Store',
  '국내 패션 브랜드의 플래그십 스토어와 쇼룸, 그리고 개성 있는 편집숍을 모아둔 지도입니다. 백화점 매장은 제외하고, 브랜드의 공간과 취향을 직접 경험할 수 있는 매장을 함께 찾아보세요.',
  '포함: 국내 패션 브랜드의 단독 매장·플래그십 스토어·쇼룸, 독립 편집숍. 제외: 백화점에 입점한 브랜드 매장, 일반 쇼핑몰 매장, 광고성 등록, 중복 장소. 방문 경험과 구체적인 추천 이유를 남겨 주세요.',
  'KR',
  'Korea',
  array['국내 브랜드', '플래그십', '쇼룸', '편집숍'],
  '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb,
  'published'
)
on conflict (slug) do nothing;
