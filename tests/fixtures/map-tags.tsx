import React from "react";
import { createRoot } from "react-dom/client";
import { MapTagSettings } from "@/components/community/map-tag-settings";
import { PlaceTags } from "@/components/community/place-tags";
import { demoMap } from "@/server/demo";
const role = new URLSearchParams(location.search).get("role") ?? "admin";
createRoot(document.getElementById("root")!).render(
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
      id="fixture"
      onChange={() => {
        document.body.dataset.saved = "true";
      }}
    />
  </div>,
);
