import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HttpError } from "@/server/http";
const schema = z.object({
  provider: z.enum(["google", "kakao", "overture"]),
  externalId: z.string().max(300),
  userId: z.uuid(),
  mapId: z.uuid(),
  session: z.uuid(),
  expires: z.number(),
  selected: z.boolean(),
  category: z.string().max(40).optional(),
  locality: z.string().max(120).optional(),
  countryCode: z.string().length(2).optional(),
  name: z.string().max(120).optional(),
  address: z.string().max(250).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type CandidateClaims = z.infer<typeof schema>;
function secret() {
  const s = process.env.PROVIDER_SIGNING_SECRET;
  if (!s || s.length < 32)
    throw new HttpError("외부 검색 서명 설정이 필요합니다.", 503);
  return s;
}
export function signCandidate(claims: CandidateClaims) {
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${encoded}.${createHmac("sha256", secret()).update(encoded).digest("base64url")}`;
}
export function verifyCandidate(token: string, userId: string, mapId: string) {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) throw new HttpError("장소 선택이 만료되었습니다.");
  const expected = createHmac("sha256", secret()).update(encoded).digest();
  const actual = Buffer.from(sig, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new HttpError("올바르지 않은 장소 선택입니다.");
  const claims = schema.parse(
    JSON.parse(Buffer.from(encoded, "base64url").toString()),
  );
  if (
    claims.userId !== userId ||
    claims.mapId !== mapId ||
    claims.expires < Date.now()
  )
    throw new HttpError("장소 선택이 만료되었습니다.");
  return claims;
}
