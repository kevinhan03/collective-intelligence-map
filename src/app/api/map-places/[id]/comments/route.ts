import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { configured } from "@/lib/supabase/server";
import { dbError, failure, json } from "@/server/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const target = z.uuid().parse(id);
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(1000000)
      .parse(new URL(request.url).searchParams.get("offset") ?? 0);
    if (!configured()) return json({ comments: [], total: 0 });
    const client = await db();
    const { data, error } = await client.rpc("place_comment_thread", {
      m: target,
      page_offset: offset,
    });
    dbError(error);
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
