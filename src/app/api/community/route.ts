import { productEvent } from "@/server/events";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { commandSchema } from "@/domain/validation";
import { ensureAnonymousVoteHash } from "@/server/anonymous-votes";
import { getViewer } from "@/server/queries";
import { body, dbError, failure, HttpError, json } from "@/server/http";
export async function POST(request: Request) {
  try {
    const payload = commandSchema.parse(await body(request));
    const viewer = await getViewer();
    if (payload.action === "vote" && !viewer) {
      const tokenHash = await ensureAnonymousVoteHash();
      const { data, error } = await serviceDb().rpc("record_anonymous_vote", {
        p_target: payload.id,
        p_token_hash: tokenHash,
        p_value: payload.value,
      });
      dbError(error);
      revalidateTag("public-community", { expire: 0 });
      productEvent("vote", { mapPlaceId: payload.id });
      return json(data);
    }
    if (!viewer) throw new HttpError("로그인이 필요합니다.", 401);
    const client = await db();
    const { data, error } = await client.rpc("community_command", { payload });
    dbError(error);
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
