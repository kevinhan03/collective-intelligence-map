-- Add empty communities; places are contributed through the existing proposal flow.
insert into public.theme_maps (id, slug, title, description, rules, country, city, tags, bounds, status)
values
  ('55555555-5555-4555-8555-555555555555', 'korea-best-burger', 'Korea Best Burger',
   '한국 곳곳의 맛있는 버거를 찾는 지도입니다. 직접 먹어 본 버거와 추천 이유를 함께 나눕니다.',
   '포함: 버거 전문점과 버거를 주 메뉴로 제공하는 음식점. 제외: 버거와 무관한 장소, 광고성 등록, 중복 장소. 방문 경험과 구체적인 추천 이유를 남겨 주세요.',
   'KR', 'Korea', array['버거','수제버거','음식점'],
   '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb, 'published'),
  ('66666666-6666-4666-8666-666666666666', 'seoul-night-view', 'Seoul Night View',
   '서울의 야경을 즐길 수 있는 장소를 모으는 지도입니다. 전망과 접근 방법, 방문 경험을 함께 나눕니다.',
   '포함: 서울의 야경 명소, 전망대, 공원, 야경을 볼 수 있는 공간. 제외: 서울 밖의 장소, 출입 금지 구역, 광고성 등록, 중복 장소. 방문 경험과 접근 방법을 남겨 주세요.',
   'KR', 'Seoul', array['야경','전망','산책'],
   '{"west":126.75,"south":37.4,"east":127.2,"north":37.72}'::jsonb, 'published'),
  ('77777777-7777-4777-8777-777777777777', 'korea-sauna-map', 'Korea Sauna Map',
   '한국 곳곳의 사우나와 찜질방을 찾는 지도입니다. 시설과 이용 경험, 추천 이유를 함께 나눕니다.',
   '포함: 사우나, 찜질방, 목욕 시설. 제외: 주제와 무관한 장소, 광고성 등록, 중복 장소. 직접 이용한 경험과 구체적인 추천 이유를 남겨 주세요.',
   'KR', 'Korea', array['사우나','찜질방','목욕'],
   '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb, 'published')
on conflict (slug) do nothing;
