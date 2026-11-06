import type { ThemeMap } from "./types";
import { catalogCategories } from "./catalog-config";
import { regionName } from "./location";

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };
export const HOME_SHARE_IMAGE = "/og/home.jpg?v=1";
export function shareCardTitle(map: ThemeMap) {
  return map.kind === "creator" ? map.title : map.editorial?.title || map.title;
}
export function shareCardLabel(map: ThemeMap) {
  const region =
    map.editorial?.region ||
    (map.search_scope === "world" ? "세계" : regionName(map));
  const category = catalogCategories.find(
    (entry) => entry.id === map.editorial?.category,
  )?.label;
  return [region, category].filter(Boolean).join(" · ");
}
export function mapShareImage(map: ThemeMap) {
  // Version the URL when published artwork/title changes, without exposing
  // private Storage paths or varying the key with votes and follower counts.
  const source = JSON.stringify([
    shareCardTitle(map),
    shareCardLabel(map),
    map.kind,
    map.cover_path,
    map.editorial?.image,
    map.editorial?.focalPoint,
    map.editorial?.wholeSubject,
  ]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++)
    hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return `/og/maps/${encodeURIComponent(map.slug)}/image.jpg?v=1-${(hash >>> 0).toString(16)}`;
}
export function mapShareTitle(map: ThemeMap) {
  return `${shareCardTitle(map)} | 팅맵`;
}
