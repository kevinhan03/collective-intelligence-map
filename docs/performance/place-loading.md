# 장소 조회·썸네일 배치 성능 개선

## 장소 조회

`map_places_in_bounds`의 공개 여부·좌표 조건·ID순 501개 제한을 먼저 계산한다. 각 반환 장소의 `private.place_stats`를 LATERAL/OFFSET 0으로 한 번만 계산한다. 기존 응답 구조와 익명 투표 포함 통계를 유지한다.

재현: 격리된 `*_test` DB에 전체 마이그레이션을 적용한 후 `TEST_DATABASE_URL=… node scripts/test-place-loading-db.mjs`. 스크립트는 한 트랜잭션 안에서 합성 74/500개 장소를 구성하고 원본/변경 SQL을 번갈아 적용해 각각 워밍업 2회, 측정 10회 후 모두 롤백한다. 운영 데이터를 변경하지 않는다.

첫 측정(로컬 PostgreSQL/PostGIS, 2026-11-05):

| 장소 수 | 변경 전 DB 실행 중앙값 | 변경 후 | 감소 |
| --- | ---: | ---: | ---: |
| 74 | 43.765ms | 26.619ms | 39.2% |
| 500 | 219.775ms | 99.271ms | 54.8% |

`artifacts/performance/place-loading/`에 원본 함수 정의·전후 실행 계획과 표본을 저장한다. DB 실행 시간은 EXPLAIN ANALYZE, 클라이언트 시간은 로컬 TCP 요청부터 JSON 수신까지 별도로 측정한다. 이는 합성 데이터에서의 결과이며 실제 74곳 운영 지도나 전체 화면 로딩의 개선율이 아니다.

복구 SQL: `docs/sql/rollback-map-place-reads.sql`. 함수 시그니처·권한은 변경하지 않는다.
