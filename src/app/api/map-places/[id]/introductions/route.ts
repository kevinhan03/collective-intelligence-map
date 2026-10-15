import { z } from "zod";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/supabase/server";
import { getComments } from "@/server/queries";
import { body, dbError, failure, json, requireViewer } from "@/server/http";

type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    const id = z.uuid().parse((await params).id);
    return json({ introductions: await getComments(id, "introduction") });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    await requireViewer();
    const id = z.uuid().parse((await params).id);
    const input = z
      .object({
        body: z.string().trim().min(2).max(1000),
        id: z.uuid().optional(),
      })
      .parse(await body(request));
    const client = await db();
    const { data, error } = await client.rpc("save_place_introduction", {
      m: id,
      b: input.body,
      ...(input.id ? { c: input.id } : {}),
    });
    dbError(error);
    revalidateTag("public-community", { expire: 0 });
    return json({ id: data });
  } catch (error) {
    return failure(error);
  }
}
