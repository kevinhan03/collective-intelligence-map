import { z } from "zod";
import { mapSearchInput } from "@/domain/map-search";
import { publicDb } from "@/lib/supabase/public";
import { configured } from "@/lib/supabase/server";
import { getMaps } from "@/server/queries";
import { searchMapPlaces } from "@/server/map-search";
import { failure, HttpError, json } from "@/server/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    const exists = configured()
      ? (
          await publicDb()
            .from("theme_maps")
            .select("id")
            .eq("id", id)
            .eq("status", "published")
            .maybeSingle()
        ).data
      : (await getMaps()).find((map) => map.id === id);
    if (!exists) throw new HttpError("공개 지도를 찾을 수 없습니다.", 404);
    const queryParams = new URL(request.url).searchParams;
    const input = mapSearchInput.parse({
      ...Object.fromEntries(queryParams),
      tagIds: queryParams.getAll("tag"),
    });
    return json(await searchMapPlaces(id, input));
  } catch (error) {
    return failure(error);
  }
}
