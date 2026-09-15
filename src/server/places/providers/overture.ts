import "server-only";
import { serviceDb } from "@/lib/supabase/admin";
import { HttpError } from "@/server/http";
import type { Candidate } from "@/domain/types";
import type { PlaceProvider } from "./types";
export const overtureProvider: PlaceProvider = {
  async search(query, { map }) {
    const { data, error } = await serviceDb().rpc("search_overture_places", {
      q: query,
      m: map.id,
    });
    if (error)
      throw new HttpError("지역 장소 검색 인덱스를 조회하지 못했습니다.", 503);
    return (data ?? []) as Candidate[];
  },
  async details(candidate, { map }) {
    const { data, error } = await serviceDb().rpc("overture_place_details", {
      external_id_value: candidate.externalId,
      m: map.id,
    });
    if (error || !data)
      throw new HttpError(
        "검색 결과가 변경되었습니다. 다시 검색해 주세요.",
        404,
      );
    return data as Candidate;
  },
};
