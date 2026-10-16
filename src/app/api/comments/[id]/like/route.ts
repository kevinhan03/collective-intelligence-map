import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { body, dbError, failure, json, requireViewer } from "@/server/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireViewer();
    const id = z.uuid().parse((await params).id);
    const input = z.object({ enabled: z.boolean() }).parse(await body(request));
    const client = await db();
    const { data, error } = await client.rpc("set_comment_like", {
      c: id,
      enabled: input.enabled,
    });
    dbError(error);
    return json(data);
  } catch (error) {
    return failure(error);
  }
}
