"use client";

import { captureProductEvent } from "./product-analytics";
import { publicTelemetryUrl } from "./telemetry-policy";
import { track } from "@vercel/analytics/react";
import type { RendererConfig, Sort } from "@/domain/types";

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
    | "place_detail_opened"
    | "place_sort_changed",
  properties: {
    entry?: Entry;
    provider?: RendererConfig["provider"];
    view?: "map" | "list";
    sort?: Sort;
  } = {},
) {
  if (
    typeof window === "undefined" ||
    !publicTelemetryUrl(window.location.href)
  )
    return;
  track(event, properties);
  captureProductEvent(event, properties);
}
