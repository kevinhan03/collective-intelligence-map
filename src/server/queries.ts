import "server-only";
import { cache } from "react";
import { configured, db } from "@/lib/supabase/server";
import type {
  Bounds,
  Comment,
  MapPlace,
  ThemeMap,
  Viewer,
  RendererConfig,
} from "@/domain/types";
import { demoMap, demoPlaces } from "./demo";
import { inBounds } from "@/domain/relevance";
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!configured()) return null;
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const [{ data: profile, error }, { data: role }] = await Promise.all([
    client
      .from("profiles")
      .select("handle,bio,avatar_path")
      .eq("id", user.id)
      .single(),
    client.rpc("viewer_role"),
  ]);
  if (error) throw new Error("프로필을 불러올 수 없습니다.");
  return { id: user.id, ...profile, role: role ?? "member" } as Viewer;
});
export async function getMaps(): Promise<ThemeMap[]> {
  if (!configured()) return [demoMap];
  const client = await db();
  const { data, error } = await client
    .from("theme_maps")
    .select("*")
    .eq("status", "published")
    .order("created_at");
  if (error) throw new Error("커뮤니티 목록을 불러올 수 없습니다.");
  return Promise.all(
    (data ?? []).map(async (row) => {
      const { data: stats, error } = await client.rpc("map_stats", {
        m: row.id,
      });
      if (error) throw new Error("커뮤니티 집계를 불러올 수 없습니다.");
      return { ...row, ...stats } as ThemeMap;
    }),
  );
}
export async function getMap(slug: string) {
  return (await getMaps()).find((m) => m.slug === slug) ?? null;
}
export async function getPlaces(
  map: ThemeMap,
  b: Bounds = map.bounds,
): Promise<MapPlace[]> {
  if (!configured()) return demoPlaces.filter((p) => inBounds(p.lat, p.lng, b));
  const client = await db();
  const { data, error } = await client.rpc("map_places_in_bounds", {
    m: map.id,
    w: b.west,
    s: b.south,
    e: b.east,
    n: b.north,
  });
  if (error) throw new Error("장소를 불러올 수 없습니다.");
  return data as MapPlace[];
}
export async function getComments(id: string): Promise<Comment[]> {
  if (!configured()) return [];
  const client = await db();
  const { data, error } = await client
    .from("comments")
    .select("id,map_place_id,author_id,body,created_at,profiles(handle)")
    .eq("map_place_id", id)
    .eq("status", "visible")
    .order("created_at")
    .limit(100);
  if (error) throw new Error("댓글을 불러올 수 없습니다.");
  return (data ?? []).map((row) => ({
    ...row,
    handle:
      (row.profiles as unknown as { handle: string } | null)?.handle ??
      "탈퇴한 기여자",
  }));
}
export async function getMyState(mapId: string) {
  const viewer = await getViewer();
  if (!viewer) return { votes: {}, saves: [], followed: false };
  const client = await db();
  const [votes, saves, follow] = await Promise.all([
    client
      .from("map_place_votes")
      .select("map_place_id,value")
      .eq("user_id", viewer.id),
    client.from("saves").select("map_place_id").eq("user_id", viewer.id),
    client
      .from("map_follows")
      .select("map_id")
      .eq("user_id", viewer.id)
      .eq("map_id", mapId),
  ]);
  if (votes.error || saves.error || follow.error)
    throw new Error("내 활동을 불러올 수 없습니다.");
  return {
    votes: Object.fromEntries(
      (votes.data ?? []).map((v) => [v.map_place_id, v.value]),
    ) as Record<string, number>,
    saves: (saves.data ?? []).map((s) => s.map_place_id),
    followed: Boolean(follow.data?.length),
  };
}
export function rendererFor(map: ThemeMap): RendererConfig {
  if (!configured()) return { provider: "preview", key: "" };
  const provider = map.country === "KR" ? "kakao" : "google";
  const key =
    provider === "kakao"
      ? process.env.NEXT_PUBLIC_KAKAO_MAPS_KEY
      : process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  return { provider, key: key ?? "" };
}
