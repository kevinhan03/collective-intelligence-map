import "server-only";
import { getMapTagCatalog, withPlaceTags } from "./map-tags";
import { cacheLife, cacheTag } from "next/cache";
import { db, configured } from "@/lib/supabase/server";
import { publicDb } from "@/lib/supabase/public";
import { serviceDb } from "@/lib/supabase/admin";
import { dbError, HttpError, requireViewer } from "./http";
import type {
  CreatorCatalogItem,
  CreatorSnapshot,
  CreatorPlace,
} from "@/domain/creator";
import type { Json } from "@/types/database";
// Expose only presentation fields after confirming the base profile is public.
export async function publicCreatorIdentity(userId: string) {
  "use cache";
  cacheLife({ stale: 0, revalidate: 60, expire: 300 });
  cacheTag("public-community");
  const { data: visible } = await publicDb()
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!visible || !process.env.SUPABASE_SECRET_KEY) return null;
  const { data, error } = await serviceDb()
    .from("creator_profiles")
    .select("display_name,instagram")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && ["42P01", "PGRST205"].includes(error.code)) return null;
  dbError(error);
  return data;
}
export async function creatorSnapshot(): Promise<CreatorSnapshot | null> {
  if (!configured()) return null;
  const { data, error } = await (await db()).rpc("creator_snapshot");
  if (error && ["PGRST202", "42883"].includes(error.code)) return null;
  dbError(error);
  const snapshot = data as unknown as CreatorSnapshot;
  snapshot.maps = await withPlaceCounts(snapshot.maps);
  return snapshot;
}
export async function creatorCatalog(): Promise<CreatorCatalogItem[]> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 60, expire: 300 });
  cacheTag("public-community");
  if (!configured()) return [];
  const { data, error } = await publicDb().rpc("creator_catalog");
  if (error && ["PGRST202", "42883"].includes(error.code)) return [];
  if (error) throw new HttpError("크리에이터 지도를 불러오지 못했습니다.", 503);
  const catalog = data as unknown as CreatorCatalogItem[];
  const maps = await withPlaceCounts(catalog.map((item) => item.map));
  return catalog.map((item, i) => ({ ...item, map: maps[i] }));
}
async function withPlaceCounts<T extends { id: string }>(maps: T[]) {
  if (!maps.length) return maps;
  const { data, error } = await publicDb().rpc("map_stats_all");
  dbError(error);
  const stats = data as unknown as { map_id: string; place_count: number }[];
  const counts = new Map(stats.map((row) => [row.map_id, row.place_count]));
  return maps.map((map) => ({ ...map, place_count: counts.get(map.id) ?? 0 }));
}
export async function ownerMap(id: string) {
  await requireViewer();
  const snapshot = await creatorSnapshot();
  if (!snapshot)
    throw new HttpError(
      "크리에이터 기능은 DB 적용 후 사용할 수 있습니다.",
      503,
    );
  const map = snapshot.maps.find((m) => m.id === id);
  if (!map) throw new HttpError("본인의 지도를 찾을 수 없습니다.", 404);
  return { ...map, place_tags: (await getMapTagCatalog(id, true))?.tags ?? [] };
}
export async function creatorPlaces(
  id: string,
  owner = false,
): Promise<CreatorPlace[]> {
  const client = owner ? await db() : publicDb();
  const { data, error } = await client.rpc("creator_places", { m: id });
  dbError(error);
  return withPlaceTags(id, data as unknown as CreatorPlace[], owner);
}
export async function creatorWrite(payload: Json) {
  const { data, error } = await (
    await db()
  ).rpc("creator_command", { payload });
  dbError(error);
  return data;
}
