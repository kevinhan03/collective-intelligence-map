import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { sameOrigin } from "@/domain/request-origin";
import { requireCatalogAdmin, catalogDbError } from "@/server/catalog";
import { processPhoto } from "@/server/photo-processing";
import { HttpError, failure, json } from "@/server/http";
export async function POST(request: Request) {
  try {
    await requireCatalogAdmin();
    if (
      !sameOrigin(
        request.headers.get("origin"),
        request.url,
        process.env.NEXT_PUBLIC_SITE_URL,
      )
    )
      throw new HttpError("허용되지 않은 요청입니다.", 403);
    const mapId = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("mapId"));
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError("사진을 선택해 주세요.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError("사진은 5MB 이하입니다.", 413);
      }
      chunks.push(value);
    }
    const image = await processPhoto(
      Buffer.concat(chunks),
      request.headers.get("content-type") ?? "",
      5 * 1024 * 1024,
    );
    const client = await db();
    const reserved = await client.rpc("admin_catalog_command", {
      payload: { action: "reserve", mapId },
    });
    catalogDbError(reserved.error);
    const slot = reserved.data as unknown as {
      id: string;
      path: string;
      expiresAt: string;
    };
    const stored = await serviceDb()
      .storage.from("catalog-images")
      .upload(slot.path, image.image, {
        contentType: "image/webp",
        upsert: false,
      });
    if (stored.error)
      throw new HttpError(
        "사진을 저장하지 못했습니다. 다시 시도해 주세요.",
        503,
      );
    const ready = await client.rpc("admin_catalog_command", {
      payload: { action: "ready", imageId: slot.id },
    });
    catalogDbError(ready.error);
    return json({ id: slot.id, expiresAt: slot.expiresAt });
  } catch (e) {
    return failure(e);
  }
}
