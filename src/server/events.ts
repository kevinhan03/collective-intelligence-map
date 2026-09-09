import "server-only";
type Event =
  | "map_view"
  | "place_search_internal"
  | "place_search_external"
  | "vote"
  | "save"
  | "follow"
  | "comment"
  | "report"
  | "proposal"
  | "external_map_open";
// Structured first-party operational events. No emails, search text or provider payloads.
export function productEvent(
  event: Event,
  properties: {
    mapId?: string;
    mapPlaceId?: string;
    count?: number;
    enabled?: boolean;
  } = {},
) {
  console.info(
    JSON.stringify({
      type: "product_event",
      event,
      ...properties,
      at: new Date().toISOString(),
    }),
  );
}
