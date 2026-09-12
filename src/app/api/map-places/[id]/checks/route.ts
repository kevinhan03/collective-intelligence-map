import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { dbError, failure, json } from "@/server/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    const { data, error } = await (
      await db()
    ).rpc("place_check_summary", { m: id });
    dbError(error);
    return json(data);
  } catch (error) {
    return failure(error);
  }
}
