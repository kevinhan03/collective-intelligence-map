import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  viewer: vi.fn(),
  list: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/server/queries", () => ({ getComments: mocks.list }));
vi.mock("@/server/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/http")>()),
  requireViewer: mocks.viewer,
}));
import { GET, POST } from "@/app/api/map-places/[id]/introductions/route";
import { HttpError } from "@/server/http";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { params: Promise.resolve({ id }) };
function request(payload: unknown) {
  return new Request(`http://localhost/api/map-places/${id}/introductions`, {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: JSON.stringify(payload),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer.mockResolvedValue({ id: "other-author" });
  mocks.rpc.mockResolvedValue({ data: "new-introduction", error: null });
});
it("reads introductions separately from conversations", async () => {
  mocks.list.mockResolvedValue([{ id: "intro", body: "소개" }]);
  const response = await GET(new Request("http://localhost"), context);
  expect(mocks.list).toHaveBeenCalledWith(id, "introduction");
  expect(await response.json()).toEqual({
    introductions: [{ id: "intro", body: "소개" }],
  });
});
it("allows another signed-in visitor to contribute through the protected RPC", async () => {
  const response = await POST(
    request({ body: "  직접 방문한 소개입니다.  ", author_id: "forged" }),
    context,
  );
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("save_place_introduction", {
    m: id,
    b: "직접 방문한 소개입니다.",
  });
  expect(mocks.revalidate).toHaveBeenCalledWith("public-community", {
    expire: 0,
  });
});
it("rejects anonymous, blank and oversized writes before the RPC", async () => {
  mocks.viewer.mockRejectedValueOnce(
    new HttpError("로그인이 필요합니다.", 401),
  );
  expect((await POST(request({ body: "익명 소개" }), context)).status).toBe(
    401,
  );
  expect((await POST(request({ body: " " }), context)).status).toBe(400);
  expect(
    (await POST(request({ body: "x".repeat(1001) }), context)).status,
  ).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("preserves RPC ownership failures and does not invalidate cached content", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { code: "42501", message: "not owner" },
  });
  const response = await POST(request({ body: "다른 소개 변경", id }), context);
  expect(response.status).toBe(403);
  expect(mocks.rpc).toHaveBeenCalledWith("save_place_introduction", {
    m: id,
    b: "다른 소개 변경",
    c: id,
  });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
