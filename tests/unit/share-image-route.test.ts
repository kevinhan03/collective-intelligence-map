import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getMap: vi.fn(), render: vi.fn() }));
vi.mock("@/server/queries", () => ({ getMap: mocks.getMap }));
vi.mock("@/server/share-images", () => ({ mapShareCard: mocks.render }));
import { GET } from "@/app/og/maps/[slug]/image.jpg/route";
const context = { params: Promise.resolve({ slug: "test-map" }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMap.mockResolvedValue({ id: "map" });
  mocks.render.mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    etag: '"image"',
  });
});
it("requires a currently public map before returning even a cached validator", async () => {
  mocks.getMap.mockResolvedValue(null);
  const r = await GET(
    new Request("http://localhost/og/maps/test-map/image.jpg", {
      headers: { "if-none-match": '"image"' },
    }),
    context,
  );
  expect(r.status).toBe(404);
  expect(mocks.render).not.toHaveBeenCalled();
});
it("serves JPEG with revalidation and supports conditional requests", async () => {
  const first = await GET(
    new Request("http://localhost/og/maps/test-map/image.jpg"),
    context,
  );
  expect(first.status).toBe(200);
  expect(first.headers.get("content-type")).toBe("image/jpeg");
  expect(first.headers.get("cache-control")).toBe("private, no-cache");
  const next = await GET(
    new Request("http://localhost/og/maps/test-map/image.jpg", {
      headers: { "if-none-match": '"image"' },
    }),
    context,
  );
  expect(next.status).toBe(304);
  expect(await next.text()).toBe("");
  expect(mocks.getMap).toHaveBeenCalledTimes(2);
});
