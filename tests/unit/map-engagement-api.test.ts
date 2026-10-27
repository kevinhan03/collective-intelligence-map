import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  viewer: vi.fn(),
  rpc: vi.fn(),
  publicRpc: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.invalidate }));
vi.mock("@/server/queries", () => ({ getViewer: mocks.viewer }));
vi.mock("@/lib/supabase/server", () => ({
  configured: () => true,
  db: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () => ({ rpc: mocks.publicRpc }),
}));
import { GET, POST } from "@/app/api/maps/engagement/route";
const id = "11111111-1111-4111-8111-111111111111";
const post = (value: unknown, origin = "http://localhost") =>
  POST(
    new Request("http://localhost/api/maps/engagement", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(value),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer.mockResolvedValue({ id: "viewer" });
  mocks.rpc.mockResolvedValue({
    data: { hyped: true, hype_count: 1, hype_week_count: 1 },
    error: null,
  });
  mocks.publicRpc.mockResolvedValue({
    data: [{ map_id: id, saved_count: 2 }],
    error: null,
  });
});
test("requires sign-in and same origin; anonymous reads do not leak personal state", async () => {
  mocks.viewer.mockResolvedValue(null);
  const response = await GET();
  expect(await response.json()).toMatchObject({
    viewerId: null,
    saved: [],
    hyped: [],
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await post({ action: "hype", id, enabled: true })).status).toBe(401);
  expect(
    (await post({ action: "hype", id, enabled: true }, "https://evil.example"))
      .status,
  ).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
test("Hype uses the authenticated RPC identity and invalidates public ranking counts", async () => {
  expect(
    (await post({ action: "hype", id, enabled: true, user_id: "forged" }))
      .status,
  ).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("set_map_hype", {
    p_map: id,
    p_enabled: true,
  });
  expect(mocks.invalidate).toHaveBeenCalledWith("public-community", {
    expire: 0,
  });
});
test("map saves reuse follows and a confirmed save survives a count-refresh failure", async () => {
  mocks.publicRpc.mockResolvedValue({
    data: null,
    error: { message: "offline" },
  });
  const response = await post({ action: "save_map", id, enabled: true });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ saved: true });
  expect(mocks.rpc).toHaveBeenCalledWith("community_command", {
    payload: { action: "follow", id, enabled: true },
  });
});
test("rejects invalid IDs and non-boolean state before any database mutation", async () => {
  expect(
    (await post({ action: "hype", id: "bad", enabled: true })).status,
  ).toBe(400);
  expect((await post({ action: "hype", id, enabled: "yes" })).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
