import type { MapPlace, ThemeMap } from "@/domain/types";
export const demoMap: ThemeMap = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "tokyo-fashion",
  title: "Tokyo Fashion",
  description:
    "도쿄의 패션을 발견하는 사람들의 공개 지도. 독립 편집숍부터 빈티지 아카이브까지, 함께 추천하고 검증합니다.",
  rules:
    "포함: 독립 편집숍, 빈티지, 아카이브, 디자이너 공간. 제외: 주제 근거 없는 일반 쇼핑몰, 광고성 등록. 방문 경험과 구체적인 추천 근거를 남겨 주세요.",
  country: "JP",
  city: "Tokyo",
  tags: ["전체", "빈티지", "독립 편집숍", "디자이너", "아카이브"],
  bounds: { west: 139.5, south: 35.5, east: 139.95, north: 35.85 },
  place_count: 6,
  follower_count: 0,
  contributor_count: 0,
};
const entries = [
  [
    "Archive Room",
    "아카이브",
    "시대를 읽는 옷을 만나는 작은 아카이브. 디자이너의 이전 컬렉션을 비교하며 볼 수 있는 공간입니다.",
    35.668,
    139.706,
  ],
  [
    "Studio 03",
    "독립 편집숍",
    "작은 브랜드의 시선이 모이는 편집 공간. 도쿄의 새로운 디자이너를 발견하고 싶은 사람에게 추천합니다.",
    35.664,
    139.701,
  ],
  [
    "Second Chapter",
    "빈티지",
    "데님부터 워크웨어까지, 소재와 제작 연도를 살펴보며 오래 입을 한 벌을 고를 수 있는 곳입니다.",
    35.672,
    139.709,
  ],
  [
    "FORM / Tokyo",
    "디자이너",
    "실루엣과 패턴을 가까이서 살펴볼 수 있는 디자이너 쇼룸. 옷이 만들어지는 이야기를 함께 발견합니다.",
    35.661,
    139.713,
  ],
  [
    "Everyday Objects",
    "독립 편집숍",
    "옷과 생활의 경계를 탐색하는 작은 숍. 일상에서 입기 좋은 독립 브랜드를 천천히 둘러봅니다.",
    35.657,
    139.698,
  ],
  [
    "Sunday Vintage",
    "빈티지",
    "취향을 넓혀주는 빈티지 큐레이션. 한 시대에 갇히지 않는 색감과 스타일링의 조합을 만납니다.",
    35.675,
    139.695,
  ],
] as const;
export const demoPlaces: MapPlace[] = entries.map(
  ([name, category, rationale, lat, lng], i) => ({
    id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, "0")}`,
    place_id: `33333333-3333-4333-8333-${String(i + 1).padStart(12, "0")}`,
    map_id: demoMap.id,
    name,
    address: "도쿄 · 화면 확인용 가상 장소",
    category,
    rationale,
    lat,
    lng,
    status: "approved",
    added_by: null,
    handle: "샘플 콘텐츠",
    positive: 0,
    negative: 0,
    saved_count: 0,
    created_at: `2026-09-0${i + 1}T00:00:00Z`,
    last_verified_at: null,
  }),
);
