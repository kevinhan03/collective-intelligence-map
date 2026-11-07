"use client";

import { captureProductEvent } from "./product-analytics";
import { publicTelemetryUrl } from "./telemetry-policy";
import { track } from "@vercel/analytics/react";
import type { RendererConfig, Sort } from "@/domain/types";

// Only public map/place IDs are allowed in PostHog. Never include names,
// queries, account data or IDs for pending/private places. Vercel stays aggregate-only.
type Entry =
  | "map_pin"
  | "map_preview"
  | "list"
  | "deep_link"
  | "detail"
  | "home"
  | "proposal"
  | "comments"
  | "map_focus";

export function trackCommunityEvent(
  event:
    | "community_view_changed"
    | "community_info_opened"
    | "place_search_started"
    | "place_search_suggestion_selected"
    | "place_preview_opened"
    | "place_detail_opened"
    | "place_sort_changed"
    | "place_saved"
    | "place_unsaved"
    | "map_saved"
    | "map_unsaved",
  properties: {
    map_id?: string;
    place_id?: string;
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
  const { map_id: _map, place_id: _place, ...aggregate } = properties;
  void _map;
  void _place;
  try {
    track(event, aggregate);
  } catch {
    /* Telemetry must not affect application actions. */
  }
  try {
    captureProductEvent(event, properties);
  } catch {
    /* Keep the successful action successful. */
  }
}
