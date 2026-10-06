import "server-only";
import { publicDb } from "@/lib/supabase/public";
import { serviceDb } from "@/lib/supabase/admin";
import { photoCursorSchema, type PhotoPage } from "@/domain/place-photo";
import { dbError, HttpError } from "./http";
export async function getPhotoPage(
  placeId: string,
  cursor: string | null,
): Promise<PhotoPage> {
  const client = publicDb();
  let query = client
    .from("place_photos")
    .select(
      "id,place_id,author_id,caption,width,height,created_at,profiles(handle)",
    )
    .eq("place_id", placeId)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(21);
  if (cursor) {
    let parsed;
    try {
      parsed = photoCursorSchema.parse(
        JSON.parse(Buffer.from(cursor, "base64url").toString()),
      );
    } catch {
      throw new HttpError("사진 목록 위치가 올바르지 않습니다.");
    }
    query = query.or(
      `created_at.lt.${parsed.at},and(created_at.eq.${parsed.at},id.lt.${parsed.id})`,
    );
  }
  const { data, error } = await query;
  dbError(error);
  const rows = data ?? [];
  const photos = rows.slice(0, 20).map(({ profiles, ...row }) => ({
    ...row,
    width: row.width!,
    height: row.height!,
    handle: profiles?.handle ?? "탈퇴한 사용자",
  }));
  const last = photos.at(-1);
  return {
    photos,
    nextCursor:
      rows.length > 20 && last
        ? Buffer.from(
            JSON.stringify({ at: last.created_at, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
export async function cleanupPhoto(id: string) {
  const client = serviceDb();
  const { data, error } = await client
    .from("place_photos")
    .select("cleanup_paths")
    .eq("id", id)
    .maybeSingle();
  dbError(error);
  const paths = [...new Set(data?.cleanup_paths ?? [])];
  if (!paths.length) return;
  const removed = await client.storage.from("place-photos").remove(paths);
  if (removed.error) {
    console.error("photo_cleanup_pending", { photoId: id });
    return;
  }
  const ack = await client.rpc("ack_photo_cleanup", {
    p_id: id,
    p_paths: paths,
  });
  if (ack.error) console.error("photo_cleanup_ack_pending", { photoId: id });
}
