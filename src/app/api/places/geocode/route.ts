import { z } from "zod";
import { body, failure, json, requireViewer } from "@/server/http";
import { getSearchMap } from "@/server/places/search-map";
import { geocodeAddress } from "@/server/places/geocode";
import { serviceDb } from "@/lib/supabase/admin";
import { HttpError } from "@/server/http";

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const input = z
      .object({ mapId: z.uuid(), address: z.string().trim().min(5).max(250) })
      .parse(await body(request));
    const map = await getSearchMap(input.mapId);
    if (!map) return json({ error: "맵을 찾을 수 없습니다." }, 404);
    const { data: allowed, error } = await serviceDb().rpc("reserve_search_operation", { u: viewer.id, operation: "geocode" });
    if (error) throw new HttpError("주소 검색에 연결하지 못했습니다.", 503);
    if (!allowed) throw new HttpError("주소 검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);
    return json(await geocodeAddress(input.address, map));
  } catch (error) {
    return failure(error);
  }
}
