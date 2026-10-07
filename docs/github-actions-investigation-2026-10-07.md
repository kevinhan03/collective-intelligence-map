# GitHub Actions 반복 실패 전수 조사

조사일: 2026-10-07 (Asia/Seoul). GitHub API에 남아 있는 2026-09-10부터의 실행 126건을 페이지 끝까지 조회하고, 실패 27건의 로그를 모두 읽었다. 삭제된 실행이나 계정 이메일 알림 자체는 조사 대상에 포함되지 않는다. 조사 시점 main: `f5e478dac50fa7d1764fc226d97d8ec7bb744613`.

## 결론

단일 오류가 반복된 것이 아니다. 운영 의존성 보안 검사, Dependabot의 호환되지 않는 업데이트, UI 테스트 실패가 같은 “run failed” 문구로 전달된다. 여기에 PR의 push/pull_request 중복 실행과 자동 갱신이 알림 수를 늘린다.

- 실패 27건: main 14건, Dependabot 브랜치 13건.
- 원인별: 보안 검사 8건, React 버전 충돌 6건, ESLint 호환성 2건, TypeScript 타입 오류 2건, E2E 9건.
- 최신 main의 웹/DB 검사와 수동 보안 검사는 모두 성공했다. Supabase 설정 실패나 사진 업로드 테스트 실패가 최근 알림의 원인이라는 증거는 없다. CI 통과가 운영 장애 부재를 보장하지는 않는다.

## 왜 수정 직후 다시 알림이 생겼나

1. `.github/workflows/security.yml`의 `0 */6 * * *` 설정은 같은 main 커밋을 6시간마다 다시 검사한다. `npm audit`은 매번 최신 보안 데이터베이스를 조회하므로 코드 변경 없이도 성공이 실패로 바뀐다. source-map-js 두 차례 실패 후 1.2.2로 수정했고, 이후 다른 취약점인 sharp 두 차례 실패를 0.35.5로 수정했다. 보안 검사는 보고만 할 뿐 패키지를 자동으로 고치지 않는다.
2. `.github/workflows/check.yml`은 `on: [push, pull_request]`라서 같은 저장소의 Dependabot PR 커밋을 두 번 검사한다. React DOM / ESLint / TypeScript / Next PR 각각의 실패가 두 건씩 기록됐다. 실행은 별도 러너에서 이루어지므로 이 중복 자체가 파일 충돌을 일으킨다는 증거는 없다.
3. main 갱신 뒤 Dependabot이 열린 PR을 갱신했다. React DOM PR #11은 10월 3일, 6일, 7일 서로 다른 커밋에서 같은 충돌로 실패했다. 최신 수정 푸시 직후 생긴 실패는 main이 아니라 이 PR의 재검사였다. npm 정기 업데이트는 현재 daily 설정이다.

## 남아 있는 구체적인 문제

### React DOM PR #11

현재 main은 react / react-dom 모두 19.2.8이다. PR #11은 react-dom만 19.3.0으로 올리며, 해당 버전이 요구하는 react ^19.3.0과 충돌한다. web/database 모두 npm ci 단계의 ERESOLVE로 실패한다. DB 검사가 실패했다고 실제 DB가 고장 난 것은 아니다.

Dependabot 설정은 Next / eslint-config-next의 minor·patch만 묶고 React 계열은 묶지 않는다. PR #6의 React 업데이트와 PR #11의 React DOM 업데이트가 분리되어 있다. react, react-dom, @types/react, @types/react-dom을 함께 묶어 동일 버전으로 검증해야 한다. `--legacy-peer-deps`로 충돌을 숨기는 방법은 해결이 아니다.

### 대규모 버전 업데이트 PR

- PR #9 ESLint 9 → 10: React 규칙 실행 중 `contextOrFilename.getFilename is not a function`. 플러그인 호환성이 확인되지 않은 major 업데이트다.
- PR #7 TypeScript 5 → 7: google namespace / window.google 타입을 찾지 못해 typecheck 실패. 현재 tsconfig에는 명시적 types 설정이 없다. 새 컴파일러와 Google 전역 타입 포함 방식을 검증해야 하며 로그만으로 정확한 내부 타입 탐색 원인까지 확정할 수 없다.
- PR #1 Next 16.3.8: 당시 실패는 Next 컴파일이 아니라 다른 의존성 braces의 audit 단계였다. 이미 main이 Next 16.3.8이므로 PR에 남은 오래된 실패 표시를 현재 상태와 구별해야 한다.

### 최신 cn PR #12의 간헐적 E2E 실패

실패 push 실행 37578941861과 성공 pull_request 실행 37578945936은 같은 head SHA `a718e49a1edd580a9cec2dd261cff957ef4e0d73`이다. Playwright trace의 응답 HTML에서 `/maps/tokyo-fashion/submit` HTTP 500을 확인했다. stack은 Next `load-manifest.external.js:54`의 JSON.parse → AppPageRouteModule.loadManifests이며, 앱 입력 JSON 파싱이 아니다.

현재 E2E는 `next dev` / Turbopack 개발 서버를 fullyParallel로 검사한다. 서버의 manifest 파싱 실패가 페이지 표시를 막아서 heading 검증이 실패했다. 동시에 생성·읽기 중인 manifest의 일시적인 상태가 원인일 가능성이 있으나, 실제 파일 내용과 쓰기 순서가 아티팩트에 없어 경쟁 조건까지 확정하지는 못했다. `cn`의 결정적인 회귀라고 단정할 근거도 없다.

재발 방지는 테스트 전용 환경에서 production build + next start를 사용하는 방식을 우선 검증하고, 필요한 경우 worker 수를 제한해 개발 서버 병렬 컴파일 영향과 비교해야 한다. 운영 환경과 데모 환경의 차이를 유지한 채 빌드해야 한다. 재시도만 늘려 오류를 가리는 방법은 우선하지 않는다.

### 이전 E2E 8건

9월 10~29일 main에서 클릭 timeout, 비활성 버튼/표시 요소 누락, aria-current 기대값 불일치가 있었다. 각 실패는 아래 로그에 기록했다. 현 main에서는 해당 테스트들이 최근 전체 검사에서 통과했지만, 과거 로그만으로 모든 원인을 UI 회귀와 테스트 기대값 변경 중 하나로 단정하지 않는다.

## 보안 상태의 정확한 의미

- `npm audit --omit=dev`: 최신 main에서 0건.
- 전체 `npm audit`: 개발 의존성까지 포함하면 10개 패키지가 표시됨(High 9, Critical 1). 의존성 전파로 같은 취약점이 여러 패키지에 표시되므로 독립된 취약점 10개라는 뜻은 아니다.
- 미해결 GitHub 경고: 개발 도구 shadcn → MCP SDK 1.30.0 → Express → proxy-addr 2.0.7. MCP SDK와 proxy-addr 보안 업데이트 PR #16, #15가 열려 있다.
- braces 항목은 GitHub API에서 auto_dismissed인데 npm audit에는 아직 남아 있어 도구 간 상태 차이가 있다. npm audit fix --force는 Next 설정과 shadcn을 과거 major로 내리는 제안을 하므로 일괄 적용하면 안 된다.
- 보안 워크플로는 전체 audit JSON을 기록하지만 실패 판정은 운영 의존성만 대상으로 한다. 앞선 “모두 통과”는 실행된 CI 판정의 의미였고 전체 의존성 취약점이 전부 없어졌다는 뜻은 아니다.

## 재발을 줄이기 위한 변경 순서

1. CI push 대상을 main으로 제한하고 PR 검사는 pull_request로 유지해 같은 Dependabot 커밋의 중복 실행을 제거한다. 워크플로 이름에 브랜치/이벤트를 표시하면 알림 출처가 분명해진다. 필요 시 concurrency로 이전 PR 실행을 취소하되 실제 실패는 그대로 표시한다.
2. React와 React DOM 및 타입을 한 그룹으로 갱신한다. ESLint·TypeScript major 업그레이드는 호환성 작업과 함께 진행한다. 오래된/이미 반영된 PR은 상태를 정리한다.
3. E2E를 production 서버에서 검증하도록 구성하고 manifest 오류 재현 여부를 비교한다.
4. 개발 도구의 보안 업데이트도 검증 후 반영한다. 운영 보안 검사는 유지한다. 주기를 줄이면 반복 알림은 줄지만 발견이 늦어지는 절충이 있으므로 보안 실패를 무조건 성공으로 처리하지 않는다.

원인 조사 단계에서는 워크플로/의존성/PR 설정을 변경하지 않았다. 이후 사용자의 자동 조치 요청에 따라 아래 후속 조치를 적용했다. 다음 실패 목록은 조치 전 조사 시점의 기록이다.

## 후속 조치 (2026-10-07)

- push 검사를 main으로 제한하고 PR 검사는 유지했다. 브랜치/이벤트를 실행 제목에 표시하고 같은 브랜치의 오래된 실행을 취소하도록 구성했다.
- Playwright 서버를 테스트 전용 production 빌드 + next start로 변경했다. 빌드/실행 모두 데모 환경과 `.next-e2e`를 사용하며 CI worker는 2개다. 지도 로드 실패 테스트는 압축으로 사라지는 함수 이름 대신 접근성 레이블로 실제 청크 요청을 식별한다.
- MCP SDK 1.32.1, proxy-addr 2.0.8로 보안 업데이트했다. 운영 의존성 audit와 기존 테스트는 유지했다.
- Dependabot React/React DOM/types 업데이트를 그룹화했다. 일상적인 버전 검사는 주간으로 변경하고 npm major 업데이트는 수동 호환성 작업으로 진행하도록 설정했다. 보안 업데이트와 6시간마다 실행하는 운영 audit는 유지한다.
- 기존 PR #1은 이미 반영되어 닫았다. #7, #9, #10은 major 호환성 작업 없이 적용하지 않도록 닫았다. #6, #11은 React 그룹 업데이트로 대체하기 위해 닫았다. PR을 머지하거나 브랜치를 삭제하지 않았다.
- 로컬 CI 전체 검사: 타입/린트/단위 테스트 57개/production 빌드/브라우저 테스트 24개 통과(프로젝트 구분으로 16개 제외). CI 조건의 브라우저 3회 반복은 72개 통과, 48개 제외였다. YAML 파싱과 diff 검사를 완료했다.
- 갱신된 PR을 끝까지 확인하는 과정에서 Linux Chromium의 접근성 이름 차이를 추가 발견했다. 모바일 지도 h1 내부 버튼의 aria-label이 heading 이름에 포함되어 화면은 정상인데 제목의 exact name 검사가 실패했다. 제목의 역할·표시 여부·실제 텍스트를 검사하도록 수정했다. 브라우저별 접근성 이름 계산 차이에 의존하지 않으며 제목 검증 자체는 유지한다.

## 실패 실행 전체 목록

| 한국 시간 | 브랜치 | 이벤트 | 원인 | 실행 |
|---|---|---|---|---|
| 09-10 17:40 | main | push | E2E: 화면 요소 / 상태 기대값 실패 | [34456422460](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/34456422460) |
| 09-11 14:40 | main | push | E2E: 화면 요소 / 상태 기대값 실패 | [34566859029](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/34566859029) |
| 09-11 22:02 | main | push | E2E: 화면 요소 / 상태 기대값 실패 | [34602059934](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/34602059934) |
| 09-16 11:19 | main | push | E2E: 화면 요소 / 상태 기대값 실패 | [35047546315](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/35047546315) |
| 09-25 23:11 | main | push | E2E: 화면 요소 / 상태 기대값 실패 | [36145853927](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/36145853927) |
| 09-25 23:43 | main | push | E2E: 화면 요소 / 상태 기대값 실패 | [36149370115](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/36149370115) |
| 09-25 23:50 | main | push | E2E: 화면 요소 / 상태 기대값 실패 | [36150152662](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/36150152662) |
| 09-29 23:06 | main | push | E2E: 화면 요소 / 상태 기대값 실패 | [36580112550](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/36580112550) |
| 10-01 00:43 | main | push | 보안 검사: brace-expansion / fast-uri / ip-address | [36738961813](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/36738961813) |
| 10-04 00:22 | main | push | 보안 검사: Next / braces | [37133007771](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37133007771) |
| 10-04 00:39 | Dependabot | push | 보안 검사: braces (Next 업데이트와 별개) | [37133988072](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37133988072) |
| 10-04 00:39 | Dependabot | pull_request | 보안 검사: braces (Next 업데이트와 별개) | [37133990949](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37133990949) |
| 10-04 00:40 | Dependabot | push | TypeScript 7 / Google 전역 타입 오류 | [37134090578](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37134090578) |
| 10-04 00:40 | Dependabot | pull_request | TypeScript 7 / Google 전역 타입 오류 | [37134093645](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37134093645) |
| 10-04 00:41 | Dependabot | push | ESLint 10 / React 규칙 플러그인 호환성 | [37134107717](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37134107717) |
| 10-04 00:41 | Dependabot | pull_request | ESLint 10 / React 규칙 플러그인 호환성 | [37134110156](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37134110156) |
| 10-04 00:41 | Dependabot | push | React / React DOM 버전 충돌 | [37134129093](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37134129093) |
| 10-04 00:41 | Dependabot | pull_request | React / React DOM 버전 충돌 | [37134132208](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37134132208) |
| 10-06 13:53 | main | schedule | 보안 검사: source-map-js | [37415814136](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37415814136) |
| 10-06 21:45 | main | schedule | 보안 검사: source-map-js | [37465564722](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37465564722) |
| 10-06 21:52 | Dependabot | push | React / React DOM 버전 충돌 | [37466465804](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37466465804) |
| 10-06 21:52 | Dependabot | pull_request | React / React DOM 버전 충돌 | [37466473157](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37466473157) |
| 10-07 07:20 | main | schedule | 보안 검사: sharp | [37539912715](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37539912715) |
| 10-07 13:19 | main | schedule | 보안 검사: sharp | [37570905295](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37570905295) |
| 10-07 14:57 | Dependabot | push | E2E: Next 개발 서버 manifest JSON 파싱 실패 | [37578941861](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37578941861) |
| 10-07 14:57 | Dependabot | push | React / React DOM 버전 충돌 | [37578953853](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37578953853) |
| 10-07 14:57 | Dependabot | pull_request | React / React DOM 버전 충돌 | [37578958926](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37578958926) |

## 증거와 설정

- [현 main 웹/DB 검사 성공](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37578738557)
- [현 main 보안 검사 성공](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37578739614)
- [cn 같은 커밋 PR 검사 성공](https://github.com/kevinhan03/collective-intelligence-map/actions/runs/37578945936)
- [Dependabot 옵션 공식 문서](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- 로컬 설정: `.github/workflows/check.yml`, `.github/workflows/security.yml`, `.github/dependabot.yml`, `playwright.config.ts`, `scripts/dev-preview.mjs`, `next.config.ts`.
- 전체 실행 목록과 원본 실패 로그/아티팩트는 이번 조사 중 `/tmp/cim-*`에 저장했다. 비밀 값은 보고서에 포함하지 않았다.
