import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  viewer: vi.fn(),
  rpc: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.invalidate }));
vi.mock("@/server/queries", () => ({ getViewer: mocks.viewer }));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/server/place-photos", () => ({ cleanupPhoto: vi.fn() }));
vi.mock("@/server/events", () => ({ productEvent: vi.fn() }));
import { POST } from "@/app/api/community/route";
const id = "11111111-1111-4111-8111-111111111111";
const send = (origin = "http://localhost", value = 1) =>
  POST(
    new Request("http://localhost/api/community", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify({ action: "vote", id, value }),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer.mockResolvedValue(null);
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});
test("guests cannot vote or receive anonymous cookies and do not invalidate caches", async () => {
  for (const value of [-1, 0, 1]) {
    const response = await send("http://localhost", value);
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
test("rejects foreign origin and uses only authenticated vote RPC", async () => {
  expect((await send("https://evil.test")).status).toBe(403);
  expect(mocks.viewer).not.toHaveBeenCalled();
  mocks.viewer.mockResolvedValue({ id: "member" });
  expect((await send()).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("community_command", {
    payload: { action: "vote", id, value: 1 },
  });
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { code: "42501", message: "suspended" },
  });
  expect((await send()).status).toBe(403);
});
