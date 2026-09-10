import { mayPersistReference } from "@/server/places/policies";
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
    if (
      claims &&
      (!claims.name || claims.lat === undefined || claims.lng === undefined)
    )
      throw new HttpError("장소 정보를 다시 선택해 주세요.");
    const { candidateToken: _, ...payload } = input;
    void _;
    const client = await db();
    const { data: id, error } = claims
      ? await serviceDb().rpc("submit_resolved_proposal", {
          payload: {
            ...payload,
            name: claims.name,
            address: claims.address ?? "",
            lat: claims.lat,
            lng: claims.lng,
            sourceNote: `${claims.provider === "google" ? "Google Places" : "Kakao Maps"}에서 사용자가 선택한 장소입니다.`,
          },
          u: viewer.id,
          p: claims.provider,
          external_id_value: claims.externalId,
          allow_ref: mayPersistReference(claims.provider),
        })
      : await client.rpc("submit_proposal", { payload });
    dbError(error);
    if (!id) throw new HttpError("장소 제안을 저장하지 못했습니다.", 503);
    if (viewer.role === "admin") {
      const admin = serviceDb();
      const { data: proposal, error: proposalError } = await admin
        .from("map_places")
        .select("place_id")
        .eq("id", id)
        .single();
      dbError(proposalError);
      if (!proposal) throw new HttpError("저장된 장소를 찾을 수 없습니다.", 503);
      const { error: placeError } = await admin
        .from("places")
        .update({ status: "active" })
        .eq("id", proposal.place_id);
      dbError(placeError);
      const { error: approvalError } = await admin
        .from("map_places")
        .update({ status: "approved" })
        .eq("id", id);
      dbError(approvalError);
    }
    return json({ id }, 201);
  } catch (e) {
    return failure(e);
  }
}
