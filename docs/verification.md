# MVP 검증 기록 — 2026-09-10

## 완료

- 타입 검사, ESLint, Vitest 12개, 데스크톱·모바일 Playwright 6개 통과.
- PostgreSQL/PostGIS 통합 검사: RLS, 승인 권한, 중복 투표, 비공개 저장, bbox, 병합과 롤백, 동시 API 예산 예약 통과.
- 실제 로컬 Supabase: 서로 다른 3명 세션으로 이메일 인증, 프로필, Storage 아바타, 제안→승인, 투표·저장·댓글·팔로우·신고→처리 확인. 해당 흐름에서 외부 Places 호출 0건.
- 로컬 Supabase security advisor 문제 없음.
- 원격 Supabase `cujmxwlwijwomngchwoi`: 기존 public/private 테이블이 없음을 SQL로 확인 후 transactional bootstrap 적용. 2026-09-16에 migration history를 저장소와 다시 대조했고, `20260916143000`까지 이력을 복구했습니다. SQL 본문은 저장소의 개별 migration 파일이 기준입니다.
- 원격 검증: Theme Map 1개, places 0개, RLS 없는 public 테이블 0개, public SECURITY DEFINER 함수 0개, avatars bucket 1개.
- 원격 연결로 production build 성공. 홈·Tokyo Fashion 상세·로그인·PostGIS bbox API 모두 HTTP 200. 빈 장소 목록은 의도된 초기 상태입니다.
- 현재 서버: http://localhost:3000 (`npm run start`). 다시 실행할 때 `npm run build && npm run start`; 개발 시 `npm run dev`.
- 원격 환경 production client bundle에 설정된 서버 비밀키 2개가 포함되지 않음을 확인.

## 남은 운영 설정

- Google/Kakao의 실제 Places·지도 렌더링 키가 없어 실제 공급자 호출과 지도 SDK 연결은 아직 검증하지 않았습니다. 서버 검색은 기본 비활성화입니다.
- 실제 이메일 수신과 Google OAuth 공급자 설정/콜백은 원격에서 아직 검증하지 않았습니다. 로그인한 운영자에게 runbook의 SQL로 admin 권한을 부여해야 합니다.
- 독립 출처로 실제 장소를 제안·승인해야 합니다. 가상 샘플과 테스트 사용자는 원격에 넣지 않았습니다.
- Vercel 배포는 아직 수행하지 않았습니다. 배포 시 사이트 URL·Auth redirect·제공자 키의 도메인 제한을 실제 도메인에 맞추세요.
- `supabase/bootstrap.sql`을 이 원격 DB에 다시 실행하지 마세요. 이후에는 새 migration만 적용합니다. 향후 CLI 적용에는 DB 연결 문자열 또는 프로젝트 접근 권한이 필요합니다.

## 환경 분리

`.env.local`은 원격 환경, `.env.test.local`은 로컬 Supabase 환경입니다. `dev:preview`는 가상 데이터, `dev:local`과 `test:live`는 실제 로컬 서비스입니다. 공개 키는 빌드 시 포함되므로 환경을 바꾸면 다시 빌드합니다.

## 추가 운영 점검

- `check:deployment` 추가: 원격 공개 Theme Map·장소 카드·Auth 조회 통과. 이메일 로그인 활성, Google OAuth 비활성 확인. Google 로그인 UI는 `GOOGLE_AUTH_ENABLED=true`인 경우에만 표시하도록 수정.
- `.vercelignore`로 비밀 환경파일·로컬 DB·테스트 산출물 업로드 제외. 서버 비밀값 번들 검사에 DB 연결 문자열도 추가.
- Vercel 팀 조회 성공. 기존 관련 프로젝트 없음. CLI 토큰 만료로 아직 배포하지 않음.
- Supabase 기본 SMTP는 시간당 2통이며 대시보드에서 이메일 템플릿 편집을 잠급니다. 현재 매직 링크는 일회용이므로 커스텀 SMTP를 연결하기 전에는 링크 보안 스캐너가 열지 않도록 주의가 필요합니다.
- Google Places 초기 운영 한도 적용: 활성화, 일일 10회, 월간 100회, 월간 예약 예산 USD 2. `/admin/usage`에서 관리자만 수정·비활성화할 수 있습니다.
