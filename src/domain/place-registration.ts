import type { ThemeMap, Viewer } from "./types";

/** World maps are curated by admins, even when a new pin is in Korea. */
export function canRegisterPlaces(
  map: Pick<ThemeMap, "country" | "search_scope">,
  viewer?: Pick<Viewer, "role"> | null,
) {
  return (
    viewer?.role === "admin" ||
    (map.country === "KR" && map.search_scope !== "world")
  );
}
