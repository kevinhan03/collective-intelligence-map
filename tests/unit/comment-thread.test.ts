import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), viewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  configured: () => true,
  db: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/server/http", async (original) => ({
  ...(await original<typeof import("@/server/http")>()),
  requireViewer: mocks.viewer,
}));
import { GET } from "@/app/api/map-places/[id]/comments/route";
import { POST } from "@/app/api/comments/[id]/like/route";
import { HttpError } from "@/server/http";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer.mockResolvedValue({ id });
  mocks.rpc.mockResolvedValue({
    data: { comments: [], total: 35 },
    error: null,
  });
});
it("loads a bounded thread with personalized state outside the public cache", async () => {
  const response = await GET(
    new Request("http://localhost/comments?offset=30"),
    context,
  );
  expect(mocks.rpc).toHaveBeenCalledWith("place_comment_thread", {
    m: id,
    page_offset: 30,
  });
  expect(await response.json()).toEqual({ comments: [], total: 35 });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it.each(["-1", "1.5", "oops", "1000001"])(
  "rejects invalid pagination %s",
  async (offset) => {
    expect(
      (
        await GET(
          new Request(`http://localhost/comments?offset=${offset}`),
          context,
        )
      ).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
function like(payload: unknown, origin = "http://localhost") {
  return POST(
    new Request("http://localhost/api/comments/like", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(payload),
    }),
    context,
  );
}
it("uses the authenticated caller and an explicit state for idempotent likes", async () => {
  mocks.rpc.mockResolvedValue({ data: { likes: 1, liked: true }, error: null });
  expect((await like({ enabled: true, user_id: "forged" })).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("set_comment_like", {
    c: id,
    enabled: true,
  });
});
it("rejects anonymous and cross-origin writes", async () => {
  mocks.viewer.mockRejectedValueOnce(
    new HttpError("로그인이 필요합니다.", 401),
  );
  expect((await like({ enabled: true })).status).toBe(401);
  expect((await like({ enabled: true }, "https://other.example")).status).toBe(
    403,
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects malformed writes and preserves authorization failures", async () => {
  expect((await like({ enabled: "true" })).status).toBe(400);
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { code: "42501", message: "hidden comment" },
  });
  expect((await like({ enabled: true })).status).toBe(403);
});
