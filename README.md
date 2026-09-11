# Collective Intelligence Map

한 도시 × 관심사에 집중하는 공개 장소 커뮤니티 MVP. 핵심 객체는 **Theme Map**, 검증 단위는 **Place × Theme Map (`map_places`)** 입니다.

## 실행

```bash
npm ci
npm run dev
```

http://localhost:3000 에서 확인합니다. Supabase 키가 없으면 **명시된 가상 장소 미리보기**가 열립니다. 가짜 로그인·저장 성공은 제공하지 않습니다.

실제 연동은 `.env.example`을 `.env.local`로 복사하고 Supabase URL·publishable key·서버 secret을 입력합니다. 현재 전달받은 원격 프로젝트는 `cujmxwlwijwomngchwoi`입니다. 2026-09-10 원격 DB에 네 마이그레이션과 Tokyo Fashion seed를 적용하고 조회를 확인했습니다. 외부 검색은 기본 비활성화이며 REST 비밀키와 브라우저 지도 키를 구분합니다.

## 기능

- 공개 Theme Map 목록·규칙·장소 지도/목록·분류/검색/정렬
- Supabase 이메일·Google OAuth 로그인, 프로필·아바타
- 내부 DB 우선 장소 검색, Google Places 서버 adapter, 독립 출처를 가진 장소 제안
- 맵 내 장소별 적합/부적합 검증, 댓글, 저장, 팔로우, 신고
- 승인·거절·검토 필요·보관, 신고 처리, 트랜잭션 중복 병합
- PostGIS bbox, RLS, 외부 API 예산 예약/한도/사용량 로그

## 검증

```bash
npm run typecheck
npm run lint
npm test
npm run test:db       # 독립적인 *_test PostgreSQL/PostGIS DB 필요
npm run test:e2e      # npx playwright install chromium 먼저 실행
npm run build
npm run start
```

DB 테스트 기본 URL은 현재 OS 사용자로 `127.0.0.1:55432/cim_test`입니다. `TEST_DATABASE_URL`로 별도 테스트 DB를 지정할 수 있습니다. 테스트 스크립트는 지정된 테스트 DB 스키마를 초기화합니다.

## 구조

```text
src/app/                    App Router 화면과 HTTP endpoints
src/components/community/   공개 커뮤니티·참여·관리자 UI
src/components/map/         Google renderer adapter
src/domain/                 DTO, 입력 검증, 적합도 정렬
src/server/places/          검색 서비스 → provider router → adapter
src/server/places/policies/ 외부 데이터 저장·표시 경계
src/lib/supabase/           사용자 세션/서버 전용 클라이언트
supabase/migrations/        SQL, RLS, 원자적 쓰기, PostGIS, 운영 정책
supabase/seed.sql           실제 공개 커뮤니티 하나 (가상 장소 없음)
tests/                      단위·브라우저 테스트
scripts/                    DB 통합 검증·비밀키 번들 검사
```

- 제품 기준: `../collective-intelligence-map-product-plan.md`
- 승인된 구현 기준: [docs/implementation-plan.md](docs/implementation-plan.md)
- 로컬/운영 안내: [docs/runbook.md](docs/runbook.md)
- 제공자 정책 경계: [docs/provider-policies.md](docs/provider-policies.md)

초기 공개 범위는 Tokyo Fashion입니다. 가상 샘플은 실제 seed가 아니며, 공개 출시 전 큐레이터의 독립 출처로 실제 장소를 확보해야 합니다. 약관·개인정보 페이지는 운영 주체를 확정하기 전의 명시된 초안입니다.

## 현재 환경의 실행 모드

- `npm run dev`: `.env.local`의 원격 Supabase 사용. 스키마 적용 완료 상태입니다.
- `npm run dev:preview`: 원격 설정을 보존하면서 가상 장소 화면을 확인합니다.
- `npm run local:setup` → `npm run dev:local`: 기동 중인 로컬 Supabase를 사용합니다.
- 로컬 앱 실행 중 `npm run test:live`: 실제 Auth 세션·Storage·제안·승인·참여 UI를 검증합니다. 로컬 전용 테스트 사용자·장소를 생성합니다.

이 워크스페이스에서 준비한 Colima 프로필 이름은 `cim`입니다. 재기동은 `colima start cim --activate=false`, Supabase 실행 명령에는 필요시 `DOCKER_HOST=unix://$HOME/.colima/cim/docker.sock`을 지정합니다. 종료는 `npx supabase stop`(동일 Docker 연결)과 `colima stop cim`입니다.

원격 신규 프로젝트용 검토 가능한 SQL은 [supabase/bootstrap.sql](supabase/bootstrap.sql)입니다. 기존 앱 데이터가 있는 DB에 무조건 실행하지 마세요. 일반 배포는 개별 마이그레이션과 Supabase migration history를 사용합니다.

최종 검증 범위와 남은 연결 설정은 [docs/verification.md](docs/verification.md)를 참고하세요.
