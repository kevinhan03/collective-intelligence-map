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
export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const input = proposalSchema.parse(await body(request));
    const claims = input.candidateToken
      ? verifyCandidate(input.candidateToken, viewer.id, input.mapId)
      : null;
    if (claims && !claims.selected)
      throw new HttpError("검색 결과에서 장소를 먼저 선택해 주세요.");
    const { candidateToken: _, ...payload } = input;
    void _;
    const client = await db();
    const { data: id, error } = claims
      ? await serviceDb().rpc("submit_resolved_proposal", {
          payload,
          u: viewer.id,
          p: claims.provider,
          external_id_value: claims.externalId,
          allow_ref:
            claims.provider === "google" ||
            process.env.KAKAO_REF_STORAGE_ALLOWED === "true",
        })
      : await client.rpc("submit_proposal", { payload });
    dbError(error);
    return json({ id }, 201);
  } catch (e) {
    return failure(e);
  }
}
