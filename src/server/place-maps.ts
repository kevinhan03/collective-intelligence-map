import "server-only";
import type { PlaceMap } from "@/domain/types";
import { publicDb } from "@/lib/supabase/public";
import { configured } from "@/lib/supabase/server";
import { demoMap, demoPlaces } from "./demo";

export async function getPlaceMaps(placeId: string): Promise<PlaceMap[]> {
  if (!configured()) {
    if (!demoPlaces.some((place) => place.place_id === placeId)) return [];
    const {
      id,
      slug,
      title,
      description,
      country,
      city,
      search_scope,
      tags,
      kind,
    } = demoMap;
    return [
      { id, slug, title, description, country, city, search_scope, tags, kind },
    ];
  }

  // Anonymous RLS keeps drafts, hidden maps and private memberships out of
  // this list, even when the caller owns a map or is an administrator.
  const client = publicDb();
  const maps: PlaceMap[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client
      .from("map_places")
      .select(
        "theme_maps!inner(id,slug,title,description,country,city,search_scope,tags,kind),places!inner(id)",
      )
      .eq("place_id", placeId)
      .in("status", ["approved", "disputed"])
      .eq("places.status", "active")
      .eq("theme_maps.status", "published")
      .is("theme_maps.hidden_at", null)
      .order("map_id")
      .range(offset, offset + 99);
    if (error) throw new Error("이 장소가 포함된 지도를 불러오지 못했습니다.");
    maps.push(
      ...(data ?? []).map((row) => ({
        ...row.theme_maps,
        search_scope: row.theme_maps.search_scope as PlaceMap["search_scope"],
      })),
    );
    if (!data || data.length < 100) break;
  }
  return maps;
}
