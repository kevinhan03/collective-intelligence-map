-- Production-safe seed: a community only. No fictional venues/users/votes.
-- Add empty communities; places are contributed through the existing proposal flow.
insert into public.theme_maps (id, slug, title, description, rules, country, city, tags, bounds, status)
values
  ('55555555-5555-4555-8555-555555555555', 'korea-best-burger', 'Korea Best Burger',
   '전국 곳곳의 맛있는 버거집을 모아가는 지도입니다. 직접 먹어보고 만족했던 버거집이 있다면 추천해 주세요. 여러 사람의 추천을 모아 국내 최고의 버거 맛집들을 찾아보세요.',
   '포함: 버거 전문점과 버거를 주 메뉴로 제공하는 음식점. 제외: 버거와 무관한 장소, 광고성 등록, 중복 장소. 방문 경험과 구체적인 추천 이유를 남겨 주세요.',
   'KR', 'Korea', array['버거','수제버거','음식점'],
   '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb, 'published'),
  ('66666666-6666-4666-8666-666666666666', 'seoul-night-view', 'Seoul Night View',
   '서울의 아름다운 야경을 감상할 수 있는 장소들을 모아가는 지도입니다. 탁 트인 전망을 즐길 수 있는 곳부터 조용히 야경을 감상하기 좋은 숨은 명소까지, 나만 알고 있기 아까운 장소가 있다면 함께 추천해 주세요.',
   '포함: 서울의 야경 명소, 전망대, 공원, 야경을 볼 수 있는 공간. 제외: 서울 밖의 장소, 출입 금지 구역, 광고성 등록, 중복 장소. 방문 경험과 접근 방법을 남겨 주세요.',
   'KR', 'Seoul', array['야경','전망','산책'],
   '{"west":126.75,"south":37.4,"east":127.2,"north":37.72}'::jsonb, 'published'),
  ('77777777-7777-4777-8777-777777777777', 'korea-sauna-map', 'Korea Sauna Map',
   '전국 곳곳의 사우나와 찜질방을 모아가는 지도입니다. 시설이 좋거나 특별한 매력이 있는 곳부터 동네의 숨은 명소까지, 직접 방문해 보고 만족했던 곳이 있다면 함께 추천해 주세요.',
   '포함: 사우나, 찜질방, 목욕 시설. 제외: 주제와 무관한 장소, 광고성 등록, 중복 장소. 직접 이용한 경험과 구체적인 추천 이유를 남겨 주세요.',
   'KR', 'Korea', array['사우나','찜질방','목욕'],
   '{"west":124.5,"south":33.0,"east":132.0,"north":39.2}'::jsonb, 'published')
on conflict (slug) do nothing;
insert into public.theme_maps(id,slug,title,description,rules,country,city,tags,bounds,status)
values('11111111-1111-4111-8111-111111111111','tokyo-fashion','Tokyo Fashion Store','도쿄 곳곳에 있는 패션 매장들을 모아둔 지도입니다. 잘 알려진 유명 매장부터 숨겨진 로컬 숍까지, 도쿄에서 쇼핑할 만한 곳들을 함께 찾아보고 공유해 보세요.','포함: 독립 편집숍, 빈티지, 아카이브, 디자이너 공간. 제외: 주제 근거 없는 일반 쇼핑몰, 광고성 등록. 방문 경험과 구체적인 추천 근거를 남겨 주세요.','JP','Tokyo',array['빈티지','독립 편집숍','디자이너','아카이브'],'{"west":139.5,"south":35.5,"east":139.95,"north":35.85}','published')
on conflict(id) do nothing;

insert into public.theme_maps(id,slug,title,description,rules,country,city,tags,bounds,status)
values('22222222-2222-4222-8222-222222222222','korea-vintage','Korea Vintage Shop','전국 곳곳에 있는 빈티지샵을 모아둔 지도입니다. 오래된 옷부터 희소성 있는 아카이브 제품까지, 개성 있는 빈티지샵을 함께 찾아보고 공유해 보세요.','포함: 빈티지 의류·잡화, 아카이브, 리세일, 독립 빈티지 숍. 제외: 주제 근거 없는 일반 의류 매장, 광고성 등록, 중복 장소. 방문 경험과 구체적인 추천 근거를 남겨 주세요.','KR','Korea',array['빈티지','아카이브','리세일','독립 숍'],'{"west":124.5,"south":33.0,"east":132.0,"north":39.2}','published')
on conflict(id) do nothing;
