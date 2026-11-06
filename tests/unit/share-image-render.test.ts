import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { demoMap } from "@/server/demo";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), service: vi.fn() }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({ serviceDb: mocks.service }));
import { mapShareCard } from "@/server/share-images";
it("renders a long Korean title with the brand fallback at the correct dimensions", async () => {
  const image = await mapShareCard({
    ...demoMap,
    kind: "creator",
    title: "가나다라마바사아자차카타파하".repeat(5),
    cover_path: null,
  });
  const meta = await sharp(image.bytes).metadata();
  expect([meta.width, meta.height]).toEqual([1200, 630]);
  expect(meta.format).toBe("jpeg");
});
it("uses only anonymously authorized uploaded artwork; inaccessible uploads render a branded fallback", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const image = await mapShareCard({
    ...demoMap,
    editorial: {
      title: "비공개 이미지가 연결된 지도",
      image: "/api/catalog/images/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      category: null,
      aliases: [],
      order: 0,
    },
  });
  expect(mocks.rpc).toHaveBeenCalledWith("catalog_image_access", {
    image_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  expect(mocks.service).not.toHaveBeenCalled();
  expect((await sharp(image.bytes).metadata()).width).toBe(1200);
});

it("keeps the logo visible above photo artwork", async () => {
  const image = await mapShareCard({
    ...demoMap,
    editorial: {
      title: "라멘 한 그릇 생각날 때",
      category: "food",
      image: "/korea-ramen-restaurant.jpg",
      aliases: [],
      order: 0,
    },
  });
  const pixel = await sharp(image.bytes)
    .extract({ left: 64, top: 80, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  expect(pixel[0]).toBeGreaterThan(200);
  expect(pixel[1]).toBeGreaterThan(220);
  expect(pixel[2]).toBeLessThan(160);
  if (process.env.SHARE_CARD_PREVIEW === "1") {
    const fs = await import("node:fs/promises");
    await fs.mkdir("artifacts/share-cards", { recursive: true });
    await fs.writeFile("artifacts/share-cards/ramen.jpg", image.bytes);
  }
});
