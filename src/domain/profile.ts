import type { MapPlace } from "./types";
export type RecommendedPlace = MapPlace & {
  source_map_slug: string;
  source_map_title: string;
  source_map_kind: "community" | "creator";
};
export function uniqueRecommendedPlaces<T extends { place_id: string }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.place_id)) return false;
    seen.add(row.place_id);
    return true;
  });
}
