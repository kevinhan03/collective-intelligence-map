import "server-only";
import { db } from "@/lib/supabase/server";
import { boundsSchema } from "@/domain/validation";
import { HttpError } from "@/server/http";
import type { ThemeMap } from "@/domain/types";
/** Search/selection must check current publication/scope, not the cached catalog. */
export async function getSearchMap(id: string): Promise<ThemeMap> {
  const client = await db();
  const { data, error } = await client
    .from("theme_maps")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new HttpError("맵 정보를 확인하지 못했습니다.", 503);
  if (!data) throw new HttpError("맵이 없습니다.", 404);
  return {
    ...data,
    bounds: boundsSchema.parse(data.bounds),
    place_count: 0,
    follower_count: 0,
    contributor_count: 0,
  };
}
