import "server-only";
import { z } from "zod";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/lib/supabase/public";
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
export const getMaps = cache(async (): Promise<ThemeMap[]> => {
  "use cache";
  // Public community data changes only through mutations that invalidate this
  // tag. A longer lifetime keeps read-heavy traffic off Postgres and Vercel
  // functions while preserving immediate updates after a mutation.
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("public-community");
  if (!configured()) return [demoMap];
  const client = publicDb();
  const [{ data, error }, { data: statsRows, error: statsError }] =
    await Promise.all([
      client
        .from("theme_maps")
        .select("*")
        .eq("status", "published")
        .order("created_at"),
      client.rpc("map_stats_all"),
    ]);
  if (error) throw new Error("커뮤니티 목록을 불러올 수 없습니다.");
  // Statistics are an enhancement to the public map shell. A deployment must
  // still be able to prerender the map list while an RPC migration is rolling
  // out, so render zero counts and retry on the next cache revalidation.
  if (statsError) console.error("map_stats_all_unavailable");
  const statsById = new Map(
    (statsRows ?? []).map((s) => [
      s.map_id,
      {
        place_count: s.place_count,
        follower_count: s.follower_count,
        contributor_count: s.contributor_count,
      },
    ]),
  );
  return (data ?? []).map((row) => {
    const counts = statsById.get(row.id) ?? {
      place_count: 0,
      follower_count: 0,
      contributor_count: 0,
    };
    return {
      ...row,
      ...counts,
      bounds: row.bounds as unknown as Bounds,
    } as ThemeMap;
  });
});
export const getMap = cache(async (slug: string): Promise<ThemeMap | null> => {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("public-community");
  if (!configured()) return demoMap.slug === slug ? demoMap : null;
  const client = publicDb();
  const { data: row, error } = await client
    .from("theme_maps")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error("커뮤니티를 불러올 수 없습니다.");
  if (!row) return null;
  const { data: stats, error: statsError } = await client.rpc("map_stats", {
    m: row.id,
  });
  if (statsError) console.error("map_stats_unavailable");
  const counts = z
    .object({
      place_count: z.number(),
      follower_count: z.number(),
      contributor_count: z.number(),
    })
    .catch({
      place_count: 0,
      follower_count: 0,
      contributor_count: 0,
    })
    .parse(stats);
  return {
    ...row,
    ...counts,
    bounds: row.bounds as unknown as Bounds,
  } as ThemeMap;
});
export async function getPlaces(
  map: ThemeMap,
  b: Bounds = map.bounds,
): Promise<MapPlace[]> {
  return readPlaces(map, b);
}

async function cachedInitialPlaces(map: ThemeMap): Promise<MapPlace[]> {
  "use cache";
  // Local development reads newly added places within seconds. Production keeps
  // the longer cache and uses the public-community tag after mutations.
  if (process.env.NODE_ENV === "development") {
    cacheLife("seconds");
  } else {
    cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  }
  cacheTag("public-community");
  return readPlaces(map, map.bounds);
}

export { cachedInitialPlaces as getInitialPlaces };

async function readPlaces(map: ThemeMap, b: Bounds): Promise<MapPlace[]> {
  if (!configured()) return demoPlaces.filter((p) => inBounds(p.lat, p.lng, b));
  const client = publicDb();
  const { data, error } = await client.rpc("map_places_in_bounds", {
    m: map.id,
    w: b.west,
    s: b.south,
    e: b.east,
    n: b.north,
  });
  // Keep the map page usable when a public RPC has a transient failure. The
  // next tagged revalidation retries the query instead of caching an error page.
  if (error) {
    console.error("map_places_in_bounds_unavailable", error.code);
    throw new Error("장소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return data as MapPlace[];
}
export async function getPendingPlaces(map: ThemeMap): Promise<MapPlace[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("public-community");
  if (!configured()) return [];
  const client = publicDb();
  const { data, error } = await client.rpc("map_pending_places", {
    m: map.id,
  });
  // Enhancement over the core place list: render without the pending panel
  // rather than failing the whole page while a migration is rolling out.
  if (error) {
    console.error("map_pending_places_unavailable");
    return [];
  }
  return data as MapPlace[];
}
export async function getComments(id: string): Promise<Comment[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 600 });
  cacheTag("public-community");
  if (!configured()) return [];
  const client = publicDb();
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
export function rendererFor(): RendererConfig {
  if (!configured()) return { provider: "preview", key: "" };
  // Basemap rendering is independent from place search. Korea still uses the
  // Kakao Local API in provider-router.ts; MapTiler renders every map.
  return { provider: "maplibre", key: process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL ?? "" };
}
