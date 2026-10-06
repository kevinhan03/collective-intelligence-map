import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { sameOrigin } from "@/domain/request-origin";
import { photoInputSchema, PHOTO_UPLOAD_LIMIT } from "@/domain/place-photo";
import { processPhoto } from "@/server/photo-processing";
import { cleanupPhoto, getPhotoPage } from "@/server/place-photos";
import {
  dbError,
  failure,
  HttpError,
  json,
  requireViewer,
} from "@/server/http";
import { productEvent } from "@/server/events";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  try {
    const id = z.uuid().parse((await params).id);
    const cursor = new URL(request.url).searchParams.get("cursor");
    if (cursor && cursor.length > 300)
      throw new HttpError("사진 목록 위치가 올바르지 않습니다.");
    return json(await getPhotoPage(id, cursor));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, { params }: Params) {
  let reservation: { id: string; lease: string } | null = null;
  try {
    if (
      !sameOrigin(
        request.headers.get("origin"),
        request.url,
        process.env.NEXT_PUBLIC_SITE_URL,
      )
    )
      throw new HttpError("허용되지 않은 요청입니다.", 403);
    await requireViewer();
    const placeId = z.uuid().parse((await params).id);
    // Bound the body even for chunked requests; do not trust Content-Length alone.
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError("사진을 선택해 주세요.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > PHOTO_UPLOAD_LIMIT + 64 * 1024) {
        await reader.cancel();
        throw new HttpError("사진 전송 용량이 너무 큽니다.", 413);
      }
      chunks.push(value);
    }
    const bounded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: Buffer.concat(chunks),
    });
    let form: FormData;
    try {
      form = await bounded.formData();
    } catch {
      throw new HttpError("올바른 사진 요청이 아닙니다.");
    }
    const input = photoInputSchema.parse({
      id: form.get("uploadId"),
      caption: form.get("caption") ?? "",
    });
    const lease = randomUUID();
    const client = await db();
    const { data, error } = await client.rpc("reserve_place_photo", {
      p_id: input.id,
      p_place: placeId,
      p_caption: input.caption,
      p_lease: lease,
    });
    dbError(error);
    const row = data as {
      status: string;
      file_path: string;
      thumbnail_path: string;
    };
    if (row.status === "visible") return json({ id: input.id });
    reservation = { id: input.id, lease };
    const file = form.get("photo");
    if (!(file instanceof File)) throw new HttpError("사진을 선택해 주세요.");
    const processed = await processPhoto(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    const storage = serviceDb().storage.from("place-photos");
    for (const [path, bytes] of [
      [row.file_path, processed.image],
      [row.thumbnail_path, processed.thumbnail],
    ] as const) {
      const upload = await storage.upload(path, bytes, {
        contentType: "image/webp",
        cacheControl: "0",
        upsert: false,
      });
      if (upload.error)
        throw new HttpError(
          "사진을 저장하지 못했습니다. 다시 시도해 주세요.",
          500,
        );
    }
    const finished = await serviceDb().rpc("finish_place_photo", {
      p_id: input.id,
      p_lease: lease,
      p_width: processed.width,
      p_height: processed.height,
    });
    dbError(finished.error);
    if (!finished.data)
      throw new HttpError(
        "장소 상태가 변경되었거나 업로드가 만료되었습니다.",
        409,
      );
    reservation = null;
    try {
      await cleanupPhoto(input.id);
    } catch {
      console.error("photo_cleanup_pending", { photoId: input.id });
    }
    productEvent("photo_upload", { placeId });
    return json({ id: input.id }, 201);
  } catch (e) {
    if (reservation) {
      const failed = await serviceDb().rpc("fail_place_photo", {
        p_id: reservation.id,
        p_lease: reservation.lease,
      });
      if (failed.error)
        console.error("photo_upload_cleanup_pending", {
          photoId: reservation.id,
        });
      try {
        await cleanupPhoto(reservation.id);
      } catch {
        console.error("photo_cleanup_pending", { photoId: reservation.id });
      }
    }
    return failure(e);
  }
}
