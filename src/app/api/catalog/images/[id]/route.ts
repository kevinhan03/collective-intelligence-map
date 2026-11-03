import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { failure, HttpError } from "@/server/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    const access = await (
      await db()
    ).rpc("catalog_image_access", { image_id: id });
    const value = access.data as { path?: string } | null;
    if (access.error || !value?.path)
      throw new HttpError("사진을 찾을 수 없습니다.", 404);
    const file = await serviceDb()
      .storage.from("catalog-images")
      .download(value.path);
    if (file.error || !file.data)
      throw new HttpError("사진을 찾을 수 없습니다.", 404);
    return new Response(file.data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
