import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/lib/supabase/public";
import { configured } from "@/lib/supabase/server";
import { demoMap, demoPlaces } from "./demo";
import type { MapPlace, ThemeMap } from "@/domain/types";
import { z } from "zod";

// Anonymous client and the public-only invoker view: no personalized or pending data.
export const getPublicPlace = cache(
  async (mapId: string, placeId: string): Promise<MapPlace | null> => {
    "use cache";
    cacheLife({ stale: 60, revalidate: 120, expire: 600 });
    cacheTag("public-community");
    if (!z.uuid().safeParse(placeId).success) return null;
    if (!configured())
      return (
        demoPlaces.find((p) => p.map_id === mapId && p.place_id === placeId) ??
        null
      );
    const { data, error } = await publicDb()
      .from("map_place_cards")
      .select("*")
      .eq("map_id", mapId)
      .eq("place_id", placeId)
      .in("status", ["approved", "disputed"])
      .maybeSingle();
    if (error) throw new Error("공개 장소 정보를 불러오지 못했습니다.");
    return data as MapPlace | null;
  },
);

export async function getPublicPlaceDirectory(mapId: string, page = 1) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 600 });
  cacheTag("public-community");
  const size = 40,
    offset = (page - 1) * size;
  if (!configured()) {
    const all = demoPlaces.filter((p) => p.map_id === mapId);
    return { places: all.slice(offset, offset + size), total: all.length };
  }
  const { data, error, count } = await publicDb()
    .from("map_place_cards")
    .select("*", { count: "exact" })
    .eq("map_id", mapId)
    .in("status", ["approved", "disputed"])
    .order("name")
    .order("id")
    .range(offset, offset + size - 1);
  if (error?.code === "PGRST103") return { places: [], total: count ?? 0 };
  if (error) throw new Error("공개 장소 목록을 불러오지 못했습니다.");
  return { places: (data ?? []) as MapPlace[], total: count ?? 0 };
}

export type PublicInventoryPlace = {
  id: string;
  place_id: string;
  map_id: string;
  name: string;
  address: string;
  category: string;
  rationale: string;
  created_at: string;
};

export async function getPublicInventory(
  mapIds: string[],
): Promise<PublicInventoryPlace[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 600 });
  cacheTag("public-community");
  if (!configured()) return mapIds.includes(demoMap.id) ? demoPlaces : [];
  if (!mapIds.length) return [];
  const rows: PublicInventoryPlace[] = [];
  for (let offset = 0; ; offset += 500) {
    // Avoid computing vote statistics for sitemap inventory.
    const { data, error } = await publicDb()
      .from("map_places")
      .select(
        "id,place_id,map_id,rationale,created_at,places!inner(name,address,category,status)",
      )
      .in("map_id", mapIds)
      .in("status", ["approved", "disputed"])
      .eq("places.status", "active")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("사이트맵 장소 목록을 불러오지 못했습니다.");
    for (const row of data ?? []) {
      if (row.places)
        rows.push({
          id: row.id,
          place_id: row.place_id,
          map_id: row.map_id,
          rationale: row.rationale,
          created_at: row.created_at,
          name: row.places.name,
          address: row.places.address,
          category: row.places.category,
        });
    }
    if (!data || data.length < 500) return rows;
  }
}

export async function getPublicPlaceUrls(maps: ThemeMap[]) {
  return getPublicInventory(maps.map((map) => map.id));
}
