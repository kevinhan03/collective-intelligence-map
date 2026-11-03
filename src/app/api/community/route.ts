import { cleanupPhoto } from "@/server/place-photos";
import { productEvent } from "@/server/events";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/supabase/server";
import { commandSchema } from "@/domain/validation";
import { getViewer } from "@/server/queries";
import { body, dbError, failure, HttpError, json } from "@/server/http";
export async function POST(request: Request) {
  try {
    const payload = commandSchema.parse(await body(request));
    const viewer = await getViewer();
    if (!viewer) throw new HttpError("로그인이 필요합니다.", 401);
    const client = await db();
    const { data, error } = await client.rpc("community_command", { payload });
    dbError(error);
    if (payload.action === "delete_photo") {
      try {
        await cleanupPhoto(payload.id);
      } catch {
        console.error("photo_cleanup_pending", { photoId: payload.id });
      }
    }
    revalidateTag("public-community", { expire: 0 });
    if (
      ["vote", "save", "follow", "comment", "report"].includes(payload.action)
    )
      productEvent(
        payload.action as "vote" | "save" | "follow" | "comment" | "report",
        { mapPlaceId: "id" in payload ? payload.id : undefined },
      );
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
