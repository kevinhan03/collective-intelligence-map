import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { body, failure, HttpError, json, requireViewer } from "@/server/http";
import { ADMIN_USAGE_COOKIE, signAdminUsageSession } from "@/server/admin-gate";
export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    if (viewer.role !== "admin") throw new HttpError("찾을 수 없습니다.", 404);
    const { password } = z
      .object({ password: z.unknown().optional() })
      .parse(await body(request));
    const expected = process.env.ADMIN_USAGE_PASSWORD;
    if (!expected || expected.length < 8)
      throw new HttpError("관리자 비밀번호 설정이 필요합니다.", 503);
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes =
      typeof password === "string" ? Buffer.from(password) : null;
    const ok =
      typeof password === "string" &&
      suppliedBytes !== null &&
      suppliedBytes.length === expectedBytes.length &&
      timingSafeEqual(suppliedBytes, expectedBytes);
    if (!ok) throw new HttpError("비밀번호가 올바르지 않습니다.", 401);
    const response = json({ ok: true });
    response.cookies.set(ADMIN_USAGE_COOKIE, signAdminUsageSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/admin/usage",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}
