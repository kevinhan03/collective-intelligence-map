import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { publicDb } from "@/lib/supabase/public";
import { configured } from "@/lib/supabase/server";
import { HttpError } from "@/server/http";
import type { NearbyStations } from "@/domain/types";

const schema = z.object({
  status: z.enum(["ready", "unsupported", "preparing"]),
  stations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      local_name: z.string(),
      kind: z.enum(["subway", "train"]),
      lat: z.number(),
      lng: z.number(),
      distance_m: z.number(),
    }),
  ),
});
const missingSchema = (code?: string) =>
  ["42P01", "PGRST202", "PGRST205"].includes(code ?? "");

async function cachedStations(
  placeId: string,
  revision: string,
): Promise<NearbyStations> {
  "use cache";
  cacheLife({ stale: 86400, revalidate: 86400, expire: 172800 });
  cacheTag("rail-stations");
  // Import revisions and place coordinates form part of the cache key.
  void revision;
  const { data, error } = await publicDb().rpc("nearby_rail_stations", {
    p: placeId,
  });
  if (error) throw new Error("가까운 역 정보를 불러오지 못했습니다.");
  if (!data) throw new HttpError("공개된 장소를 찾을 수 없습니다.", 404);
  return schema.parse(data);
}

export async function getNearbyStations(
  placeId: string,
): Promise<NearbyStations> {
  if (!configured()) return { status: "preparing", stations: [] };
  const client = publicDb();
  // Check public visibility on EVERY request, even when station results are cached.
  const { data: place, error } = await client
    .from("map_place_cards")
    .select("lat,lng")
    .eq("place_id", placeId)
    .limit(1)
    .maybeSingle();
  if (error) throw new HttpError("장소 정보를 불러오지 못했습니다.", 503);
  if (!place) throw new HttpError("공개된 장소를 찾을 수 없습니다.", 404);
  const { data: regions, error: regionsError } = await client
    .from("rail_station_regions")
    .select("id,revision,updated_at")
    .order("id");
  if (regionsError) {
    if (missingSchema(regionsError.code))
      return { status: "preparing", stations: [] };
    throw new HttpError("가까운 역 정보를 불러오지 못했습니다.", 503);
  }
  return cachedStations(
    placeId,
    `${place.lat},${place.lng}:${regions.map((r) => `${r.id}:${r.revision}`).join("|")}`,
  );
}
