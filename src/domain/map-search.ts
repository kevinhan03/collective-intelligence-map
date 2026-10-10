import { z } from "zod";
import { placeArea, placeCity } from "./place-location";
import { placeCategoryLabel } from "./place-category";
import { sortPlaces } from "./relevance";
import type { MapPlace } from "./types";

export const mapSearchInput = z
  .object({
    q: z.string().max(100).default(""),
    stationId: z.string().min(1).max(300).optional(),
    region: z.string().max(80).default(""),
    sort: z
      .enum([
        "relevance",
        "distance",
        "newest",
        "verified",
        "controversial",
        "popular",
      ])
      .default("relevance"),
    offset: z.coerce.number().int().min(0).max(1000000).default(0),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine(
    (value) => (value.lat === undefined) === (value.lng === undefined),
    "좌표를 함께 지정해 주세요.",
  )
  .refine(
    (value) => value.sort !== "distance" || value.lat !== undefined,
    "가까운 순에는 현재 위치가 필요합니다.",
  );
export type MapSearchInput = z.infer<typeof mapSearchInput>;
export const searchStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  local_name: z.string(),
  kind: z.enum(["subway", "train"]),
  region: z.string(),
  lat: z.number(),
  lng: z.number(),
});
export const suggestionSchema = z.object({
  term: z.string(),
  kind: z.enum(["place", "area", "category", "station"]),
  station: searchStationSchema.optional(),
});
export type SearchStation = z.infer<typeof searchStationSchema>;
export type SearchSuggestion = z.infer<typeof suggestionSchema>;
export type SearchPlace = MapPlace & { station_distance_m?: number | null };
export type MapSearchResult = {
  mode: "full" | "local";
  items: SearchPlace[];
  total: number;
  hasMore: boolean;
  suggestions: SearchSuggestion[];
  station: SearchStation | null;
  stationsStatus: "ready" | "preparing" | "unsupported";
};
export const suggestionLabels = {
  place: "장소",
  area: "지역",
  category: "분류",
  station: "역",
};
export function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
export function compactSearch(value: string) {
  return normalizeSearch(value).replaceAll(" ", "");
}
export function searchFields(place: MapPlace) {
  const categoryLabel = placeCategoryLabel(place.category);
  return [
    place.name,
    place.address,
    place.category,
    categoryLabel === "장소" ? "" : categoryLabel,
    place.rationale,
    placeArea(place.address),
  ];
}
export function matchesSearch(place: MapPlace, query: string) {
  const fields = searchFields(place).map(compactSearch);
  return normalizeSearch(query)
    .split(" ")
    .filter(Boolean)
    .every((term) =>
      fields.some((field) => field.includes(compactSearch(term))),
    );
}
export function searchRank(place: MapPlace, query: string) {
  const name = compactSearch(place.name),
    term = compactSearch(query);
  return !term
    ? 3
    : name === term
      ? 0
      : name.startsWith(term)
        ? 1
        : name.includes(term)
          ? 2
          : 3;
}
export function localMapSearch(
  places: MapPlace[],
  input: MapSearchInput,
): MapSearchResult {
  const matched = input.stationId
    ? []
    : places.filter(
        (p) =>
          matchesSearch(p, input.q) &&
          (!input.region || placeCity(p.address) === input.region),
      );
  const ordered = sortPlaces(
    matched,
    input.sort,
    input.lat === undefined ? undefined : { lat: input.lat, lng: input.lng! },
  );
  if (input.sort === "relevance")
    ordered.sort((a, b) => searchRank(a, input.q) - searchRank(b, input.q));
  const suggestions: SearchSuggestion[] = [];
  if (normalizeSearch(input.q))
    for (const p of places) {
      for (const [term, kind] of [
        [p.name, "place"],
        [placeArea(p.address), "area"],
        [
          placeCategoryLabel(p.category) === "장소"
            ? p.category
            : placeCategoryLabel(p.category),
          "category",
        ],
      ] as const) {
        if (
          term &&
          compactSearch(term).includes(compactSearch(input.q)) &&
          !suggestions.some((s) => s.term === term && s.kind === kind)
        )
          suggestions.push({ term, kind });
      }
    }
  return {
    mode: "local",
    items: ordered.slice(input.offset, input.offset + 20),
    total: ordered.length,
    hasMore: ordered.length > input.offset + 20,
    suggestions: suggestions.slice(0, 10),
    station: null,
    stationsStatus: "preparing",
  };
}
