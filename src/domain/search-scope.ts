import type { ThemeMap } from "./types";
import { inBounds } from "./relevance";

export type SearchScope = "region" | "country" | "world";
export function searchScope(map: Pick<ThemeMap, "search_scope">): SearchScope {
  return map.search_scope ?? "region";
}
export function withinSearchScope(
  map: Pick<ThemeMap, "search_scope" | "country" | "bounds">,
  place: { countryCode?: string; lat: number; lng: number },
) {
  const scope = searchScope(map);
  return (
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    Math.abs(place.lat) <= 90 &&
    Math.abs(place.lng) <= 180 &&
    (scope === "world" ||
      ((!place.countryCode || place.countryCode === map.country) &&
        (scope === "country" || inBounds(place.lat, place.lng, map.bounds))))
  );
}
export function normalizeProposalQuery(query: string) {
  return query.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
