import { beforeEach, expect, it, vi } from "vitest";
import { demoMap, demoPlaces } from "@/server/demo";
import { areaPath } from "@/domain/seo-areas";
vi.mock("@/server/queries", () => ({ getMap: vi.fn() }));
vi.mock("@/server/seo-queries", () => ({
  getPublicInventory: vi.fn(),
  getPublicPlaceDirectory: vi.fn(),
  getPublicPlace: vi.fn(),
}));
vi.mock("@/lib/seo", () => ({
  canIndex: true,
  siteOrigin: "https://example.com",
  ogImage: "/glass-neighborhood-og.jpg",
  siteVerification: { google: 'token"<test>', bing: "bing-test" },
}));
import { getMap } from "@/server/queries";
import {
  getPublicInventory,
  getPublicPlaceDirectory,
  getPublicPlace,
} from "@/server/seo-queries";
import {
  areaDocument,
  directoryDocument,
  placeDocument,
} from "@/server/seo-pages";
const map = {
  ...demoMap,
  slug: "korea-vintage",
  title: "Korea Vintage Shop",
  tags: ["빈티지"],
};
const inventory = Array.from({ length: 47 }, (_, i) => ({
  ...demoPlaces[0],
  id: `id-${i}`,
  place_id: `place-${i}`,
  name: `Place ${String(i).padStart(2, "0")}`,
  address: i < 43 ? "서울 용산구 한남동 1" : "서울 마포구 망원동 1",
  rationale:
    i === 0 ? '<script>alert("unsafe")</script>' : `직접 확인한 추천 이유 ${i}`,
}));
beforeEach(() => {
  vi.mocked(getMap).mockResolvedValue(map);
  vi.mocked(getPublicInventory).mockResolvedValue(inventory);
  vi.mocked(getPublicPlaceDirectory).mockResolvedValue({
    places: inventory.slice(0, 40),
    total: 47,
  });
  vi.mocked(getPublicPlace).mockResolvedValue(inventory[0]);
});
it("renders real regional content with safe HTML, a canonical URL and matching schema", async () => {
  const response = await areaDocument(map.slug, "서울-용산구");
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain("서울 용산구 빈티지 추천 장소");
  expect(html).toContain("공개 장소 43곳");
  expect(html).toContain(
    'name="google-site-verification" content="token&quot;&lt;test&gt;"',
  );
  expect(html).toContain('name="msvalidate.01" content="bing-test"');
  expect(html).toContain(
    `href="https://example.com${areaPath(map.slug, "서울-용산구")}"`,
  );
  expect(html).toContain(
    "&lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt;",
  );
  expect(html).not.toContain('<script>alert("unsafe")');
  expect(html).not.toContain("Place 43");
  const structured = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1],
  );
  expect(structured["@graph"][0].mainEntity.numberOfItems).toBe(43);
  expect(structured["@graph"][0].mainEntity.itemListElement).toHaveLength(40);
  expect(structured["@graph"][0].spatialCoverage.name).toBe("서울 용산구");
  expect(html).toContain(areaPath(map.slug, "서울-용산구", 2));
});
it("pages a regional set before rendering and preserves list positions", async () => {
  const html = await (await areaDocument(map.slug, "서울-용산구", 2)).text();
  expect(html).toContain("Place 40");
  expect(html).not.toContain("Place 00");
  const structured = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1],
  );
  expect(
    structured["@graph"][0].mainEntity.itemListElement.map(
      (i: { position: number }) => i.position,
    ),
  ).toEqual([41, 42, 43]);
  expect(html).toContain(
    `https://example.com${areaPath(map.slug, "서울-용산구", 2)}`,
  );
});
it("returns noindex 404 for missing, thin, unchanged or out-of-range collections", async () => {
  for (const [key, page] of [
    ["서울-없는구", 1],
    ["서울", 1],
    ["서울-용산구", 3],
    ["서울-용산구", 0],
  ] as const) {
    const response = await areaDocument(map.slug, key, page);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("noindex");
  }
  vi.mocked(getPublicInventory).mockResolvedValue(inventory.slice(0, 2));
  expect((await areaDocument(map.slug, "서울-용산구")).status).toBe(404);
  vi.mocked(getMap).mockResolvedValue(null);
  expect((await areaDocument(map.slug, "서울-용산구")).status).toBe(404);
});
it("connects full directories and individual places to eligible regions", async () => {
  const directory = await (await directoryDocument(map.slug)).text();
  const place = await (
    await placeDocument(map.slug, inventory[0].place_id)
  ).text();
  expect(directory).toContain(areaPath(map.slug, "서울-용산구"));
  expect(directory).toContain(areaPath(map.slug, "서울-마포구"));
  expect(place).toContain(areaPath(map.slug, "서울-용산구"));
  expect(place).not.toContain(areaPath(map.slug, "서울-마포구"));
});
