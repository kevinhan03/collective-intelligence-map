import { CommunityExplorer } from "@/components/community/community-explorer";
import {
  ViewerStateProvider,
  HydrateViewer,
  type ViewerState,
} from "@/components/community/viewer-state";
import { useCommunityMutations } from "@/components/community/use-community-mutations";
import { PlaceResources } from "@/components/community/place-resources";
import { usePlaceComments } from "@/components/community/use-place-comments";
import { CreatorStudio } from "@/components/creator/studio";
import { RecommendationsExplorer } from "@/components/creator/recommendations-explorer";
import { ProfileForm } from "@/components/community/profile-form";
import { ProfilePresentation } from "@/components/creator/profile-presentation";
import { useState } from "react";
import { MobilePlaceList } from "@/components/community/mobile-place-list";
import { MobileDiscovery } from "@/components/community/mobile-discovery";
import { MobilePlacePeek } from "@/components/community/mobile-place-peek";
import { MobilePlaceCarousel } from "@/components/community/mobile-place-carousel";
import { PlaceDetail } from "@/components/community/place-detail";
import type { PlaceSheetStage } from "@/hooks/use-place-sheet-drag";
import { createRoot } from "react-dom/client";
import { PlacePhotos } from "@/components/community/place-photos";
import { ProposalForm } from "@/components/community/proposal-form";
import {
  AdminConsole,
  type AdminSnapshot,
} from "@/components/community/admin-console";
import type { ThemeMap, MapPlace } from "@/domain/types";

const map: ThemeMap = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "test-map",
  title: "테스트 지도",
  city: "서울",
  country: "KR",
  description: "",
  rules: "",
  tags: [],
  bounds: { west: 126, east: 128, south: 36, north: 38 },
  created_at: "",
  place_count: 0,
  follower_count: 0,
  contributor_count: 0,
};
const snapshot: AdminSnapshot = {
  proposals: [
    {
      id: "old",
      place_id: "place-old",
      name: "오래된 장소",
      address: "특별주소",
      lng: 127,
      lat: 37,
      rationale: "추천 이유입니다",
      source_note: "사용자가 확인한 출처",
      status: "pending",
      map_title: "테스트 지도",
      handle: "test",
      created_at: "2026-01-01",
      last_verified_at: null,
    },
    {
      id: "new",
      place_id: "place-new",
      name: "새 장소",
      address: "서울",
      lng: 127,
      lat: 37,
      rationale: "추천 이유입니다",
      source_note: "사용자가 확인한 출처",
      status: "pending",
      map_title: "테스트 지도",
      handle: "test",
      created_at: "2026-02-01",
      last_verified_at: null,
    },
  ],
  reports: [
    {
      id: "photo-report",
      reason: "사진 신고 이유",
      map_place_id: null,
      comment_id: null,
      photo_id: "photo",
      photo_status: "visible",
      created_at: "2026-01-01",
    },
    {
      id: "comment-report",
      reason: "댓글 신고 이유",
      map_place_id: null,
      comment_id: "comment",
      photo_id: null,
      created_at: "2026-01-01",
    },
    {
      id: "place-report",
      reason: "장소 신고 이유",
      map_place_id: "place",
      comment_id: null,
      photo_id: null,
      created_at: "2026-01-01",
    },
  ],
  duplicates: [
    {
      source_id: "source",
      target_id: "target",
      source_name: "원본 가게",
      target_name: "목적 가게",
      distance_m: 10,
    },
  ],
  actions: [
    {
      id: "action",
      action: "hide_photo",
      reason: "운영자가 확인함",
      created_at: "2026-01-01",
      photo_id: "photo",
    },
  ],
};
const sheetPlace: MapPlace = {
  id: "22222222-2222-4222-8222-222222222222",
  place_id: "11111111-1111-4111-8111-111111111111",
  map_id: map.id,
  name: "서울에서 만나는 아주 긴 이름을 가진 독립 편집숍과 빈티지 아카이브",
  address: "서울 용산구 이태원로 123 아주 긴 도로명주소 상세 건물 3층",
  rationale:
    "좋은 장소를 추천하는 이유와 방문할 때 확인할 정보를 충분히 길게 작성했습니다. ".repeat(
      8,
    ),
  category: "편집숍",
  lat: 37,
  lng: 127,
  status: "approved",
  added_by: null,
  handle: "visitor",
  positive: 12,
  negative: 1,
  saved_count: 0,
  created_at: "2026-10-12",
  last_verified_at: null,
};
const mutationPlaces = [sheetPlace];
const mutationPersonal = { votes: {}, saves: [], followed: false };
function MutationFixture() {
  const [identity, setIdentity] = useState("viewer-a");
  const [source, setSource] = useState(mutationPlaces);
  const [error, setError] = useState("");
  const actions = useCommunityMutations(identity, source, mutationPersonal);
  const place = actions.withCounts(source[0]);
  const run = (work: Promise<unknown>) => {
    setError("");
    void work.catch((error) => setError(error.message));
  };
  return (
    <>
      <button
        aria-pressed={actions.isSaved(place.id)}
        disabled={actions.isPending("save", place.id)}
        onClick={() => run(actions.save(place.id))}
      >
        저장 테스트
      </button>
      <button
        aria-pressed={actions.votes[place.id] === 1}
        disabled={actions.isPending("vote", place.id)}
        onClick={() => run(actions.vote(place, 1))}
      >
        추천 테스트
      </button>
      <button
        aria-pressed={actions.followed}
        disabled={actions.isPending("follow", "map")}
        onClick={() => run(actions.follow("map"))}
      >
        팔로우 테스트
      </button>
      <output aria-label="추천 수">{place.positive}</output>
      <output aria-label="오류">{error}</output>
      <button onClick={() => setIdentity("viewer-b")}>사용자 전환</button>
      <button onClick={() => setSource([{ ...sheetPlace, positive: 20 }])}>
        서버 데이터 갱신
      </button>
      <PlaceResources identity={identity}>
        <ThreadReader />
        <ThreadReader />
      </PlaceResources>
    </>
  );
}
function ThreadReader() {
  const thread = usePlaceComments(sheetPlace.id, false);
  return <output aria-label="공유 댓글 수">{thread.total}</output>;
}
function ListFixture() {
  const [active, setActive] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const places = Array.from({ length: 12 }, (_, index) => ({
    ...sheetPlace,
    id: `list-${index}`,
    place_id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
    name: index === 0 ? sheetPlace.name : `장소 ${index + 1}`,
  }));
  return (
    <section className="community-explorer" data-mobile-view="list">
      <button onClick={() => setActive(!active)}>지도 전환</button>
      <output aria-label="선택 장소">{selected ?? "선택 없음"}</output>
      <section className="place-list">
        {active && (
          <MobilePlaceList
            places={places}
            selected={selected}
            active
            demo={false}
            busy={false}
            isSaved={(id) => saved.includes(id)}
            onOpen={setSelected}
            onSave={(id) =>
              setSaved((old) =>
                old.includes(id)
                  ? old.filter((item) => item !== id)
                  : [...old, id],
              )
            }
          />
        )}
      </section>
    </section>
  );
}
function SheetFixture() {
  const [stage, setStage] = useState<PlaceSheetStage>("summary");
  const [saved, setSaved] = useState(false);
  return (
    <section
      className="community-explorer"
      data-mobile-view="map"
      style={{ height: "100dvh", position: "fixed", inset: 0 }}
    >
      {stage === "closed" ? (
        <MobilePlacePeek
          subject="장소 카드"
          onExpand={() => setStage("summary")}
        />
      ) : (
        <MobilePlaceCarousel
          onOpenComments={() => {}}
          onVote={() => {}}
          getVote={() => 0}
          places={[sheetPlace]}
          activeId={sheetPlace.id}
          onSelect={() => {}}
          onOpen={() => setStage("detail")}
          onSave={() => setSaved(!saved)}
          isSaved={() => saved}
          disabled={false}
          controls={<span>지도 / 목록</span>}
          demo={false}
          onClose={() => setStage("closed")}
        />
      )}
      {stage === "detail" && (
        <PlaceDetail
          place={sheetPlace}
          userLocation={null}
          onClose={() => setStage("closed")}
          onCollapse={() => setStage("summary")}
          viewer={null}
          loginHref="/login"
          vote={0}
          saved={saved}
          onChange={() => {}}
          demo={false}
          sharePath="/maps/test-map"
          onStationSelect={() => {}}
        />
      )}
    </section>
  );
}
const personalizationPlaces = [sheetPlace];
function PersonalizationFixture() {
  const params = new URLSearchParams(location.search);
  const vote = Number(params.get("vote") ?? "1");
  const [scope, setScope] = useState("map-a");
  const [response, setResponse] = useState<{
    scope: string;
    state: ViewerState;
  } | null>(
    params.has("delayed")
      ? null
      : {
          scope: "map-a",
          state: {
            viewer: null,
            myState: {
              votes: { [sheetPlace.id]: vote },
              saves: [],
              followed: false,
            },
          },
        },
  );
  return (
    <>
      <button
        onClick={() =>
          setResponse({
            scope,
            state: {
              viewer: null,
              myState: {
                votes: { [sheetPlace.id]: vote },
                saves: [],
                followed: false,
              },
            },
          })
        }
      >
        서버 상태 수신
      </button>
      <button
        onClick={() =>
          setResponse({
            scope,
            state: {
              viewer: {
                id: "member",
                handle: "tester",
                bio: "",
                avatar_path: null,
                role: "member",
              },
              myState: { votes: {}, saves: [], followed: false },
            },
          })
        }
      >
        로그인 상태 전환
      </button>
      <button
        onClick={() => {
          setScope("map-b");
          setResponse(null);
        }}
      >
        다른 지도 전환
      </button>
      <ViewerStateProvider key={scope}>
        {response?.scope === scope && <HydrateViewer state={response.state} />}
        <CommunityExplorer
          map={{ ...map, id: scope }}
          initialPlaces={personalizationPlaces}
          pendingPlaces={[]}
          viewer={null}
          myState={{ votes: {}, saves: [], followed: false }}
          config={{ provider: "preview", key: "" }}
          demo={false}
        />
      </ViewerStateProvider>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  new URLSearchParams(location.search).get("fixture") === "personalization" ? (
    <PersonalizationFixture />
  ) : new URLSearchParams(location.search).get("fixture") === "mutations" ? (
    <MutationFixture />
  ) : new URLSearchParams(location.search).get("fixture") ===
    "place-introductions" ? (
    <PlaceDetail
      mapTitle="Seoul Taco Restaurant"
      place={{
        ...sheetPlace,
        rationale: "",
        added_by: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }}
      userLocation={null}
      onClose={() => {}}
      viewer={{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        handle: "visitor",
        bio: "",
        avatar_path: null,
        role: "member",
      }}
      loginHref="/login"
      vote={0}
      saved={false}
      onChange={() => {}}
      demo={false}
      sharePath="/maps/test-map"
      onStationSelect={() => {}}
    />
  ) : new URLSearchParams(location.search).get("fixture") ===
    "recommendations" ? (
    <RecommendationsExplorer
      handle="creator"
      displayName="Kevin"
      config={{ provider: "preview", key: "" }}
      viewer={{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        handle: "visitor",
        bio: "",
        avatar_path: null,
        role: "member",
      }}
      myState={{ saves: [], votes: {} }}
      places={Array.from({ length: 503 }, (_, i) => ({
        ...sheetPlace,
        id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`,
        place_id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, "0")}`,
        name: `추천 장소 ${i + 1}`,
        lat: 37.5 + i * 0.00001,
        lng: 127.1 + i * 0.00001,
        source_map_slug: "test-map",
        source_map_title: "테마 지도",
        source_map_kind: "community" as const,
      }))}
    />
  ) : new URLSearchParams(location.search).get("fixture") ===
    "profile-editor" ? (
    <main className="page-wrap profile-page">
      <ProfileForm
        editing
        recommendationCount={6}
        viewer={{
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          handle: "creator",
          bio: "미식, 여행지, 쇼핑",
          avatar_path: null,
          role: "member",
        }}
        snapshot={{
          profile: {
            display_name: "Kevin",
            instagram: "https://www.instagram.com/creator/",
            featured_map_id: null,
          },
          maps: [],
        }}
      />
    </main>
  ) : ["profile-overview", "profile-overview-maps"].includes(
      new URLSearchParams(location.search).get("fixture") || "",
    ) ? (
    <main className="page-wrap profile-page profile-editor-page">
      <ProfileForm
        recommendationCount={6}
        viewer={{
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          handle: "creator",
          bio: "미식, 여행지, 쇼핑",
          avatar_path: null,
          role: "member",
        }}
        snapshot={{
          profile: {
            display_name: "Kevin",
            instagram: "https://www.instagram.com/creator/",
            featured_map_id: null,
          },
          maps:
            new URLSearchParams(location.search).get("fixture") ===
            "profile-overview-maps"
              ? [0, 1].map((i) => ({
                  ...map,
                  id: `owner-map-${i}`,
                  title: `내 지도 ${i + 1}`,
                  slug: `own-map-${i}`,
                  kind: "creator" as const,
                  owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  status: "published" as const,
                  position: i,
                  cover_path: null,
                  hidden_at: null,
                }))
              : [],
        }}
      />
    </main>
  ) : new URLSearchParams(location.search).get("fixture") ===
    "profile-public" ? (
    <main className="page-wrap profile-page profile-public-page">
      <ProfilePresentation
        handle="creator"
        displayName="Kevin"
        bio="미식, 여행지, 쇼핑. 직접 고른 장소를 모읍니다."
        instagram="https://www.instagram.com/creator/"
        featuredId={map.id}
        maps={[
          {
            ...map,
            kind: "creator",
            owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "published",
            position: 0,
            cover_path: "test-cover.webp",
            hidden_at: null,
          },
          {
            ...map,
            id: "22222222-2222-4222-8222-222222222222",
            title: "도쿄 골목 산책",
            slug: "tokyo",
            kind: "creator",
            owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "published",
            position: 1,
            cover_path: null,
            hidden_at: null,
          },
        ]}
      />
    </main>
  ) : new URLSearchParams(location.search).get("fixture") ===
    "creator-studio" ? (
    <CreatorStudio
      initial={{
        profile: null,
        maps: [
          {
            ...map,
            kind: "creator",
            owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "draft",
            position: 0,
            cover_path: null,
            hidden_at: null,
          },
        ],
      }}
      viewer={{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        handle: "creator",
        bio: "기존 소개",
        avatar_path: null,
        role: "member",
      }}
    />
  ) : new URLSearchParams(location.search).get("fixture") === "home-cards" ? (
    <MobileDiscovery
      maps={Array.from({ length: 7 }, (_, index) => ({
        ...map,
        id: `map-${index}`,
        slug: `test-map-${index}`,
        title: `테마 지도 ${index + 1}`,
        description: "좋은 장소를 함께 발견하고 추천하는 지도입니다.",
        place_count: index + 1,
      }))}
      locationTerms={{}}
      demo
    />
  ) : new URLSearchParams(location.search).get("fixture") === "mobile-list" ? (
    <ListFixture />
  ) : new URLSearchParams(location.search).get("fixture") === "place-sheet" ? (
    <SheetFixture />
  ) : new URLSearchParams(location.search).get("fixture") === "admin" ? (
    <AdminConsole snapshot={snapshot} />
  ) : new URLSearchParams(location.search).get("fixture") ===
    "photo-preview" ? (
    <PlacePhotos
      placeId="11111111-1111-4111-8111-111111111111"
      viewer={null}
      loginHref="/login"
      demo={false}
      preview
      onOpenDetail={() => {
        document.documentElement.dataset.openedPhotoDetail = "true";
      }}
    />
  ) : (
    <ProposalForm
      map={
        new URLSearchParams(location.search).get("fixture") === "world"
          ? { ...map, country: null, search_scope: "world" }
          : new URLSearchParams(location.search).get("fixture") === "japan"
            ? { ...map, country: "JP" }
            : map
      }
      enabled
      autoApprove={false}
      config={{ provider: "preview", key: "" }}
    />
  ),
);
