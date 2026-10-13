import { db } from "@/lib/supabase/server";
import { dbError } from "@/server/http";
import { revalidateTag } from "next/cache";
import { creatorCommandSchema } from "@/domain/creator";
import { creatorSnapshot, creatorWrite } from "@/server/creator";
import { body, failure, json, requireViewer } from "@/server/http";
export async function GET() {
  try {
    const viewer = await requireViewer();
    return json({ snapshot: await creatorSnapshot(), bio: viewer.bio });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    await requireViewer();
    const input = creatorCommandSchema.parse(await body(request));
    const result =
      input.action === "report"
        ? await (
            await db()
          ).rpc("creator_report", { m: input.mapId, reason: input.reason })
        : input.action === "resolve_creator_report"
          ? await (
              await db()
            ).rpc("creator_resolve_report", {
              target: input.id,
              reason: input.reason,
            })
          : null;
    if (result) dbError(result.error);
    const value = result ? result.data : await creatorWrite(input);
    revalidateTag("public-community", { expire: 0 });
    return json(value);
  } catch (e) {
    return failure(e);
  }
}
