import "server-only";
import { serviceDb } from "@/lib/supabase/admin";
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
    .maybeSingle();
  if (
    data &&
    data.status !== "published" &&
    !(
      data.kind === "creator" &&
      data.owner_id === (await client.auth.getUser()).data.user?.id
    )
  )
    throw new HttpError("맵이 없습니다.", 404);
  if (error) throw new HttpError("맵 정보를 확인하지 못했습니다.", 503);
  if (data && !data.country && data.search_scope !== "world")
    throw new HttpError("지도 검색 범위 설정을 확인해 주세요.", 503);
  if (!data) throw new HttpError("맵이 없습니다.", 404);
  if (data.search_scope === "world" || data.search_scope === "country") {
    const { data: ready, error: activationError } = await serviceDb().rpc(
      "proposal_search_ready",
    );
    if (activationError || !ready)
      throw new HttpError(
        "확장된 지도 검색 범위는 DB 적용 완료 후 사용할 수 있습니다.",
        503,
      );
  }
  return {
    ...data,
    bounds: boundsSchema.parse(data.bounds),
    search_scope:
      data.search_scope === "world"
        ? "world"
        : data.search_scope === "country"
          ? "country"
          : "region",
    place_count: 0,
    follower_count: 0,
    contributor_count: 0,
  };
}
