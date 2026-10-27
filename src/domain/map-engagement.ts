import type { ThemeMap } from "./types";
export type MapSort = "popular" | "saved" | "newest";
export function rankMaps(maps: ThemeMap[], sort: MapSort) {
  return [...maps].sort((a, b) => {
    const savedA = a.saved_count ?? a.follower_count,
      savedB = b.saved_count ?? b.follower_count;
    const rank =
      sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : sort === "saved"
          ? savedB - savedA
          : (b.hype_week_count ?? 0) - (a.hype_week_count ?? 0);
    return (
      rank ||
      (sort === "popular"
        ? Number(b.place_count > 0) - Number(a.place_count > 0)
        : 0) ||
      savedB - savedA ||
      (b.place_count ?? 0) - (a.place_count ?? 0) ||
      b.created_at.localeCompare(a.created_at) ||
      a.id.localeCompare(b.id)
    );
  });
}
