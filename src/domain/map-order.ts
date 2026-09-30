import type { ThemeMap } from "./types";

export function newestMapFirst(a: ThemeMap, b: ThemeMap) {
  return b.created_at.localeCompare(a.created_at) || a.slug.localeCompare(b.slug);
}
