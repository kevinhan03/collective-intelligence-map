import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), privateDb: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/server", () => ({ db: mocks.privateDb }));
vi.mock("@/lib/supabase/admin", () => ({ serviceDb: mocks.privateDb }));
import { POST } from "@/app/api/places/photos/previews/route";
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const post = (payload: unknown, origin = "http://localhost") =>
  POST(
    new Request("http://localhost/api/places/photos/previews", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(payload),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({
    data: [{ place_id: a, photo_id: b }],
    error: null,
  });
});
test("uses only the anonymous reader, deduplicates IDs and represents missing places as null", async () => {
  const r = await post({ placeIds: [a, a, b] });
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ previews: { [a]: b, [b]: null } });
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledWith("place_photo_previews", {
    place_ids: [a, b],
  });
  expect(mocks.privateDb).not.toHaveBeenCalled();
});
test.each([[], ["bad"], Array(51).fill(a), [null]])(
  "rejects invalid IDs or batch size before DB access (%j)",
  async (placeIds) => {
    expect((await post({ placeIds })).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
test("accepts the 50-ID boundary and rejects cross-origin requests", async () => {
  expect((await post({ placeIds: Array(50).fill(a) })).status).toBe(200);
  vi.clearAllMocks();
  expect((await post({ placeIds: [a] }, "https://evil.example")).status).toBe(
    403,
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
test("does not return successful empty previews when DB access fails", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { code: "PGRST202", message: "missing" },
  });
  expect((await post({ placeIds: [a] })).status).toBeGreaterThanOrEqual(400);
});
