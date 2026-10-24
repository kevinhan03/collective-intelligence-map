import { z } from "zod";
import { revalidateTag } from "next/cache";
import { tagCommandSchema } from "@/domain/map-tags";
import { getMapTagCatalog } from "@/server/map-tags";
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
    const catalog = await getMapTagCatalog(id, true);
    if (!catalog) throw new HttpError("지도를 찾을 수 없습니다.", 404);
    return json(catalog);
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    await requireViewer();
    const mapId = z.uuid().parse((await params).id);
    const input = tagCommandSchema.parse(await body(request));
    const { error } = await (
      await db()
    ).rpc("map_tag_command", { payload: { ...input, mapId } });
    if (error?.code === "23505")
      throw new HttpError("같은 이름의 태그가 이미 있습니다.", 409);
    dbError(error);
    revalidateTag("public-community", { expire: 0 });
    return json(await getMapTagCatalog(mapId, true));
  } catch (error) {
    return failure(error);
  }
}
