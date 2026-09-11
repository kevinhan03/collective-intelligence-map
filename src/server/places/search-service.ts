import { productEvent } from "@/server/events";
import "server-only";
import { db } from "@/lib/supabase/server";
import { resolveExistingPlace } from "./canonical-resolver";
import { getMaps } from "@/server/queries";
import { HttpError } from "@/server/http";
import { routeProvider } from "./provider-router";
import { signCandidate, verifyCandidate } from "./candidate-token";
import { metered } from "./usage";
import type { Viewer, Candidate } from "@/domain/types";
export async function searchPlaces(
  input: { mapId: string; query: string; external: boolean; session?: string },
  viewer: Viewer,
) {
  const map = (await getMaps()).find((m) => m.id === input.mapId);
  if (!map) throw new HttpError("맵이 없습니다.", 404);
  const client = await db();
  const { data: internal, error } = await client.rpc("search_internal_places", {
    q: input.query,
    m: map.id,
  });
  if (error) throw new HttpError("내부 장소를 검색하지 못했습니다.", 503);
  productEvent("place_search_internal", {
    mapId: map.id,
    count: Array.isArray(internal) ? internal.length : 0,
  });
  if (!input.external) return { internal: internal ?? [], candidates: [] };
  if (viewer.role === "member")
    throw new HttpError("외부 검색은 초대 기여자에게 열려 있습니다.", 403);
  const { name, adapter } = routeProvider(map.country);
  const session = input.session ?? crypto.randomUUID();
  productEvent("place_search_external", { mapId: map.id });
  const candidates = await metered(
    {
      provider: name,
      operation: name === "google" ? "autocomplete" : "keyword",
      userId: viewer.id,
      mapId: map.id,
      session,
    },
    () => adapter.search(input.query, { map, session }),
  );
  return {
    internal: internal ?? [],
    session,
    candidates: candidates.map((c) => ({
      ...c,
      token: signCandidate({
        provider: name,
        externalId: c.externalId,
        userId: viewer.id,
        mapId: map.id,
        session,
        expires: Date.now() + 15 * 60 * 1000,
        selected: name === "kakao",
        ...(name === "kakao"
          ? {
              name: c.label,
              address: c.address,
              lat: c.lat,
              lng: c.lng,
            }
          : {}),
      }),
    })),
  };
}
export async function selectCandidate(
  token: string,
  mapId: string,
  viewer: Viewer,
) {
  if (viewer.role === "member")
    throw new HttpError("초대 기여자 권한이 필요합니다.", 403);
  const claims = verifyCandidate(token, viewer.id, mapId);
  const map = (await getMaps()).find((m) => m.id === mapId);
  if (!map) throw new HttpError("맵이 없습니다.", 404);
  const { name, adapter } = routeProvider(map.country);
  if (name !== claims.provider)
    throw new HttpError("올바른 도시의 장소를 선택해 주세요.");
  const candidate: Candidate = {
    provider: name,
    externalId: claims.externalId,
    label: claims.name ?? "",
    address: claims.address,
    lat: claims.lat,
    lng: claims.lng,
    attribution: name === "google" ? "Google Maps" : "Kakao Maps",
  };
  const selected =
    name === "google"
      ? await metered(
          {
            provider: name,
            operation: "details",
            userId: viewer.id,
            mapId,
            session: claims.session,
          },
          () => adapter.details(candidate, { map, session: claims.session }),
        )
      : candidate;
  const placeId = await resolveExistingPlace(name, claims.externalId);
  return {
    candidate: {
      ...selected,
      token: signCandidate({
        ...claims,
        selected: true,
        name: selected.label,
        address: selected.address,
        lat: selected.lat,
        lng: selected.lng,
      }),
    },
    placeId,
  };
}
