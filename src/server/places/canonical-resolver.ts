import "server-only";
import { serviceDb } from "@/lib/supabase/admin";
import { HttpError } from "@/server/http";
export type CanonicalPlace = {
  placeId: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
};
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
/**
 * Same lookup, but returns the canonical place's fields too. A previously
 * approved proposal already paid for and stored this data, so callers can
 * skip a fresh (paid) provider Details request when this resolves.
 */
export async function resolveExistingPlaceDetails(
  provider: "google" | "kakao",
  externalId: string,
): Promise<CanonicalPlace | null> {
  const { data, error } = await serviceDb().rpc("resolve_provider_place", {
    p: provider,
    external_id_value: externalId,
  });
  if (error) throw new HttpError("장소 연결을 확인하지 못했습니다.", 503);
  return (data as CanonicalPlace | null) ?? null;
}
