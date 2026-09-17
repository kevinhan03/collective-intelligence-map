"use client";

import { track } from "@vercel/analytics/react";
import type { RendererConfig } from "@/domain/types";

// Keep client analytics aggregate-only. Do not add place IDs, map IDs, names,
// queries, or any account data here.
type Entry = "map_pin" | "map_preview" | "list" | "deep_link";

export function trackCommunityEvent(
  event:
    | "community_view_changed"
    | "community_info_opened"
    | "place_search_started"
    | "place_search_suggestion_selected"
    | "place_preview_opened"
    | "place_detail_opened",
  properties: {
    entry?: Entry;
    provider?: RendererConfig["provider"];
    view?: "map" | "list";
  } = {},
) {
  track(event, properties);
}
