import "server-only";
import { z } from "zod";
import { publicDb } from "@/lib/supabase/public";
import { configured } from "@/lib/supabase/server";
import { HttpError } from "./http";
import { demoPlaces } from "./demo";
import { getMapTagCatalog } from "./map-tags";
import { matchesTags } from "@/domain/map-tags";
import {
  localMapSearch,
  searchStationSchema,
  suggestionSchema,
  type MapSearchInput,
  type MapSearchResult,
} from "@/domain/map-search";

const item = z.object({
  position: z.number().optional(),
  id: z.string(),
  tag_ids: z.array(z.uuid()).optional().default([]),
  place_id: z.string(),
  map_id: z.string(),
  name: z.string(),
  address: z.string(),
  category: z.string(),
  lat: z.number(),
  lng: z.number(),
  rationale: z.string(),
  status: z.string(),
  added_by: z.string().nullable(),
  handle: z.string(),
  positive: z.number(),
  negative: z.number(),
  saved_count: z.number(),
  created_at: z.string(),
  last_verified_at: z.string().nullable(),
  station_distance_m: z.number().nullable().optional(),
});
const response = z.object({
  mode: z.literal("full"),
  items: z.array(item).max(20),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  suggestions: z.array(suggestionSchema).max(10),
  station: searchStationSchema.nullable(),
  stationsStatus: z.enum(["ready", "preparing", "unsupported"]),
});
export async function searchMapPlaces(
  mapId: string,
  input: MapSearchInput,
): Promise<MapSearchResult> {
  if (!configured()) return localMapSearch(demoPlaces, input);
  if (input.tagIds?.length) {
    const catalog = await getMapTagCatalog(mapId);
    if (
      !catalog ||
      input.tagIds.some((id) => !catalog.tags.some((tag) => tag.id === id))
    )
      throw new HttpError("이 지도에서 만든 활성 태그를 선택해 주세요.");
  }
  const { data, error } = await publicDb().rpc("search_map_places", {
    payload: { ...input, mapId },
  });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code))
      return {
        mode: "local",
        items: [],
        total: 0,
        hasMore: false,
        suggestions: [],
        station: null,
        stationsStatus: "preparing",
      };
    if (error.code === "22023")
      throw new HttpError("선택한 역 또는 검색 조건을 확인해 주세요.");
    throw new HttpError(
      "검색 결과를 불러오지 못했습니다. 다시 시도해 주세요.",
      503,
    );
  }
  if (!data) throw new HttpError("공개 지도를 찾을 수 없습니다.", 404);
  const parsed = response.parse(data);
  if (parsed.items.some((place) => !matchesTags(place, input.tagIds)))
    throw new HttpError(
      "태그 검색을 준비 중입니다. 잠시 후 다시 시도해 주세요.",
      503,
    );
  return parsed;
}
