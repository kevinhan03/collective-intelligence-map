# 장소 검색과 내부 Place

## 구조와 호환성

- `public.our_search_places`: Overture 검색용 최소 필드. 활동·사용자·지도 연결 없음. RLS 활성화, service role 전용. 브라우저에서는 API만 접근.
- `public.places`: 사용자가 실제 제출한 내부 UUID 장소. `name`, `location`, `country`, `city`는 기존 이름을 유지하며 `source_type`, `region`을 추가.
- `private.place_provider_refs`: 기존 외부 ID 테이블을 유지. `(provider, external_id)` 고유, 여러 공급자 ID → 하나의 내부 장소. 기존 관리자 병합도 이 테이블을 갱신.
- `public.map_places`: `(map_id, place_id)` 고유. 기존 상태 `pending / approved / rejected` 유지 (`proposed / accepted / rejected`에 대응). 같은 장소를 다시 제출해도 기존 연결을 반환.
- `map_place_votes`, saves, comments는 기존 지도 연결 UUID 기준. 외부 사진을 가져오거나 저장하지 않음. 댓글 이미지 업로드는 이번 범위 밖.

## 흐름

1. UI가 내부 검색 API 호출. 결과가 없으면 외부 검색 요청.
2. 외부 검색 요청도 서버에서 내부 DB를 먼저 다시 조회. 하나라도 있으면 공급자를 호출하지 않음.
3. 국가 KR → Kakao Local, 그 외 → Overture 검색 인덱스. 지도 bounding box와 국가로 제한하고 텍스트 유사도, 중심 거리로 정렬.
4. 결과는 사용자·지도·세션에 묶인 15분 HMAC 토큰. 검색/선택만으로 `places`를 생성하지 않음.
5. 선택 시 Overture 인덱스에서 다시 조회. Kakao는 ID 조회 API가 없으므로 서명된 일시 필드를 복원. 기존 외부 ID가 있으면 내부 장소를 재사용.
6. 추천 근거와 함께 제출 → 서버가 서명/보존 정책 확인 → 단일 DB 트랜잭션으로 resolve/create + 외부 ID + 지도 연결.
7. 일반 사용자 제출은 대기 핀, 관리자 제출은 승인 핀. 대기 핀 선택 시 기존 검토 패널을 열어 지도별 투표 가능.

직접 등록은 이름·좌표·분류·선택 주소를 입력. `source_type=user`이고 이후 내부 검색에서 찾을 수 있음. 지도 클릭으로 좌표 지정하는 UX는 후속 작업.

## 중복 정책

외부 ID 정확 일치가 최우선. 대기 중 장소도 다른 지도에서 재사용. ID가 없으면 **정규화한 이름 정확 일치 + 15m 이내 + 비어 있지 않은 주소 정확 일치**이고 후보가 하나인 경우만 재사용. 유사 이름·주소만으로 자동 병합하지 않음. 애매한 장소는 별도로 두고 기존 관리자 병합을 활용.

MVP 쓰기량에서는 기존 관리자 병합과 동일한 transaction advisory lock으로 동시 제출을 직렬화한다. 대규모 쓰기 확장 시 순서가 정해진 공간 셀 잠금으로 교체할 것. 인덱스는 독립 테이블/어댑터이므로 나중에 별도 검색 시스템이나 지역 분할로 옮겨도 커뮤니티 ID에는 영향 없음.

## 로컬 및 운영 적용

1. 기존 마이그레이션을 먼저 적용한 후 `20260915053412_overture_place_search.sql` 적용. 기존 장소/투표를 삭제하지 않음.
2. `PROVIDER_SIGNING_SECRET` 32자 이상과 기존 Supabase 서버 설정 필요.
3. 해외 렌더링: `NEXT_PUBLIC_MAPLIBRE_STYLE_URL`에 사용 권한과 attribution이 설정된 basemap style URL. 키가 필요한 공급자는 URL에 **공개용** 키만 사용. 데모 타일은 테스트용이며 운영 기본값으로 설정하지 않음.
4. 국내: `KAKAO_REST_API_KEY` (기존 프로젝트의 `KAKAO_LOCAL_API_KEY`도 호환), `KAKAO_PLACES_ENABLED=true`, `NEXT_PUBLIC_KAKAO_MAPS_KEY`. `/admin/usage`의 Kakao 검색 예산도 활성화해야 함. 키와 DB 설정이 모두 있어야 외부 API 호출.
5. Kakao는 `KAKAO_REF_STORAGE_ALLOWED=false`, `KAKAO_PLACE_STORAGE_ALLOWED=false`가 기본. 참조 ID 저장 허용만으로 이름·좌표·주소 복제가 허용되는 것은 아님. 계약/약관에 따른 저장 권한과 삭제·갱신 요구를 별도로 확인한 경우에만 두 플래그 활성화. 제한적 TTL만 허용되는 계약에는 이 영구 저장 경로를 활성화하지 말 것. 기본 상태에서는 일시 검색 결과만 표시하고 직접 등록을 제공.
6. Google Places 어댑터와 이전 ID는 회귀 호환용으로 남겨두었지만 라우터에서 사용하지 않음. Google OAuth 로그인은 별개.

## 도시별 ETL

DuckDB CLI + spatial/httpfs 확장이 필요. Node 앱 의존성으로 GeoParquet를 읽지 않음.

```sh
# OVERTURE_DATABASE_URL은 ETL 전용 직접 PostgreSQL 연결 문자열
node scripts/overture/ingest.mjs tokyo 2026-08-19.0
node scripts/overture/ingest.mjs paris 2026-08-19.0
node scripts/overture/ingest.mjs new-york 2026-08-19.0
```

릴리스 날짜는 명시적으로 고정한다. `scripts/overture/regions.json`에서 지원 지역 bbox를 관리하며 전체 지구 ingest 모드는 제공하지 않는다. 앱 Theme Map의 bbox에 맞춰 지역을 확장하면 된다.

`GeoParquet → DuckDB bbox 추출 → normalize.mjs → 임시 staging → 원자적 지역 갱신`.

- 원본 스키마 의존은 ETL에만 존재. 앱은 정규화된 결과만 조회.
- ID upsert, 겹치는 지역 ID 고유성 유지. 같은 지역에 없는 최신 레코드는 검색 인덱스에서 제거하되 이미 등록된 내부 Place는 유지.
- 빈 추출·잘못된 좌표는 작업 실패/rollback. 닫힌 장소는 제외.
- 릴리스·imported_at 보관. 전체 원본·사진·전화·웹사이트는 저장하지 않음.
- 지역 refresh는 ETL 전용 전역 잠금으로 순차 실행. 릴리스 역행 방지 및 대량 COPY 최적화는 운영 스케줄러/확장 단계에서 추가.
- 테스트용 추출 NDJSON을 세 번째 인자로 주면 네트워크 없이 정규화·DB 적재를 검증할 수 있음.

검색 인덱스 데이터는 코드 배포와 별개로 적재해야 한다. 본 작업의 자동 검증은 합성 POI를 사용하며 이를 실제 장소처럼 운영 seed에 넣지 않는다.

## 검증

```sh
npm run typecheck
npm run lint
npm test
npm run test:db  # 격리된 *_test PostgreSQL/PostGIS DB만 사용
npm run build
# 최신 로컬 Supabase + 3200번 개발 서버, 테스트 MapLibre style 필요
node scripts/test-place-slice.mjs
```

DB 테스트: 인덱스 격리/RLS, 지역/별칭 검색, 동시 생성, 대기 장소 재사용, 같은 지도 중복 제출, 보수적 근접 resolution, pending pin 읽기, service-only RPC.
브라우저 테스트: 실제 로컬 Supabase 인증 세션, Overture 합성 결과 선택·제출·MapLibre 핀, 두 번째 지도 재사용, 직접 등록 핀. 실행 후 해당 테스트 UUID 데이터만 정리.

## 확인한 공식 자료

- [Overture Places](https://docs.overturemaps.org/guides/places/)
- [Overture DuckDB regional extraction](https://docs.overturemaps.org/getting-data/duckdb/)
- [Overture attribution and licensing](https://docs.overturemaps.org/attribution/): 데이터 릴리스와 공급자별 라이선스를 검토하고 서비스 attribution에 반영할 것.
- [Kakao 운영 정책](https://developers.kakao.com/terms/ko/site-policies): 검색/사용 범위와 별개로 영구 저장 권리를 가정하지 않음.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [MapLibre Map API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/)
