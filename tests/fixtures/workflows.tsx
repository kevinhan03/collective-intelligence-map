import { createRoot } from "react-dom/client";
import { ProposalForm } from "@/components/community/proposal-form";
import {
  AdminConsole,
  type AdminSnapshot,
} from "@/components/community/admin-console";
import type { ThemeMap } from "@/domain/types";

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
createRoot(document.getElementById("root")!).render(
  new URLSearchParams(location.search).get("fixture") === "admin" ? (
    <AdminConsole snapshot={snapshot} />
  ) : (
    <ProposalForm
      map={map}
      enabled
      autoApprove={false}
      config={{ provider: "preview", key: "" }}
    />
  ),
);
