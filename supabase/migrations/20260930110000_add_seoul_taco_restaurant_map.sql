-- A Korea-wide taco map; the requested public title is kept verbatim.
insert into public.theme_maps (
  slug, title, description, rules, country, city, tags, bounds, status
)
values (
  'seoul-taco-restaurant',
  'Seoul Taco Restaurant',
  '한국 곳곳의 타코 맛집을 함께 발견하고 추천하는 지도입니다.',
  '포함: 타코를 판매하는 식당과 푸드트럭. 제외: 타코를 판매하지 않는 일반 멕시칸 식당, 광고성 등록, 중복 장소. 직접 경험한 메뉴와 추천 이유를 남겨 주세요.',
  'KR',
  'Korea',
  array['타코', '멕시칸', '맛집'],
  '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb,
  'published'
)
on conflict (slug) do nothing;
