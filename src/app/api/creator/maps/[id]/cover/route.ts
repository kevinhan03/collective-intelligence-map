import { z } from "zod";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { sameOrigin } from "@/domain/request-origin";
import { ownerMap, creatorWrite } from "@/server/creator";
import { failure, json, HttpError } from "@/server/http";
import { processPhoto } from "@/server/photo-processing";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    const id = z.uuid().parse((await params).id);
    // Cookie/RLS client grants draft images only to their owner; anonymous callers see public maps.
    const client = await db();
    const { data, error } = await client
      .from("theme_maps")
      .select("status,cover_path,kind,owner_id,hidden_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !data || !data.cover_path || data.kind !== "creator")
      throw new HttpError("커버가 없습니다.", 404);
    const user = (await client.auth.getUser()).data.user;
    if (
      (data.status !== "published" || data.hidden_at) &&
      user?.id !== data.owner_id
    )
      throw new HttpError("커버가 없습니다.", 404);
    const image = await serviceDb()
      .storage.from("creator-map-covers")
      .download(data.cover_path);
    if (image.error || !image.data)
      throw new HttpError("커버가 없습니다.", 404);
    return new Response(image.data, {
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
export async function POST(request: Request, { params }: Context) {
  try {
    if (
      !sameOrigin(
        request.headers.get("origin"),
        request.url,
        process.env.NEXT_PUBLIC_SITE_URL,
      )
    )
      throw new HttpError("허용되지 않은 요청입니다.", 403);
    const id = z.uuid().parse((await params).id);
    await ownerMap(id);
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError("커버를 선택해 주세요.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError("커버는 5MB 이하입니다.", 413);
      }
      chunks.push(value);
    }
    const image = await processPhoto(
      Buffer.concat(chunks),
      request.headers.get("content-type") ?? "",
      5 * 1024 * 1024,
    );
    const reservation = (await creatorWrite({
      action: "cover_reserve",
      mapId: id,
    })) as { path: string };
    const { error } = await serviceDb()
      .storage.from("creator-map-covers")
      .upload(reservation.path, image.image, {
        contentType: "image/webp",
        upsert: false,
      });
    if (error)
      throw new HttpError(
        "커버를 저장하지 못했습니다. 다시 시도해 주세요.",
        503,
      );
    await creatorWrite({ action: "cover", mapId: id, path: reservation.path });
    revalidateTag("public-community", { expire: 0 });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
