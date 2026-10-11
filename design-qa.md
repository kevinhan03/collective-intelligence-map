# Mobile home reference implementation — 2026-10-04

Source visual truth: the three user-provided mobile screenshots in this conversation: image 3 (collapsed cards and search button), image 1 (expanded card), image 2 (expanded search). Source pixels: 945 × 2048 as displayed, originally 1179 × 2556. Compare app content, excluding status bar, with existing Ting map imagery and charcoal/lime palette as explicitly requested.

Implementation: http://localhost:3000/; Chrome browser viewport 393 × 852 CSS px. Browser captures are 378 × 819 raster px (browser capture scale ~0.962); reference is normalized conceptually by width to the same mobile content scale. Screenshots: `artifacts/mobile-home-reference/collapsed.png`, `expanded.png`, `search.png`. These are real browser captures with the four existing maps. Existing desktop QA is retained below.

## Mobile findings and comparison history

1. P1: inherited page width and grid min-content sizing pushed the cards beyond the right viewport edge. Fixed the mobile-home page width and grid column minimum; subsequent browser capture and 360/390/430/768px tests show no horizontal overflow.
2. P1: the global heavy heading font did not match the reference's light regular headings. Set the card title to the existing variable SUIT face at weight 400, approximately 24px at 393px, with reference-like line height and 28px inset. Revised capture has regular rather than heavy titles.
3. P2: reference imagery is dimmer than the initial implementation. Reduced image brightness and retained the soft inset edge illumination. `collapsed.png` shows the revised balance.
4. P2: the first search implementation contained a second filter row absent from the reference. Removed the row; `search.png` now shows a single floating pill with genuine backdrop blur, translucent fill and highlighted border.
5. P1 local-preview issue: the Next development indicator intercepted the bottom-left search button. Disabled that development indicator; compile/runtime error reporting remains available.

## Required fidelity surfaces

- Typography: thin regular title, white foreground, no secondary content on collapsed cards; existing Korean SUIT retained. The supplied titles are shorter than the reference article headlines, so their line wrapping differs intentionally.
- Spacing/layout: 8px outer inset, 9px card gaps, 40px corners, roughly 160px cover height at phone widths. Expanded image header flows into a 56px metadata strip and description body, with overlapping round close button. Body height follows the existing description rather than padding it to match the much longer sample article.
- Colors/tokens: dark imagery, charcoal page and expanded surfaces, lime navigation arrow/focus accent. The reference's white page and white description panel are intentionally mapped to this product's palette.
- Image quality: existing four map covers reused. No reference article photos copied and no new photo assets invented. Cover subject mismatch for the vintage map remains an existing asset limitation outside this change.
- Copy: only map name on collapsed cards. Open preview contains existing location, place count, description and follower count; map entry works via the second title tap or arrow.
- Glass: 22px backdrop blur with saturation, translucent fill, thin light border and inner highlights; image details blur visibly beneath the expanded search pill. Card edge treatment is a CSS surface effect, not a generated replacement for imagery.

Full-view evidence: compare the three supplied reference states with the corresponding implementation captures above. Focused regions: card title/radius/inset, expanded header-to-metadata junction and close button, search pill border and blurred image beneath it. These captures support a visual adaptation assessment, not a pixel-diff or identical-photo claim.

## Interactions and checks

- First tap opens inline preview without navigation; second title tap and arrow link navigate to the intended map. Close restores keyboard focus; Escape collapses the preview.
- Bottom search visible initially, hidden after scrolling down, restored on upward scroll. Real browser observations: down at y=260 → hidden, up to y=160 → visible.
- Search input autofocus, filtering, empty-result reset, Escape close and query retention checked. Keyboard viewport offset handling implemented; real iPhone software keyboard not tested.
- Full E2E suite: 22 passed, 15 intentionally skipped, 1 scroll test initially failed because it scrolled before the opening animation created a scrollable page. That test now uses a shorter viewport and reduced-motion preference; targeted rerun passed. All 23 applicable cases have passed across those runs.
- Typecheck, lint, 50 unit tests and production build passed. Browser error log empty during home/preview/search inspection. Desktop 1024/1440px regression checks passed.

## Follow-up polish / limitations

- Actual phone touch/keyboard and Safari rendering remain unverified; inspect on the user's phone before judging those surfaces final.
- Glow and glass are browser-rendered approximations of a screenshot, with intentional palette and image substitutions. No pixel-identical claim is made.
- No deployment performed.

Implementation checklist: [x] collapsed cards [x] inline preview [x] two-stage navigation [x] glass search [x] scroll direction behavior [x] responsive and desktop regression checks.

final result: passed

---

# Earlier desktop glass reference adaptation QA

Source visual truth: user screenshots dated 2026-09-11 22.12.39, 22.12.56, 22.14.13, 22.15.32, and 22.18.15 in /Users/kevin_han/Desktop.
Implementation screenshot: /tmp/collective-glass-desktop.png (1470 × 776 browser capture).
State: Tokyo Fashion map with two approved places; desktop. References are style references, not equivalent product screens: compare surface treatment rather than dashboard content or full-frame geometry. No pixel-exact cloning claimed.

## Comparison
- Typography: existing Geist and Korean fallback retained; white headings and lighter secondary text remain legible after background dimming.
- Layout: rounded outer frame, inset cards and floating filter bar adapt references 1/5. Existing desktop 20:80 split retained. Reference 3 informs consistent card gaps.
- Tokens: smoky blue-gray translucent panels replace opaque green-gray panels; lemon remains the action color. Inner highlight and thin borders define layers.
- Assets: generated photographic glass atmosphere at public/glass-atmosphere.png; no smart-home pictures or analytics content copied into the product.
- Copy: existing community and place content retained.
- Focused comparison: header text initially disappeared over a bright patch. Multiply backdrop treatment fixed this in the second capture. Place cards now have individually visible edges and consistent padding instead of undifferentiated rows.

## Verification
- Lint and production build passed.
- Existing desktop/mobile E2E: 6 passed (discovery, filters, detail, protected participation and Google login).
- Browser map capture inspected; console error list empty.
- Mobile screenshot comparison not performed; mobile interaction checks passed via E2E.

## History
1. Initial bright backdrop reduced header contrast (P1).
2. Applied dark multiply treatment; recaptured at same viewport. Header and description readable, glass illumination retained.

## Follow-up polish
- P3: consider per-theme editorial imagery in a future homepage iteration. Current scope adapts common surfaces and the map experience.

final result: passed


---

# 장소 제안 단계형 화면 — 2026-10-11

final result: passed

## 비교 범위와 근거

- 선택한 세 번째 시안: `/Users/kevin_han/.codex/generated_images/01a115a2-9078-76e1-8470-3dca7f3ebd20/exec-a5d29c66-72e3-41f5-9797-cab37538d102.png`.
- 실제 로컬 페이지: `http://127.0.0.1:3000/maps/tokyo-fashion/submit`.
- 같은 데스크톱 비율의 시안과 구현을 나란히 합성해 직접 비교: `artifacts/seo/proposal-comparison.png`. 원본 1716×916, 브라우저 캡처 1702×908로 약 1% 차이가 있으며 픽셀 단위 일치를 주장하지 않는다.
- 구현 캡처: `artifacts/seo/proposal-desktop.png`, 모바일 390×844 `artifacts/seo/proposal-mobile.png`.
- 실제 페이지는 비로그인·Tokyo 지도이며 시안은 로그인한 운영자·Burger 지도다. 로그인 안내 및 비활성 버튼, 지도명, 공개 정책 문구는 정상적인 상태 차이다. 기존 공통 내비게이션을 유지했다.

## 수정과 재확인

1. P2: 최초 검색창 배경이 시안보다 밝은 올리브색이었다. 입력 토큰 대신 투명한 어두운 표면을 적용했다. 재로드 후 데스크톱·모바일에서 수정 확인.
2. P2: 최초 본문 제목과 상단 간격이 시안보다 작았다. 데스크톱 상단 여백, 단계와 질문 사이 간격, 질문 제목·설명 크기를 조정했다. 변경 후 다시 캡처하고 합성 비교했다.
3. 최종 비교: 중앙의 제한된 폼 폭, 단계 표시, 질문→검색→직접 등록→운영 안내→복귀 링크의 위계, 기존 다크 배경·라임색 유지. 모바일에서는 가로 잘림 없이 검색 버튼과 단계가 표시됨.

## 기능 검증

- 타입·린트·단위 테스트 84개·프로덕션 빌드 통과.
- 기존 워크플로 브라우저 테스트 데스크톱·모바일 16개 통과. 검색 지연·한글 조합·이전 응답 무시, 기존 장소 상태 안내, 직접 등록 위치 조정, 단계별 검증, 이전 단계의 추천 이유 보존, 제출 실패 후 입력 보존, 확인 전 API 미호출·최종 제출 중 중복 차단 확인. API는 테스트 응답을 사용하며 실제 장소를 등록하지 않았다.
- 실제 로컬 초기 화면의 브라우저 오류 로그 0건. 실사용 계정으로 DB에 제안을 제출하는 검증은 하지 않았다.
- 새 API·DB 변경·운영 배포·커밋·푸시 없음.

남은 P0/P1/P2 디자인 결함 없음. 운영자 로그인 상태의 문구와 밝은 활성 버튼은 기존 권한 로직에 따라 출력된다.

## 장소 제안 자동 후보 검색 변경 — 2026-10-11

사용자 요청에 따라 검색 버튼을 누르기 전에도 실제 장소 후보를 제공한다. 2자 이상 입력 후 300ms 동안 입력이 멈추면 기존 장소를 먼저 검색하고, 내부 결과가 없으면 기존 외부 검색 API를 호출한다. 이전의 자동 외부 검색 차단 정책은 이 변경으로 대체한다. 한글 조합 중 요청 금지·오래된 응답 무시·직접 등록 전환 시 취소·내부 결과 우선 정책은 유지한다. 후보는 실제 장소명·주소이며 임의의 연관 키워드를 생성하지 않는다. 자동 후보 검색·내부 결과가 있을 때 외부 요청 미발생을 포함한 데스크톱/모바일 워크플로 테스트 16개, 타입·린트·빌드 통과. 테스트 API 응답으로 확인했고 실제 외부 공급자의 검색 품질을 새로 검증한 것은 아니다. 커밋·푸시·배포 없음.


## 장소 제안 검색 속도·범위 개선

입력 대기를 100ms로 줄이고 기존 장소·지역 후보 조회를 한 API 요청으로 합쳤다. 이전 후보는 새 요청 중 유지하되 선택을 막고, 폼 메모리에 최대 30개/2분간 결과를 재사용한다. 한글 조합·오래된 응답 취소를 유지하고 일본 영어 검색의 번역은 별도 버튼으로 실행한다. 세계·국가·지역 범위와 서명 후보/직접 등록의 실제 국가 저장을 추가했고, 원격 DB 활성화 전에는 확장 범위를 차단한다. 기존 지도와 미커밋 홈·SEO 변경을 보존했다.

워크플로 브라우저 테스트 20개가 데스크톱·모바일에서 통과했다. DB 권한/범위/날짜변경선/SQL 재실행과 이름 인덱스 동기화를 격리된 PostgreSQL/PostGIS에서 확인했다. 합성 2만 POI의 6회 워밍 조회 중앙값은 일반 검색 22.07→10.85ms, 짧은 일본어 12.71→0.91ms였다. 운영 DB 검색 원천이 919,940건이라 SQL Editor는 설정·1만 건 배치 인덱싱·활성화·확인으로 분리했다. 운영 SQL과 코드 배포는 아직 적용하지 않았으므로 실제 사이트 속도 개선은 원격 반영 후 측정한다. 상세 적용 안내는 docs/proposal-search.md. 커밋·푸시·배포 없음.


## 이름 인덱스 운영 자동 처리와 용량 복구 — 2026-10-11

기존 배치 RPC는 완료된 앞 구간을 반복 조회해 REST 타임아웃이 발생했다. 원천 ID 순서의 직접 연결 배치로 변경하고 로컬 DB 테스트와 린트를 통과했다. 사용자의 자동 처리 승인 후 585,000개 원천까지 채웠으나 DB 읽기 전용 오류 25006으로 중단됐다. 용량 사전 검사가 부족했다. 당시 DB 1,120MB 중 새 이름 인덱스가 697MB였다. 활성화 함수가 없음을 확인한 뒤 재생성 가능한 이름 테이블만 비워 DB 423MB와 새 연결 쓰기 가능 상태를 복구했다. 원천 919,940건과 사용자 데이터는 보존했다. 3번은 미활성화 상태다. 자동 스크립트에 사전 예상 용량·매 배치 실측 용량 검사와 오류별 안내를 추가했다. 구조 축소/용량 확보 전에는 2·3번을 재실행하지 않는다. 커밋·푸시·배포 없음.

운영 복구 후 실제 이름 인덱스 INSERT를 트랜잭션에서 실행·롤백해 쓰기 정상 상태를 확인했다. 미활성화 이름 인덱스의 `sync_proposal_search_names` 트리거는 임시 비활성화했다. 원천 갱신으로 인덱스가 다시 커지는 것을 막기 위한 조치이며, 새 구조 적용 시 동기화를 다시 활성화해야 한다. SQL Editor 배치의 용량 부족 거절도 로컬 DB 회귀 테스트로 확인했다.


## 장소 제안 즉시 자동완성과 경량 검색 — 2026-10-11

100ms 입력 타이머를 제거했다. 2자 입력·한글 조합 완료 이벤트에서 바로 검색하며, 늦은 성공/실패 응답은 무시한다. 이전 후보는 갱신 중 선택을 막고, 폼 캐시와 진행 중 동일 요청 합치기를 유지한다. 서버에서도 사용자별 동일 진행 요청을 합치고 종료 즉시 제거한다.

대량 이름 복제 대신 기존 원천 GIN/GiST 인덱스를 사용하는 SQL로 교체했다. 이름 테이블·트리거·배치 함수는 새 SQL 적용 시 명시적으로 정리하고, 예상 밖 의존성은 전체 롤백한다. 이전 문단의 동기화 재활성화 안내는 이 경량 방식으로 대체된다. setup/activate를 한 트랜잭션으로 묶은 apply-lightweight-proposal-search.sql과 별도 확인 SQL을 제공한다.

타입·린트·96개 단위 테스트·빌드·DB 권한 테스트 통과. 데스크톱/모바일 워크플로 22개 확인. SQL 반복 실행, 실패 롤백, 서비스 전용 권한, 국가·지역·세계·날짜변경선, 후보 상세/제출 범위와 순위/패턴 문자를 검증했다. 실제 외부 원천 919,940건 복사본의 지역 표본 중앙값은 0.46~2.58ms, 운영 읽기 전용 동등 쿼리는 11.41~24.51ms였다(기존 51.53~137.46ms). 전체 API/외부 공급자 시간은 제외한다.

운영 DB는 읽기 전용으로만 조회했고 전후 443,952,275바이트(423MB)로 동일하다. 새 SQL은 사용자 SQL Editor 적용 대기다. 기존 사용자·원천 데이터 및 미커밋 변경을 보존했고 커밋·푸시·배포하지 않았다. 상세 측정과 적용 순서는 docs/proposal-search.md에 기록했다.


## 한글 입력 중 자동완성 표시 수정 — 2026-10-11

입력창 밖을 클릭해야 검색되는 현상에 대응했다. 기존 compositionend 대기는 마지막 한글 음절이 포커스 이동까지 조합 상태로 남는 입력기에서 검색을 지연할 수 있었다. 완성형 한글로 끝나고 낱자 자모가 없는 2자 이상 입력은 조합 중에도 즉시 검색한다. IME 자체의 조합을 강제 종료하지 않는다. 자모 중간 상태와 일본어 변환 중 요청 차단, 중복 방지·취소·오래된 응답 무시를 유지했다.

타입·관련 린트·데스크톱/모바일 브라우저 테스트 6개 통과. 타이머 정지·입력창 포커스 유지·compositionend 미발생 상태에서 후보가 표시되고, 종료 후 같은 검색 요청은 중복되지 않는 것을 확인했다. 브라우저 테스트는 합성 IME 이벤트와 모의 API를 사용했으며 실제 OS 입력기/운영 API 검증은 배포 후 남아 있다. 테스트 서버의 프로덕션 빌드도 통과했다. 도로명주소 우선 변경과 기존 미커밋 변경을 보존했고 커밋·푸시·배포·DB 변경 없음.

## 모바일 지도 탐색 액션 정리 — 2026-10-11

목록/지도 토글을 하단 장소 카드의 내부 하단 행으로 옮기고, 같은 행에 장소 제안 링크를 항상 표시했다. 목록 화면에서도 전환·제안 행을 유지하고, 빈 지도 결과에도 전환과 제안 경로를 제공한다. 검색·선택·스크롤 상태를 관리하는 기존 changeView를 재사용한다. 모바일 미리보기에서 역 컴포넌트를 제거해 조회도 상세 패널에서만 발생한다. 상세/저장 버튼은 전체 너비 대신 내용 너비와 36px 높이로 줄였다. 내 위치는 불투명한 어두운 배경·밝은 테두리·그림자로 대비를 높였다.

320/390/768px 브라우저 폭에서 카드 경계·전환·제안 링크·작은 버튼·내 위치 배경을 확인하고 390px 캡처를 검토했다(artifacts/mobile-map-actions.png). 방문 관련 브라우저 검증 15개 통과, 프로젝트/플랫폼별 3개 제외. 새 버튼 높이를 덮던 기존 최소 높이 규칙은 선택자 우선순위를 조정해 수정했다. 타입·전체 린트·99개 단위 테스트·프로덕션 빌드 통과. React 스킬 기준으로 기존 상태/훅 순서와 접근성 이름·pressed 상태·공유 기능을 유지했고, 새 API나 역 조회를 추가하지 않았다. 로컬 데모와 브라우저 에뮬레이션 검증이며 실제 모바일 지도 공급자 검증은 배포 후 필요하다. 커밋·푸시·배포 없음.

## 모바일 하단 액션 Badge 디자인 — 2026-10-11

사용자가 지정한 https://ui.shadcn.com/docs/components/base/badge 의 default/secondary/outline과 아이콘 예시를 확인하고 저장소의 기존 shadcn Badge를 재사용했다. 프로젝트는 Radix 기반이므로 asChild로 실제 button/Link에 Badge 스타일을 적용하며 기존 클릭·disabled·aria-pressed·링크 목적지를 유지했다. 상세 보기(default), 저장(outline/저장됨 secondary), 목록/지도(outline/선택 secondary), 장소 제안(강조색 outline)을 28px 높이의 둥근 배지로 정리했다. 전환 토글의 큰 배경 박스와 넓은 버튼 대비를 줄였다. 새 패키지는 추가하지 않았다.

320/390/768px에서 하단 카드 경계·배지 높이·전환·장소 제안 표시를 확인했고 390px 스크린샷을 검토했다. 기존 최소 버튼 높이 스타일과의 충돌을 수정했다. 타입·린트·단위 99개·빌드 통과, 관련 브라우저 3개 통과(데스크톱 전용 제외 1개). 커밋·푸시·배포 없음.
