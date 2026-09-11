import { productEvent } from "@/server/events";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/supabase/server";
import { commandSchema } from "@/domain/validation";
import { body, dbError, failure, json, requireViewer } from "@/server/http";
export async function POST(request: Request) {
  try {
    await requireViewer();
    const payload = commandSchema.parse(await body(request));
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
