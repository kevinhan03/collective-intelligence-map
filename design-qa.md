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

## 모바일 제안·저장·상세 버튼 위치 조정 — 2026-10-11

장소 제안을 텍스트 없는 + 링크로 바꾸고 모바일 햄버거와 같은 44px 너비·right 14px 기준으로 바로 아래에 고정했다. 스크린리더 이름은 장소 제안을 유지한다. 하단 카드의 기존 제안 자리에 현재 선택 장소 저장 배지를 넣고, 상세 보기 배지는 본문 행의 오른쪽으로 옮겼다. 상세·저장·목록/지도 배지 높이는 28px를 유지했다. 지도/목록 전환과 캐러셀 이동 후 저장 대상은 기존 activeId 기반 currentPlace를 사용한다.

320/390/768px에서 +와 햄버거의 중앙 정렬·수직 간격, 상세 보기 오른쪽 정렬, 저장 배지 높이·표시, 목록 전환 후 + 유지 확인. 390px 캡처 시각 검토 완료. 타입·린트·단위 99개·프로덕션 빌드·관련 브라우저 3개 통과(모바일 전용 항목 데스크톱 제외 1개). 기존 상태와 접근성 이름·pressed/disabled 유지. 커밋·푸시·배포 없음.

모바일 상세 보기 배지를 장소명 오른쪽의 같은 행으로 이동했다. items-center 정렬과 min-w-0/말줄임을 적용해 긴 이름과 겹침을 막고 배지 28px 높이를 유지했다. 320/390/768px에서 제목·배지 수직 중앙 차이 1px 미만과 수평 비겹침을 브라우저로 확인했다. 타입·관련 린트·테스트 서버 빌드 통과. 커밋·푸시·배포 없음.

## 내 위치 아이콘 버튼 — 2026-10-12

첨부한 원형 조준점 참고 이미지에 맞춰 내 위치를 텍스트 없는 44px 원형 버튼으로 바꿨다. 불투명한 사이트 배경 #202731과 기존 primary 강조색을 사용하고, 원 안쪽을 향하는 4개 선의 SVG를 적용했다. 접근성 이름·툴팁은 내 위치, 조회 중에는 회전 아이콘·aria-busy·상태 문구를 유지했다. 320/390/768px의 아이콘 전용 표시·크기·배경과 위치 성공/거부/시간 초과 등 관련 브라우저 7개 통과(모바일 전용 1개 제외). 타입·관련 린트·테스트 서버 프로덕션 빌드 통과. 커밋·푸시·배포 없음.

## 모바일 장소 카드 3단계 시트 — 2026-10-12

첨부 IMG_0041/0042/0043의 접힘→요약→상세 흐름을 참고해 기존 색상과 배지 스타일로 적용했다. 상세 보기 버튼을 제거하고 상단 드래그 바를 추가했다. 위로 쓸면 접힘(장소명/전환/저장)에서 요약(주소/추천 이유/주제 의견/방문자 사진)으로, 다시 위로 쓸면 기존 상세 패널로 이어진다. 아래로 쓸면 이전 단계로 돌아간다. 바 탭·키보드 위/아래 방향키·휠도 지원하고 상세 Escape/닫기에서 요약과 포커스로 복귀한다. 수평 캐러셀 이동·목록 전환·선택 장소·저장 동작은 유지한다.

요약이 열린 활성 장소만 기존 사진 API로 썸네일을 조회하고, 사진 선택은 전체 상세로 연결한다. 사진 없음·조회 지연/실패는 장소 탐색을 막지 않는다. 상세에서는 사진이 있는 경우 사진 섹션을 위로 배치하고 모바일 썸네일을 크게 표시한다. 사진 확대/등록·댓글·신고·역 토글 등 기존 상세 기능은 재사용한다. 상세는 기존 Radix 모달을 유지하며 위에 둥근 바·8dvh 지도 여백을 둔다. 움직임 감소 설정에서는 시트 전환 애니메이션을 끈다.

상단 +가 검색 닫기 버튼을 가리는 문제는 검색창이 열린 동안 +를 숨겨 해결했다. 홈 footer는 스크롤 후 보이도록 바뀐 사용자 요구와 제안 제목 변경에 맞춰 오래된 브라우저 테스트의 기대값을 수정했다. 앱 홈 디자인은 수정하지 않았다.

타입·전체 린트·단위 99개·프로덕션 빌드 통과. community/visit 브라우저 46개 통과(플랫폼별 제외 26개); 별도 사진 미리보기 2개 통과. 새 상하 드래그·2단계 확대·선택 유지·Escape 포커스, 320/390/768px 배치, 캐러셀·검색·위치·공유를 검증했다. 사진 요청/이미지/상세 연결은 모의 API로 확인했고 실제 OS 손가락 제스처와 운영 사진 데이터 검증은 배포 후 필요하다. artifacts/place-sheet-summary.png와 place-sheet-detail.png를 시각 검토했다. React 접근성·훅 순서·요청 취소를 점검했다. 커밋·푸시·배포·원격 DB 변경 없음.

## 모바일 전체 상세 상단 정리 — 2026-10-12

모바일 상세의 별도 검정 상단 영역과 보이는 장소 상세 문구를 제거했다. 드래그 바는 본문과 같은 배경에 유지하고 본문 상단 여백을 4px로 줄였다. 닫기 버튼을 장소명 행 오른쪽에 배치하고 긴 이름은 줄바꿈하도록 했다. 데스크톱 상단과 모달의 접근성 제목은 유지한다.

타입·전체 린트·브라우저 테스트 서버 빌드 통과. 모바일 2단계 확대 테스트에서 상단 영역 제거, 제목/닫기 수직 중앙 정렬과 비겹침, 접기·선택 유지·Escape 포커스 복귀 통과. 전체 상세 캡처 시각 확인 완료. 커밋·푸시·배포 없음.

## 모바일 장소 카드 정보·조작 개선 — 2026-10-12

접힘/요약/상세에 명시적 closed 상태를 추가해 X가 장소 선택과 역 강조를 해제하고, 첫 장소 자동 선택으로 카드가 다시 열리지 않게 했다. 닫은 뒤 지도 위치를 유지하고 핀/목록 선택으로 재개한다. 단계 상태는 탐색 화면에 보관해 목록/지도 전환에서 유지하며, 목록에서 연 상세는 원래 목록과 포커스로 돌아간다. 상세의 접기와 전체 닫기를 분리했다.

공통 포인터 드래그를 바·제목 헤더에 적용했다. 수직 이동 40px 또는 0.35px/ms 속도에서 한 단계 이동하며 이동 중 transform으로 따라 움직인다. 짧은 드래그는 200ms로 복귀하고 움직임 감소 설정을 따른다. 버튼/링크 시작은 제외하고 본문 스크롤은 native로 유지한다. 접힌 헤더의 좌우 드래그와 기존 요약 캐러셀 가로 스크롤을 유지했다. 최초 안내는 첫 확장 이후 sessionStorage로 해당 탭 세션에서 숨긴다. 캐러셀 정렬은 layout effect와 너비 변경에만 반응하도록 바꿔 높이 변화가 사용자 가로 스크롤을 되돌리는 문제를 해결했다.

제목을 먼저 배치하고 지역·순서·화살표를 보조 행으로 옮겼다. 요약 이유는 2줄, 전체 주소는 상세로 이동하고 사진 없는 요약 영역을 생략했다. 요약 높이는 내용에 맞추되 min(52dvh,460px)로 제한한다. 배지 외형은 28px를 유지하면서 터치 영역은 44px로 늘렸다. 모바일 상세 순서는 주소/운영·추천 이유·사진·역·참여로 정리했고 데스크톱 기존 정보 순서는 유지했다. 사진 없는 상세 안내는 추가 버튼과 한 행으로 줄이고 소개 링크는 더 보기로 이동했다.

저장·길찾기를 상세 스크롤 밖의 하단 영역에 고정했다. 안내 그라데이션은 행동 영역 높이를 관찰해 그 위에 배치한다. visualViewport 변경을 반영해 키보드와 화면 회전 시 가용 높이를 조정한다. 사진 확대창 Escape는 사진만 닫도록 모달/키보드 처리를 보강했다.

타입·전체 린트·단위 99개·격리된 프로덕션 빌드 통과. community/visit/workflows 브라우저 77개 통과, 플랫폼별 대상 제외 31개. 320/390/768px의 긴 제목·주소·이유, 사진 0/1/6장 및 오류, 썸네일 최대 5개, 하단 행동 위치 고정, 2단계 확대·짧은 드래그 복귀·닫기 후 재개·Escape 포커스·사진 Escape·검색/정렬/캐러셀을 검증했다. stages의 캡처는 artifacts/place-sheet-*.png 및 artifacts/sheet-*.png에 저장하고 시각 검토했다. 사진 데이터와 이미지는 브라우저 테스트에서 모의 응답을 사용했다. 실제 휴대폰 Safari의 손가락 조작·소프트 키보드와 운영 사진 업로드는 이번 로컬 검증에 포함되지 않았다. 기존 미커밋 변경 보존. 커밋·푸시·배포·원격 DB 변경 없음.

## 모바일 토글·장소 카드 모션 — 2026-10-12

- 토글 선택 면은 드래그 진행률을 직접 반영하고, 놓은 지점부터 약 200ms 동안 정착한다. 지도·목록 화면은 120ms 페이드로 전환한다.
- 카드 드래그는 끝 지점에 저항을 주며, 유효한 이동은 원점 복귀 없이 다음 단계로 이어진다. 접힘·요약 및 모달 상세는 실제 카드 좌표를 이용한 280ms 이동·클리핑으로 연결한다.
- 상세를 접을 때 요약 카드 위치로 내려오고 배경을 함께 밝힌다. X는 화면 아래로 닫는다. 신규 내용은 짧게 페이드인한다.
- 움직임 감소 설정에서는 정착·화면 전환·콘텐츠 페이드를 생략한다. 사진 확대창 Escape 우선 처리, 모달 포커스 복귀, 내부 스크롤은 유지한다.
- 로컬 브라우저 검증은 토글 진행률, 짧은/세로 드래그, 단계 연결, 닫기·재선택, 포커스, 사진 0/1/여러 장·조회 실패, 320/390/768px 및 움직임 감소 설정을 포함한다. 실제 휴대폰 손가락으로 느끼는 모션은 확인하지 못했다.

## 모바일 홈 테마 카드 중앙 이동 — 2026-10-12

- 추가 조정: 현재 표시 목록의 첫 두 카드는 중앙 이동·추가 여백 없이 제자리에서 설명만 펼친다. 세 번째 이후 카드는 중앙 이동을 유지한다. 7개 지도 fixture에서 첫 두 카드의 스크롤 위치·상단 여백 유지와 세 번째·중간·마지막 카드 중앙 배치를 확인했다. 320/390/768px 및 긴 첫 카드 등 관련 브라우저 7개, 타입·관련 린트·격리 빌드 통과. 커밋·푸시 없음.

- 선택한 카드의 설명 펼침이 끝난 뒤 최종 높이를 기준으로 화면 중앙에 부드럽게 스크롤한다. 움직임 감소 설정에서는 즉시 이동한다.
- 첫·마지막 카드에는 펼쳐진 동안만 필요한 여백을 확보한다. 화면보다 큰 카드는 제목과 설명 시작이 상단 메뉴 아래에서 보이게 배치한다.
- 선택 변경·닫기·검색·화면 이탈은 이전 예약 이동과 여백을 정리한다. 사용자의 휠·터치 스크롤이 시작되면 대기 중인 이동을 취소한다.
- 320/390/768px, 짧은 화면의 긴 설명, 닫기 후 포커스, 홈 복귀, 검색창 동작을 확인했다. 7개 지도 fixture에서 첫·중간·마지막 카드와 빠른 선택 변경도 확인했다. 실제 모바일 OS에서 주소창 변화에 따른 감각은 추가 확인이 필요하다.

## 모바일 장소 카드 좌우 스와이프 — 2026-10-12

- 접힘·요약 카드의 제목, 지역, 설명에서 왼쪽은 다음 장소, 오른쪽은 이전 장소로 이동한다. 카드 단계는 유지하며 첫·마지막 장소에서 순환하지 않는다. 손가락을 따라 내용이 이동하고 새 장소는 180ms 이동·페이드로 표시한다. 움직임 감소 설정에서는 정착 애니메이션을 생략한다.
- 사진 영역의 가로 스크롤, 본문 세로 스크롤, 상하 단계 변경, 지도·목록 토글 및 버튼 동작은 별도로 유지한다. 짧은 수평 이동은 선택을 바꾸지 않는다.
- 타입·관련 린트·격리 프로덕션 빌드 통과. 관련 모바일 브라우저 테스트 6개 통과 후 마지막 제스처 정리 변경에 대해 2개를 재검증했다. Chromium 터치 이벤트로 접힘·요약 이동, 양 끝 경계, 짧은 이동, 본문 세로 이동과 단계 유지를 확인했다. 실제 휴대폰 Safari 손가락 조작은 확인하지 못했다. 커밋·푸시·배포 없음.

## 지도 검색 결과 선택·중앙 이동 — 2026-10-12

- 장소 자동완성 선택 또는 Enter로 확정한 정확 일치·단일 결과를 기존 지도 중앙 이동 요청에 연결했다. 모바일에서는 지도 화면으로 전환하고 검색창·키보드를 닫으며 해당 장소의 하단 카드를 연다. 닫힌 카드도 다시 열고 요약 단계는 유지한다. 지역·분류·역 검색과 여러 결과 탐색은 유지한다.
- 검색 결과가 도착하기 전에 확정한 선택은 최신 응답을 기다리며, 입력 변경·검색 초기화 시 예약 선택을 취소한다. 한글 조합 Enter는 검색 확정으로 처리하지 않는다. MapLibre는 역 표시에서 남은 비대칭 패딩을 해제하고 장소 좌표를 중앙으로 이동한다.
- 목록 화면에서 메뉴·제안 버튼이 검색 버튼을 가리던 문제를 오른쪽 여백으로 수정했다. 타입·관련 린트·격리 프로덕션 빌드 및 검색 브라우저 10개 통과(모바일 전용 2개 데스크톱 제외). 최종 지도 패딩 변경 후 모바일 선택 2개 재검증. 모의 검색 응답과 가상 지도에서 선택 핀·카드·화면 전환을 확인했으며 실 지도 공급자의 중앙 픽셀 위치는 로컬 브라우저 검증에 포함되지 않았다. 커밋·푸시·배포 없음.
