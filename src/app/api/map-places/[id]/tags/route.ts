import { z } from "zod";
import { revalidateTag } from "next/cache";
import { tagIdsSchema } from "@/domain/map-tags";
import { getPlaceTagState } from "@/server/map-tags";
import { db } from "@/lib/supabase/server";
import {
  body,
  dbError,
  failure,
  HttpError,
  json,
  requireViewer,
} from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    const id = z.uuid().parse((await params).id);
    const state = await getPlaceTagState(id);
    if (!state) throw new HttpError("장소를 찾을 수 없습니다.", 404);
    return json(state);
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    await requireViewer();
    const id = z.uuid().parse((await params).id);
    const { tagIds } = z
      .object({ tagIds: tagIdsSchema })
      .parse(await body(request));
    const state = await getPlaceTagState(id);
    if (!state) throw new HttpError("장소를 찾을 수 없습니다.", 404);
    if (!state.canManage)
      throw new HttpError("태그를 수정할 권한이 없습니다.", 403);
    const client = await db();
    const { data: place, error: placeError } = await client
      .from("map_places")
      .select("map_id")
      .eq("id", id)
      .single();
    dbError(placeError);
    if (!place) throw new HttpError("장소를 찾을 수 없습니다.", 404);
    const { error } = await client.rpc("map_tag_command", {
      payload: {
        action: "assign",
        mapId: place.map_id,
        mapPlaceId: id,
        tagIds,
      },
    });
    dbError(error);
    revalidateTag("public-community", { expire: 0 });
    return json(await getPlaceTagState(id));
  } catch (error) {
    return failure(error);
  }
}
