import type { ThemeMap } from "./types";
export function homeMapFirst(a: ThemeMap, b: ThemeMap) {
  return (
    Number(b.place_count > 0) - Number(a.place_count > 0) ||
    b.follower_count - a.follower_count ||
    b.place_count - a.place_count ||
    a.slug.localeCompare(b.slug)
  );
}
export function mapTheme(map: ThemeMap) {
  return map.tags.find((tag) => tag !== "전체") ?? "테마 지도";
}

export function newestMapFirst(a: ThemeMap, b: ThemeMap) {
  return (
    b.created_at.localeCompare(a.created_at) || a.slug.localeCompare(b.slug)
  );
}
