import React from "react";
import { createRoot } from "react-dom/client";
import { MapTagSettings } from "@/components/community/map-tag-settings";
import { PlaceTags } from "@/components/community/place-tags";
import { demoMap } from "@/server/demo";
const role = new URLSearchParams(location.search).get("role") ?? "admin";
function TagFixture() {
  const [placeId, setPlaceId] = React.useState("fixture");
  return (
    <div style={{ padding: 24, display: "grid", gap: 32 }}>
      <MapTagSettings
        map={{ ...demoMap, kind: "creator", owner_id: "owner" }}
        viewer={{
          id: role === "owner" ? "owner" : "visitor",
          role: role === "admin" ? "admin" : "member",
          handle: "test",
          bio: "",
          avatar_path: null,
        }}
        demo={false}
      />
      <PlaceTags
        id={placeId}
        onChange={() => {
          document.body.dataset.saved = "true";
        }}
      />
      <button type="button" onClick={() => setPlaceId("other-fixture")}>
        다른 지도 장소 보기
      </button>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<TagFixture />);
