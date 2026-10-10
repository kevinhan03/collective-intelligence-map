# 검색·AI 노출 구조

## 구현

- 지도: 지역·태그·제목을 반영한 제목, 설명, canonical, Open Graph.
- 공개 장소 목록: `/maps/[slug]/places`, 40개씩 서버 출력과 이전·다음 링크.
- 공개 장소 소개: `/maps/[slug]/places/[place_id]`, 서버에서 주소·추천 이유·기여자·제안일 출력.
- 소개와 목록은 완성된 HTML을 반환하는 읽기 전용 Route Handler로 제공한다. 지도 탐색과 계정 기능은 기존 앱에서 사용한다. 목록의 후속 페이지는 `/maps/[slug]/places/page/[page]`다.
- Place / WebPage / BreadcrumbList / CollectionPage / ItemList 구조화 데이터. 주제 추천을 별점으로 변환하지 않음.
- 지도 상세의 공유는 장소 소개 URL로 연결. 기존 `?place=` 상세 열기는 그대로 지원.
- 사이트맵: 공개 지도와 활성 approved/disputed 장소를 500행씩 조회. 초기 지도 bounds와 500개 제한을 사용하지 않음.
- 로컬·데모·Vercel preview는 noindex. 운영 HTTPS 도메인과 Supabase 공개 설정이 있어야 사이트맵 생성.
- 계정·관리·제안 화면은 noindex. API·인증·관리·설정·외부 이동은 robots 크롤링 제외.
- 기존 public-community 태그 무효화로 새 장소 반영. 공개 장소 목록 캐시는 최대 10분.
- 지역·테마 페이지: `/maps/[slug]/areas/[지역키]`. 도시·구/군의 실제 주소를 기준으로 묶고 공개 장소가 3곳 이상인 서로 다른 장소 목록만 제공한다. 전체 지도와 동일한 목록, 도시와 구가 동일한 목록, 지역이 불명확한 주소는 별도 페이지를 생성하지 않는다. 명확한 서울 영문 구 이름은 한글 구 이름과 합친다.
- 지역 페이지는 40개씩 출력하며 `/page/[page]` 링크, 고유 canonical, CollectionPage·ItemList·BreadcrumbList를 포함한다. 해당 지역의 주소·추천 이유·장소 소개 링크와 다른 지역 탐색을 제공한다.
- 지도 전체 장소 목록과 장소 소개에서 지역 페이지로 연결하고, 자격을 갖춘 지역만 사이트맵에 포함한다. 장소 수가 줄어 기준을 충족하지 못하면 404/noindex로 전환한다. 지역 분류는 기존 검색·SQL 정규화와 별도로 적용하며 DB 변경은 없다.
- 공개 주소·추천 이유 목록은 통계 집계 없이 500행씩 조회해 캐시한다. 지역·사이트맵용 장소 목록도 최대 10분 캐시이며 공개 변경 명령의 태그 무효화를 따른다.

## 운영 반영 시

1. 운영 환경의 NEXT_PUBLIC_SITE_URL을 실제 대표 HTTPS 도메인으로 설정한다. localhost가 남으면 검색 노출이 차단된다.
2. 대표 도메인으로 www/비www, HTTP/HTTPS를 플랫폼에서 통일한다.
3. 배포 후 /robots.txt, /sitemap.xml과 새 장소 HTML·canonical을 확인한다.
4. Google Search Console과 Bing Webmaster Tools에 도메인을 인증하고 sitemap.xml을 제출한다. 소유자 인증은 계정에서 수행해야 한다.
5. 대표 지도·장소 URL의 색인 상태와 검색어를 확인하고 Bing AI Performance에서 인용을 확인한다.

## 장소 추가 시

목적과 관련된 사실을 추천 이유에 구체적으로 쓴다. 예: 빈티지 의류 종류, 가격대(확인 날짜 포함), 어떤 방문 목적에 적합한지. 알 수 없는 운영 시간·편의시설·출구 번호를 만들어 넣지 않는다. 짧은 키워드 반복보다 직접 확인한 설명과 사진이 중요하다.

## 후속 라우팅 판단

현재 테마 지도 → 공개 장소 목록 → 지역·테마 페이지 → 장소 고유 페이지 구조를 구현했다. 다음 단계는 충분한 방문 경험에 근거한 지역별 편집 안내이며 운영 시간·가격·시설을 추정해서 채우지 않는다. 임의 검색어별 무제한 페이지나 내용이 같은 지역별 페이지는 만들지 않는다. 장소가 50,000 URL 규모에 가까워지면 사이트맵 분할이 필요하다.

Google의 AI 검색은 기존 SEO 원칙을 사용하며 특별한 AI 전용 스키마나 llms.txt를 요구하지 않는다. 검색 순위와 AI 인용을 보장할 수는 없다.

## 소유권 인증과 배포 점검

- Google Search Console에서 **URL 접두어** 속성 `https://ting-map.vercel.app/`를 추가하고 HTML 태그 인증의 `content` 값만 `GOOGLE_SITE_VERIFICATION`에 설정한다. 도메인 속성은 DNS 인증이 필요하며 `vercel.app` 전체 소유권을 인증하는 방식은 사용하지 않는다.
- Bing Webmaster Tools에는 같은 URL을 추가해 `msvalidate.01` 태그의 `content` 값을 `BING_SITE_VERIFICATION`에 설정하거나 인증된 Search Console 속성을 가져온다.
- 두 값은 공개 인증 토큰이다. 계정 비밀번호·API 비밀키는 필요하지 않다. 운영 환경변수 설정 후 새 배포에 반영해야 한다. 미설정 시 가짜 인증 태그를 넣지 않는다. 로컬·preview에는 인증 태그를 출력하지 않는다.
- 배포 후 두 서비스에서 인증 완료를 누르고 `https://ting-map.vercel.app/sitemap.xml`을 제출한다. 인증 태그는 완료 후에도 유지한다.
- `npm run check:seo -- https://ting-map.vercel.app`은 HTTP 응답, 크롤링 차단, 사이트맵 URL, 대표 canonical, JavaScript 없이 읽는 Bing/OAI/Perplexity 표본과 실제 404를 점검한다. 처음에는 `npx playwright install chromium`이 필요할 수 있다. 이 명령은 외부 서비스 등록·색인 요청·DB 쓰기를 하지 않는다.

### 2026-10-10 배포 전 확인

- 현재 연결 프로젝트는 `ting-map`. 기존 runbook의 프로젝트 미생성 메모는 과거 기록이다.
- CLI로 확인한 Production `NEXT_PUBLIC_SITE_URL`은 `https://ting-map.vercel.app`로 올바르게 설정되어 있다. Google/Bing 인증 변수는 현재 목록에 없다.
- 운영 홈은 200이며 비밀번호·SSO·IP 기반 배포 보호는 비활성이다. 이것만으로 WAF 및 모든 봇의 접근을 보장하지 않는다.
- 운영 `robots.txt`, `sitemap.xml`, `/maps/korea-vintage/places`는 404다. 로컬 SEO 변경의 배포가 필요하며 운영 설정 완료로 보고하지 않는다.
- `collective-intelligence-map.vercel.app`도 같은 홈을 200으로 제공하며 대표 도메인으로 이동하지 않는다. 배포 반영 후 해당 별칭을 `ting-map.vercel.app`으로 리다이렉트하는 단계가 남는다. 실제 대표 URL을 유지하고 경로·쿼리를 보존해야 한다.
- 이 작업은 커밋·푸시·배포·원격 환경변수 변경·도메인 변경을 실행하지 않았다. 검색엔진 계정에서 발급되는 인증 토큰이 아직 필요하다.

인증 안내: [Google 소유권 인증](https://support.google.com/webmasters/answer/9008080), [Bing 사이트 추가·인증](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b).

참고: https://developers.google.com/search/docs/appearance/ai-features
참고: https://developers.google.com/search/docs/crawling-indexing/links-crawlable

## 운영 반영 결과 (2026-10-10)

- 사용자 승인에 따라 Git push 없이 로컬 소스를 기존 Vercel `ting-map` 프로젝트에 직접 배포했다. 커밋은 `119f595d8c1bcb94a07c72910dbaeb76a754ddde` 그대로이며 SEO 변경은 로컬 미커밋 상태다.
- 최종 배포 ID: `dpl_EaNS15jy839CASbtjGW1Vjssy7EE`. 빌드 완료 후 검토한 Production 배포를 `ting-map.vercel.app`에 promote했다. 첫 준비 빌드 `dpl_3SyQSvYMcnTUV7dwXD3KP4LkK2VC`는 최종 배포가 아니다.
- Google·Bing 공개 HTML 인증 토큰을 Production Config 환경변수에 등록하고 두 서비스에서 소유권 인증을 완료했다. 토큰은 소스에 하드코딩하지 않는다.
- 홈의 JavaScript 없는 환경에서 소개를 읽을 수 있도록 정적 `noscript` 안내를 제공한다. 일반 브라우저의 홈 디자인은 유지한다.
- 이전 별칭 `collective-intelligence-map.vercel.app`은 대표 도메인으로 308 리다이렉트한다. 홈, 장소 경로·쿼리, 사이트맵에서 경로와 쿼리 보존을 확인했다.
- 대표 도메인의 robots.txt·sitemap.xml은 200, XML 파싱 정상, 점검 시 113 URL을 포함했다. 장소 추가에 따라 수는 달라진다. 공개 지도·장소·지역 URL과 Bing/OAI/Perplexity의 JavaScript 없는 본문·canonical·색인 허용 표본 점검을 통과했다.
- 개별 Vercel 배포 URL에는 플랫폼 `X-Robots-Tag: noindex`가 붙는다. 대표 도메인은 noindex가 없음을 확인했다. staged URL의 플랫폼 noindex를 없애려 보안/검색 보호 설정을 변경하지 않았다.
- Vercel Firewall: Attack Mode Off, Bot Protection Off, AI Bots Allow. 기존 보안 설정은 변경하지 않았다.
- Google Search Console에서 사이트맵 제출 및 재제출 접수를 확인했다. 첫 처리 상태는 “가져올 수 없음”이어서 처리 성공을 아직 확인하지 못했다. Google의 실제 URL 테스트에서는 홈 “URL을 Google에 등록할 수 있음”을 확인했고 홈 색인 생성 요청은 우선순위 크롤링 대기열에 접수되었다. 요청은 실제 색인 완료와 다르다.
- Bing Webmaster Tools 소유권 인증은 완료했다. 사이트맵 직접 제출은 재시도에도 “An unexpected error occurred on the server side”로 실패했다. 사이트의 robots.txt에 사이트맵 경로를 제공하지만 Bing의 제출 성공으로 보고하지 않는다.
- 로컬 타입·린트·단위 84개·관련 브라우저 21개(의도적 제외 1개)·빌드 통과. DB 및 기존 장소 데이터 변경 없음.

### 보존 주의

GitHub에는 이번 소스가 아직 반영되지 않았다. 이후 Git 연동 배포가 현재 커밋 소스를 다시 배포하면 SEO 변경이 빠질 수 있다. 사용자가 커밋·푸시를 요청할 때 현재 미커밋 변경 전체를 보존해 반영해야 한다.

## 사이트맵 오류 진단 (2026-10-11 00:16 KST)

- 대표 도메인의 `/sitemap.xml`은 HTTP 200, `application/xml`, 12,690 bytes다. 표준 XML 파서로 urlset 네임스페이스와 중복 없는 동일 도메인 113 URL을 확인했다. 로그인 리다이렉트·noindex 응답 헤더·robots 차단은 없다.
- Vercel 최근 1시간 요청 로그에서 배포 전 10월 10일 23:24~23:30 KST에는 사이트맵 404가 확인된다. 최종 배포 후 대표 도메인 사이트맵 요청은 모두 200이다. 이 로그에는 User-Agent가 없으므로 과거 404 요청을 Google 요청이라고 단정하지 않는다.
- 10월 11일 00:15:53 KST Google URL Inspection에서 **사이트맵 URL 자체**를 실시간 검사했다. “크롤링 허용 여부: 예”, “페이지 가져오기: 성공”, “색인 생성 허용 여부: 예”를 확인했다. 홈 검사 결과로 사이트맵 접근을 추정한 것이 아니다. 사이트맵 파일의 색인 요청은 하지 않았다.
- 이후 Sitemaps 보고서는 여전히 “알 수 없음 / 가져올 수 없음 / 발견된 페이지 0”이다. 현재 Google 검사 도구의 접근은 정상이며 실제 사이트맵 처리 성공은 아직 확인되지 않았다. 배포 전 미존재 또는 일시적 실패·재처리 대기 가능성이 있으나 과거 Google fetch의 상세 원인은 제공되지 않아 확정할 수 없다.
- Bing은 앞서 제출 단계 자체에서 서버 오류가 발생했고 등록 목록이 비어 있었다. Google의 fetch 오류와 구분한다. XML을 Bing이 읽다가 실패한 것으로 해석할 근거는 없다.
- 진단에 따른 소스 수정·재배포·커밋·푸시는 없다. 사이트맵은 이미 재제출되어 있어 반복 재제출이나 불필요한 보안 설정 변경을 하지 않았다.

공식 진단 기준: [Google Sitemaps 보고서](https://support.google.com/webmasters/answer/7451001?hl=en). Google은 실제 URL 검사에서 크롤링 허용 및 가져오기 성공을 확인하도록 안내한다.
