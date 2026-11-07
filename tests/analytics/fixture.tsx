import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { Telemetry } from "@/components/telemetry";
import { CommunityExplorer } from "@/components/community/community-explorer";
import { ProposalForm } from "@/components/community/proposal-form";
import {
  beforeAnalyticsNavigation,
  installReplayNavigationGuard,
} from "@/lib/product-analytics";
import { analyticsControl } from "@/lib/analytics-controls";
import type { ThemeMap, MapPlace } from "@/domain/types";
const map: ThemeMap = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "analytics-map",
  title: "공개 지도",
  description: "",
  rules: "",
  city: "서울",
  country: "KR",
  tags: [],
  bounds: { west: 126, east: 128, south: 36, north: 38 },
  created_at: "2026-01-01",
  place_count: 1,
  follower_count: 0,
  contributor_count: 1,
};
const place: MapPlace = {
  id: "22222222-2222-4222-8222-222222222222",
  place_id: "33333333-3333-4333-8333-333333333333",
  map_id: map.id,
  name: "공개 장소",
  address: "서울",
  category: "카페",
  lat: 37,
  lng: 127,
  rationale: "공개 설명",
  status: "approved",
  added_by: null,
  handle: "member",
  positive: 0,
  negative: 0,
  saved_count: 0,
  created_at: "2026-01-01",
  last_verified_at: null,
};
const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  window.addEventListener("workflow-refresh", cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("workflow-refresh", cb);
  };
};
installReplayNavigationGuard();
function navigate(path: string) {
  beforeAnalyticsNavigation(path);
  history.pushState(null, "", path);
}
function Fixture() {
  const path = useSyncExternalStore(subscribe, () => location.pathname);
  return (
    <>
      <Telemetry key={path} />
      {path === "/maps/analytics-map" ? (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 10000,
              background: "white",
            }}
          >
            <button
              {...analyticsControl("private-open")}
              onClick={() => navigate("/saved")}
            >
              개인 화면으로
            </button>
            <button
              {...analyticsControl("proposal-open")}
              onClick={() => navigate("/maps/analytics-map/submit")}
            >
              제안 화면으로
            </button>
            <button
              {...analyticsControl("generic-public")}
              data-ph-capture-attribute-email="leak@example.com"
              title="SECRET_TOKEN"
            >
              leak@example.com SECRET_TOKEN
            </button>
            <div
              {...analyticsControl("pending-place", map.id, {
                ...place,
                status: "pending",
              })}
            >
              <button>비공개 장소 버튼</button>
            </div>
            <form onSubmit={(e) => e.preventDefault()}>
              <input aria-label="비밀 입력" defaultValue="SECRET_TOKEN" />
              <button>폼 내부 버튼</button>
            </form>
          </div>
          <CommunityExplorer
            map={map}
            initialPlaces={[place]}
            pendingPlaces={[]}
            config={{ provider: "preview", key: "" }}
            viewer={{
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              handle: "member",
              bio: "",
              avatar_path: null,
              role: "member",
            }}
            myState={{ votes: {}, saves: [], followed: false }}
            demo={false}
          />
        </>
      ) : path.endsWith("/submit") ? (
        <ProposalForm
          map={map}
          enabled
          viewerId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
          autoApprove={false}
          config={{ provider: "preview", key: "" }}
        />
      ) : (
        <>
          <button {...analyticsControl("private-button")}>개인 버튼</button>
          <button
            {...analyticsControl("private-return")}
            onClick={() => navigate("/maps/analytics-map")}
          >
            공개 지도로 돌아가기
          </button>
        </>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
