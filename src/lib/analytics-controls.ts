import type { MapPlace } from "@/domain/types";

export function analyticsControl(
  control: string,
  mapId?: string,
  place?: Pick<MapPlace, "place_id" | "status">,
) {
  return {
    "data-analytics-id": control,
    "data-ph-capture-attribute-control": control,
    "data-ph-capture-attribute-map_id": mapId,
    "data-ph-capture-attribute-place_id":
      place?.status === "approved" ? place.place_id : undefined,
    "data-analytics-private":
      place && place.status !== "approved" ? "" : undefined,
  };
}
