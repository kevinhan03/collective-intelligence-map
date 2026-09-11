import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export const ADMIN_USAGE_COOKIE = "admin_usage_session";
const TTL_MS = 1000 * 60 * 60 * 12;
function secret() {
  const s = process.env.PROVIDER_SIGNING_SECRET;
  if (!s || s.length < 32) throw new Error("관리자 세션 서명 설정이 필요합니다.");
  return s;
}
export function signAdminUsageSession() {
  const payload = String(Date.now() + TTL_MS);
  const sig = createHmac("sha256", secret())
    .update(`admin-usage:${payload}`)
    .digest("base64url");
  return `${payload}.${sig}`;
}
function verify(token: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", secret())
    .update(`admin-usage:${payload}`)
    .digest();
  const actual = Buffer.from(sig, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return false;
  return Number(payload) > Date.now();
}
export async function hasAdminUsageSession() {
  const token = (await cookies()).get(ADMIN_USAGE_COOKIE)?.value;
  return Boolean(token && verify(token));
}
