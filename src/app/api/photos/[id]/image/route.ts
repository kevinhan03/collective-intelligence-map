import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { publicDb } from "@/lib/supabase/public";
import { serviceDb } from "@/lib/supabase/admin";
import { dbError, failure, HttpError } from "@/server/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    const url = new URL(request.url);
    const thumbnail = url.searchParams.get("size") === "thumbnail";
    const admin = url.searchParams.get("admin") === "1";
    if (admin) {
      const client = await db();
      const role = await client.rpc("viewer_role");
      dbError(role.error);
      if (role.data !== "admin")
        throw new HttpError("관리자 권한이 필요합니다.", 403);
    }
    // Public RLS (not the uploader's own-row policy) determines anonymous serving.
    const reader = admin ? serviceDb() : publicDb();
    const { data, error } = await reader
      .from("place_photos")
      .select("file_path,thumbnail_path,status")
      .eq("id", id)
      .maybeSingle();
    dbError(error);
    if (
      !data ||
      !(admin
        ? ["visible", "hidden"].includes(data.status)
        : data.status === "visible")
    )
      throw new HttpError("사진을 찾을 수 없습니다.", 404);
    const { data: file, error: storageError } = await serviceDb()
      .storage.from("place-photos")
      .download(thumbnail ? data.thumbnail_path : data.file_path);
    if (storageError || !file)
      throw new HttpError("사진을 불러오지 못했습니다.", 404);
    return new Response(await file.arrayBuffer(), {
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
