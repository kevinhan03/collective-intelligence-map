import { beforeEach, expect, test, vi } from "vitest";
import { PhotoByteCache } from "@/server/photo-byte-cache";
const mocks = vi.hoisted(() => ({
  visible: true,
  path: "one.webp",
  download: vi.fn(),
  role: "member",
}));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: mocks.visible
              ? {
                  status: "visible",
                  file_path: mocks.path,
                  thumbnail_path: mocks.path,
                }
              : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              status: "hidden",
              file_path: mocks.path,
              thumbnail_path: mocks.path,
            },
            error: null,
          }),
        }),
      }),
    }),
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: async () => ({ data: mocks.role, error: null }) }),
}));
import { GET } from "@/app/api/photos/[id]/image/route";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { params: Promise.resolve({ id }) };
const get = (headers = {}, query = "size=thumbnail") =>
  GET(
    new Request(`http://localhost/api/photos/${id}/image?${query}`, {
      headers,
    }),
    context,
  );
beforeEach(() => {
  mocks.visible = true;
  mocks.path = `${crypto.randomUUID()}.webp`;
  mocks.role = "member";
  mocks.download
    .mockReset()
    .mockResolvedValue({ data: new Blob(["image"]), error: null });
});
test("revalidates visibility before 304 and avoids storage on repeated image requests", async () => {
  const first = await get();
  expect(first.status).toBe(200);
  expect(await first.text()).toBe("image");
  expect(first.headers.get("cache-control")).toBe("private, no-cache");
  const etag = first.headers.get("etag")!;
  expect((await get({ "if-none-match": etag })).status).toBe(304);
  expect(await (await get()).text()).toBe("image");
  expect(mocks.download).toHaveBeenCalledTimes(1);
  mocks.visible = false;
  expect((await get({ "if-none-match": etag })).status).toBe(404);
  expect((await get()).status).toBe(404);
});
test("a new immutable path invalidates cached bytes and validators", async () => {
  const first = await get();
  mocks.path = `${crypto.randomUUID()}.webp`;
  const next = await get({ "if-none-match": first.headers.get("etag")! });
  expect(next.status).toBe(200);
  expect(next.headers.get("etag")).not.toBe(first.headers.get("etag"));
  expect(mocks.download).toHaveBeenCalledTimes(2);
});
test("admin requests require role and never reuse public image cache", async () => {
  expect((await get({}, "admin=1&size=thumbnail")).status).toBe(403);
  expect(mocks.download).not.toHaveBeenCalled();
  mocks.role = "admin";
  const first = await get({}, "admin=1&size=thumbnail");
  expect(first.headers.get("cache-control")).toBe("private, no-store");
  await get(
    { "if-none-match": first.headers.get("etag")! },
    "admin=1&size=thumbnail",
  );
  expect(mocks.download).toHaveBeenCalledTimes(2);
});
test("byte cache expires and evicts least recently used bytes within a fixed budget", () => {
  vi.useFakeTimers();
  const cache = new PhotoByteCache(6, 1000);
  const bytes = new ArrayBuffer(3);
  cache.set("a", bytes);
  cache.set("b", bytes);
  expect(cache.get("a")).toBe(bytes);
  cache.set("c", bytes);
  expect(cache.get("b")).toBeUndefined();
  cache.set("large", new ArrayBuffer(7));
  expect(cache.get("large")).toBeUndefined();
  vi.advanceTimersByTime(1001);
  expect(cache.get("a")).toBeUndefined();
  vi.useRealTimers();
});
