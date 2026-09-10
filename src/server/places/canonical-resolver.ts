import "server-only";
import { serviceDb } from "@/lib/supabase/admin";
import { HttpError } from "@/server/http";
/** Resolve an allowed external reference to our UUID without copying provider content. */
export async function resolveExistingPlace(
  provider: "google" | "kakao",
  externalId: string,
) {
  const { data, error } = await serviceDb().rpc("resolve_provider", {
    p: provider,
    external_id_value: externalId,
  });
  if (error) throw new HttpError("장소 연결을 확인하지 못했습니다.", 503);
  return data;
}
