import "server-only";
import { z } from "zod";
import { publicDb } from "@/lib/supabase/public";
import { configured, db } from "@/lib/supabase/server";
import { tagCatalogSchema } from "@/domain/map-tags";
import type { MapPlace } from "@/domain/types";
import { demoMap } from "./demo";
import { dbError, HttpError } from "./http";

export async function getMapTagCatalog(mapId: string, personal = false) {
  if (!configured())
    return mapId === demoMap.id
      ? { tags: demoMap.place_tags ?? [], canManage: false }
      : null;
  const client = personal ? await db() : publicDb();
  const { data, error } = await client.rpc("map_tag_catalog", { m: mapId });
  // Existing deployments remain readable until the additive migration is applied.
  if (error && ["PGRST202", "42883"].includes(error.code))
    return { tags: [], canManage: false };
  if (error) throw new HttpError("장소 태그를 불러오지 못했습니다.", 503);
  return data ? tagCatalogSchema.parse(data) : null;
}

export async function withPlaceTags<T extends MapPlace>(
  mapId: string,
  places: T[],
  personal = false,
): Promise<T[]> {
  if (!configured() || !places.length) return places;
  const client = personal ? await db() : publicDb();
  const assignments: Record<string, string[]> = {};
  for (let offset = 0; offset < places.length; offset += 500) {
    const { data, error } = await client.rpc("map_place_tag_assignments", {
      m: mapId,
      ids: places.slice(offset, offset + 500).map((place) => place.id),
    });
    if (error && ["PGRST202", "42883"].includes(error.code)) return places;
    if (error) throw new HttpError("장소 태그를 불러오지 못했습니다.", 503);
    Object.assign(
      assignments,
      z.record(z.string(), z.array(z.uuid())).parse(data),
    );
  }
  return places.map((place) => ({
    ...place,
    tag_ids: assignments[place.id] ?? [],
  }));
}

export async function getPlaceTagState(id: string) {
  if (!configured()) {
    const { demoPlaces } = await import("./demo");
    const place = demoPlaces.find((item) => item.id === id);
    return place
      ? {
          tags: demoMap.place_tags ?? [],
          tagIds: place.tag_ids ?? [],
          canManage: false,
        }
      : null;
  }
  const client = await db();
  const { data: place, error } = await client
    .from("map_places")
    .select("id,map_id")
    .eq("id", id)
    .maybeSingle();
  dbError(error);
  if (!place) return null;
  const catalog = await getMapTagCatalog(place.map_id, true);
  if (!catalog) return null;
  if (!catalog.tags.length) return { ...catalog, tagIds: [] };
  const { data: ids, error: idsError } = await client.rpc("map_place_tag_ids", {
    target: id,
  });
  dbError(idsError);
  return { ...catalog, tagIds: ids ?? [] };
}
