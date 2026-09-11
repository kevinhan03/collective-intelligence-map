-- Production-safe seed: a community only. No fictional venues/users/votes.
insert into public.theme_maps(id,slug,title,description,rules,country,city,tags,bounds,status)
values('11111111-1111-4111-8111-111111111111','tokyo-fashion','Tokyo Fashion','도쿄의 패션을 발견하는 사람들의 공개 지도. 독립 편집숍부터 빈티지 아카이브까지, 함께 추천하고 검증합니다.','포함: 독립 편집숍, 빈티지, 아카이브, 디자이너 공간. 제외: 주제 근거 없는 일반 쇼핑몰, 광고성 등록. 방문 경험과 구체적인 추천 근거를 남겨 주세요.','JP','Tokyo',array['빈티지','독립 편집숍','디자이너','아카이브'],'{"west":139.5,"south":35.5,"east":139.95,"north":35.85}','published')
on conflict(id) do nothing;

insert into public.theme_maps(id,slug,title,description,rules,country,city,tags,bounds,status)
values('22222222-2222-4222-8222-222222222222','korea-vintage','Korea Vintage','한국 곳곳의 빈티지 숍을 발견하는 공개 지도입니다. 오래된 의류와 아카이브, 개성 있는 선별을 함께 추천하고 검증합니다.','포함: 빈티지 의류·잡화, 아카이브, 리세일, 독립 빈티지 숍. 제외: 주제 근거 없는 일반 의류 매장, 광고성 등록, 중복 장소. 방문 경험과 구체적인 추천 근거를 남겨 주세요.','KR','Korea',array['빈티지','아카이브','리세일','독립 숍'],'{"west":124.5,"south":33.0,"east":132.0,"north":39.2}','published')
on conflict(id) do nothing;
