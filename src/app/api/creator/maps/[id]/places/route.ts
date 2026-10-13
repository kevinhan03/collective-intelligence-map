import { z } from "zod";
import { revalidateTag } from "next/cache";
import { proposalSchema } from "@/domain/validation";
import { body, failure, json, HttpError, requireViewer } from "@/server/http";
import { ownerMap, creatorPlaces, creatorWrite } from "@/server/creator";
import { verifyCandidate } from "@/server/places/candidate-token";
import { mayPersistPlaceFields } from "@/server/places/policies";
import { withinSearchScope } from "@/domain/search-scope";
import { serviceDb } from "@/lib/supabase/admin";
import { mayPersistReference } from "@/server/places/policies";
import { dbError } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    const id = z.uuid().parse((await params).id);
    await ownerMap(id);
    return json(await creatorPlaces(id, true));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const viewer = await requireViewer();
    const id = z.uuid().parse((await params).id);
    const map = await ownerMap(id);
    const input = proposalSchema.parse({ ...(await body(request)), mapId: id });
    const { candidateToken: token, ...payload } = input;
    let provider: { name: "overture" | "kakao"; externalId: string } | null =
      null;
    if (token) {
      const claims = verifyCandidate(token, viewer.id, id);
      if (
        !claims.selected ||
        !claims.name ||
        claims.lat === undefined ||
        claims.lng === undefined ||
        !claims.countryCode
      )
        throw new HttpError("검색 결과를 다시 선택해 주세요.");
      if (!mayPersistPlaceFields(claims.provider))
        throw new HttpError(
          "이 공급자의 장소는 직접 등록으로 추가해 주세요.",
          409,
        );
      if (
        !withinSearchScope(map, {
          countryCode: claims.countryCode,
          lat: claims.lat,
          lng: claims.lng,
        })
      )
        throw new HttpError("지도 범위 밖 장소입니다.");
      // Resolve an existing UUID first. No shared place fields are overwritten.
      if (claims.provider !== "google" && mayPersistReference(claims.provider))
        provider = { name: claims.provider, externalId: claims.externalId };
      Object.assign(payload, {
        name: claims.name,
        address: claims.address ?? "",
        category: claims.category ?? input.category,
        countryCode: claims.countryCode,
        locality: claims.locality,
        lat: claims.lat,
        lng: claims.lng,
        sourceNote: `${claims.provider} 검색 결과에서 사용자가 선택한 장소입니다.`,
      });
    }
    const resolved = provider
      ? await serviceDb().rpc("creator_add_resolved", {
          payload,
          u: viewer.id,
          p: provider.name,
          external_id_value: provider.externalId,
        })
      : null;
    if (resolved) dbError(resolved.error);
    const result = resolved
      ? resolved.data
      : await creatorWrite({ ...payload, action: "add_place" });
    revalidateTag("public-community", { expire: 0 });
    return json(result);
  } catch (e) {
    return failure(e);
  }
}
