import { revalidateTag } from "next/cache";
import {
  mayPersistReference,
  mayPersistPlaceFields,
} from "@/server/places/policies";
import { proposalSchema } from "@/domain/validation";
import {
  body,
  dbError,
  failure,
  HttpError,
  json,
  requireViewer,
} from "@/server/http";
import { db } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { verifyCandidate } from "@/server/places/candidate-token";
import { z } from "zod";
const proposalResult = z.object({
  id: z.uuid(),
  placeId: z.uuid(),
  status: z.string(),
  created: z.boolean(),
});
export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const input = proposalSchema.parse(await body(request));
    const claims = input.candidateToken
      ? verifyCandidate(input.candidateToken, viewer.id, input.mapId)
      : null;
    if (claims && !claims.selected)
      throw new HttpError("검색 결과에서 장소를 먼저 선택해 주세요.");
    if (
      claims &&
      (!claims.name || claims.lat === undefined || claims.lng === undefined)
    )
      throw new HttpError("장소 정보를 다시 선택해 주세요.");
    if (claims && !mayPersistPlaceFields(claims.provider))
      throw new HttpError(
        "이 검색 공급자의 장소 정보 저장이 활성화되지 않았습니다. 직접 알고 있는 정보로 새 장소를 등록해 주세요.",
        409,
      );
    const { candidateToken: _, ...payload } = input;
    void _;
    const client = await db();
    const { data, error } = claims
      ? await serviceDb().rpc("submit_resolved_proposal_result", {
          payload: {
            ...payload,
            placeId: undefined,
            name: claims.name,
            category: claims.category ?? payload.category,
            address: claims.address ?? "",
            lat: claims.lat,
            lng: claims.lng,
            sourceNote: `${claims.provider} 검색 결과에서 사용자가 선택한 장소입니다.`,
          },
          u: viewer.id,
          p: claims.provider,
          external_id_value: claims.externalId,
          allow_ref: mayPersistReference(claims.provider),
        })
      : await client.rpc("submit_proposal_result", { payload });
    dbError(error);
    if (!data) throw new HttpError("장소 제안을 저장하지 못했습니다.", 503);
    const result = proposalResult.parse(data);
    if (!result.created && ["rejected", "archived"].includes(result.status))
      throw new HttpError("이 지도에서 이미 검토된 장소입니다. 다른 장소를 선택해 주세요.", 409);
    revalidateTag("public-community", { expire: 0 });
    return json(result, result.created ? 201 : 200);
  } catch (e) {
    return failure(e);
  }
}
