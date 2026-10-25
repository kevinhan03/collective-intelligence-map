import { createHash } from "node:crypto";
import { PhotoByteCache } from "@/server/photo-byte-cache";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { publicDb } from "@/lib/supabase/public";
import { serviceDb } from "@/lib/supabase/admin";
import { dbError, failure, HttpError } from "@/server/http";
const thumbnails = new PhotoByteCache();

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
    const path = thumbnail ? data.thumbnail_path : data.file_path;
    const etag = `"${createHash("sha256").update(path).digest("hex")}"`;
    // Revalidate public visibility BEFORE returning 304 or cached bytes. Hiding
    // a photo (or its parent place) must take effect even on a warm cache.
    const headers = {
      "Content-Type": "image/webp",
      "Cache-Control": admin ? "private, no-store" : "private, no-cache",
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
    };
    if (!admin && request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers });
    const cached = thumbnail && !admin ? thumbnails.get(path) : undefined;
    if (cached) return new Response(cached, { headers });
    const { data: file, error: storageError } = await serviceDb()
      .storage.from("place-photos")
      .download(path);
    if (storageError || !file)
      throw new HttpError("사진을 불러오지 못했습니다.", 404);
    if (thumbnail && !admin) {
      const bytes = await file.arrayBuffer();
      thumbnails.set(path, bytes);
      return new Response(bytes, { headers });
    }
    return new Response(file.stream(), { headers });
  } catch (e) {
    return failure(e);
  }
}
