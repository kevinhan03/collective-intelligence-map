import "server-only";
import { productEvent } from "@/server/events";
import { db } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { resolveExistingPlaceDetails } from "./canonical-resolver";
import { getSearchMap } from "./search-map";
import { HttpError } from "@/server/http";
import { routeProvider } from "./provider-router";
import { signCandidate, verifyCandidate } from "./candidate-token";
import { metered } from "./usage";
import { japaneseSearchAliases } from "./gemini-search-alias";
import { searchScope, withinSearchScope } from "@/domain/search-scope";
import type { SearchTiming } from "./search-timing";
import { normalizeProposalQuery } from "@/domain/search-scope";
import { canTranslateJapanese } from "./gemini-search-alias";
import type { Viewer, Candidate } from "@/domain/types";
// Process-local sharing only. Authentication still runs for each API request;
// completed results are never kept here or shared across users.
const pendingSearches = new Map<string, ReturnType<typeof runSearchPlaces>>();
export function searchPlaces(
  input: Parameters<typeof runSearchPlaces>[0],
  viewer: Viewer,
  timing?: SearchTiming,
) {
  const key = JSON.stringify([
    viewer.id,
    viewer.role,
    input.mapId,
    normalizeProposalQuery(input.query),
    input.external,
    Boolean(input.translate),
    input.session ?? null,
  ]);
  const current = pendingSearches.get(key);
  if (current) return current;
  const task = runSearchPlaces(input, viewer, timing);
  // Bound process memory without evicting live jobs. Extra distinct requests
  // still execute normally and retain existing authorization/provider limits.
  if (pendingSearches.size < 256) {
    pendingSearches.set(key, task);
    const cleanup = () => {
      if (pendingSearches.get(key) === task) pendingSearches.delete(key);
    };
    void task.then(cleanup, cleanup);
  }
  return task;
}
async function runSearchPlaces(
  input: {
    mapId: string;
    query: string;
    external: boolean;
    translate?: boolean;
    session?: string;
  },
  viewer: Viewer,
  timing?: SearchTiming,
) {
  const measure = <T>(stage: string, run: () => PromiseLike<T>) =>
    timing ? timing.measure(stage, run) : Promise.resolve(run());
  const map = await measure("map", () => getSearchMap(input.mapId));
  if (!map) throw new HttpError("맵이 없습니다.", 404);
  const client = await db();
  const { data: internal, error } = await measure("internal", () =>
    client.rpc("search_internal_places", {
      q: input.query,
      m: map.id,
    }),
  );
  if (error) throw new HttpError("내부 장소를 검색하지 못했습니다.", 503);
  const matches = (internal ?? []) as { id: string }[];
  const { data: currentMap, error: mapError } = matches.length
    ? await serviceDb()
        .from("map_places")
        .select("id,place_id,status,added_by")
        .eq("map_id", map.id)
        .in(
          "place_id",
          matches.map((place) => place.id),
        )
    : { data: [], error: null };
  if (mapError)
    throw new HttpError("지도 등록 여부를 확인하지 못했습니다.", 503);
  const mapPlaces = new Map(
    (currentMap ?? []).map((place) => [place.place_id, place]),
  );
  const internalWithStatus = matches.map((place) => {
    const current = mapPlaces.get(place.id);
    const publicStatus =
      current && ["approved", "pending", "disputed"].includes(current.status);
    return {
      ...place,
      currentMapPlaceId: publicStatus ? current.id : null,
      currentMapStatus: current
        ? publicStatus || current.added_by === viewer.id
          ? current.status
          : "reviewed"
        : null,
    };
  });
  productEvent("place_search_internal", {
    mapId: map.id,
    count: matches.length,
  });
  const metadata = {
    translationAvailable: false,
    coverage: searchScope(map) === "world" ? ("partial" as const) : undefined,
  };
  if (!input.external || matches.length > 0)
    return { internal: internalWithStatus, candidates: [], ...metadata };
  const { name, adapter } = routeProvider(map.country, searchScope(map));
  const session = input.session ?? crypto.randomUUID();
  productEvent("place_search_external", { mapId: map.id });
  let candidates = await measure("regional", () =>
    name === "overture"
      ? adapter.search(input.query, { map, session })
      : metered(
          {
            provider: name,
            operation: "keyword",
            userId: viewer.id,
            mapId: map.id,
            session,
          },
          () => adapter.search(input.query, { map, session }),
        ),
  );
  // English-only queries with no Japanese Overture match get one cached Gemini
  // fallback. It translates the query, never provider place data.
  const translationAvailable =
    name === "overture" &&
    searchScope(map) !== "world" &&
    canTranslateJapanese(input.query, map.country ?? "");
  if (input.translate && translationAvailable && candidates.length === 0) {
    const aliases = await measure("translation", () =>
      japaneseSearchAliases(input.query, map.country!, viewer.id),
    );
    if (aliases.length) {
      const translated = await measure("translatedSearch", () =>
        Promise.all(
          aliases.map((alias) => adapter.search(alias, { map, session })),
        ),
      );
      candidates = translated
        .flat()
        .filter(
          (candidate, index, all) =>
            all.findIndex(
              (item) => item.externalId === candidate.externalId,
            ) === index,
        )
        .slice(0, 10);
    }
  }
  return {
    internal: internalWithStatus,
    session,
    ...metadata,
    translationAvailable:
      translationAvailable && !input.translate && candidates.length === 0,
    candidates: candidates.map((c) => ({
      ...c,
      token: signCandidate({
        provider: name,
        externalId: c.externalId,
        userId: viewer.id,
        mapId: map.id,
        session,
        expires: Date.now() + 15 * 60 * 1000,
        selected: false,
        // Kakao has no ID-details endpoint. Carry only signed transient fields;
        // neither the search index nor the database stores this result.
        ...(name === "kakao"
          ? {
              name: c.label,
              address: c.address,
              lat: c.lat,
              lng: c.lng,
              category: c.category,
              locality: c.locality,
              countryCode: c.countryCode,
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
  const claims = verifyCandidate(token, viewer.id, mapId);
  const map = await getSearchMap(mapId);
  if (!map) throw new HttpError("맵이 없습니다.", 404);
  const { name, adapter } = routeProvider(map.country, searchScope(map));
  if (name !== claims.provider)
    throw new HttpError("올바른 도시의 장소를 선택해 주세요.");
  const existing = await resolveExistingPlaceDetails(name, claims.externalId);
  const candidate: Candidate = {
    provider: name,
    externalId: claims.externalId,
    label: claims.name ?? "",
    address: claims.address,
    lat: claims.lat,
    lng: claims.lng,
    category: claims.category,
    locality: claims.locality,
    countryCode: claims.countryCode,
    attribution: name === "overture" ? "Overture Maps" : "Kakao Maps",
  };
  const selected: Candidate = existing
    ? {
        ...candidate,
        label: existing.name,
        address: existing.address,
        category: existing.category,
        lat: existing.lat,
        lng: existing.lng,
        countryCode:
          existing.countryCode ??
          claims.countryCode ??
          (map.country || undefined),
      }
    : await adapter.details(candidate, { map, session: claims.session });
  if (
    selected.lat === undefined ||
    selected.lng === undefined ||
    !selected.label ||
    !selected.countryCode ||
    !withinSearchScope(map, {
      countryCode: selected.countryCode,
      lat: selected.lat,
      lng: selected.lng,
    })
  )
    throw new HttpError("지도 범위 안의 장소를 다시 선택해 주세요.");
  const currentMapPlace = existing?.placeId
    ? await serviceDb()
        .from("map_places")
        .select("id,status,added_by")
        .eq("map_id", map.id)
        .eq("place_id", existing.placeId)
        .maybeSingle()
    : null;
  if (currentMapPlace?.error)
    throw new HttpError("지도 등록 여부를 확인하지 못했습니다.", 503);
  const publicStatus =
    currentMapPlace?.data &&
    ["approved", "pending", "disputed"].includes(currentMapPlace.data.status);
  return {
    placeId: existing?.placeId ?? null,
    currentMapPlaceId: publicStatus
      ? (currentMapPlace?.data?.id ?? null)
      : null,
    currentMapStatus: currentMapPlace?.data
      ? publicStatus || currentMapPlace.data.added_by === viewer.id
        ? currentMapPlace.data.status
        : "reviewed"
      : null,
    candidate: {
      ...selected,
      token: signCandidate({
        ...claims,
        selected: true,
        name: selected.label,
        address: selected.address,
        lat: selected.lat,
        lng: selected.lng,
        category: selected.category,
        locality: selected.locality,
        countryCode: selected.countryCode,
      }),
    },
  };
}
