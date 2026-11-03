import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ viewer: vi.fn() }));
vi.mock("@/server/queries", () => ({ getViewer: mocks.viewer }));
vi.mock("@/server/admin-gate", () => ({
  ADMIN_USAGE_COOKIE: "admin_usage_session",
  signAdminUsageSession: () => "signed",
}));
import { POST } from "@/app/api/admin/usage/unlock/route";
const send = (value: unknown) =>
  POST(
    new Request("http://localhost/api/admin/usage/unlock", {
      method: "POST",
      headers: { origin: "http://localhost" },
      body: JSON.stringify(value),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer.mockResolvedValue({ role: "admin" });
  vi.stubEnv("ADMIN_USAGE_PASSWORD", "password123");
});
afterEach(() => vi.unstubAllEnvs());
test("wrong, absent and same-character-length Unicode passwords return 401 without cookies", async () => {
  for (const password of [undefined, null, 123, "wrong", "가".repeat(11)]) {
    const response = await send({ password });
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  }
});
test("correct ASCII and Unicode passwords issue the existing restricted cookie", async () => {
  for (const password of ["password123", "관리자비밀번호😀"]) {
    vi.stubEnv("ADMIN_USAGE_PASSWORD", password);
    const response = await send({ password });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Path=/admin/usage");
  }
});
test("non-admin and missing configuration remain denied", async () => {
  expect((await send(null)).status).toBe(400);
  expect((await send([])).status).toBe(400);
  mocks.viewer.mockResolvedValue({ role: "member" });
  expect((await send({})).status).toBe(404);
  mocks.viewer.mockResolvedValue(null);
  expect((await send({})).status).toBe(401);
  mocks.viewer.mockResolvedValue({ role: "admin" });
  vi.stubEnv("ADMIN_USAGE_PASSWORD", "");
  expect((await send({})).status).toBe(503);
});
