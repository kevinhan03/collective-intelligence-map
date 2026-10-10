import { expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
import { areaPath } from "@/domain/seo-areas";
vi.mock("@/lib/seo", () => ({
  canIndex: true,
  siteOrigin: "https://example.com",
}));
vi.mock("@/server/queries", () => ({ getMaps: vi.fn() }));
vi.mock("@/server/seo-queries", () => ({ getPublicPlaceUrls: vi.fn() }));
import { getMaps } from "@/server/queries";
import { getPublicPlaceUrls } from "@/server/seo-queries";
import sitemap from "@/app/sitemap";
it("includes eligible regional URLs alongside unique place URLs and excludes thin or unrelated collections", async () => {
  const map = { ...demoMap, slug: "korea-vintage" };
  vi.mocked(getMaps).mockResolvedValue([map]);
  const inventory = Array.from({ length: 5 }, (_, i) => ({
    id: `id-${i}`,
    map_id: map.id,
    place_id: `place-${i}`,
    name: `Place ${i}`,
    address: i < 3 ? "서울 용산구 한남동" : "서울 마포구 망원동",
    rationale: "추천 이유",
    category: "빈티지",
    created_at: "2026-10-10",
  }));
  vi.mocked(getPublicPlaceUrls).mockResolvedValue([
    ...inventory,
    { ...inventory[0], map_id: "unpublished-map" },
  ]);
  const urls = (await sitemap()).map((entry) => entry.url);
  expect(urls).toContain(
    `https://example.com${areaPath(map.slug, "서울-용산구")}`,
  );
  expect(urls).not.toContain(
    `https://example.com${areaPath(map.slug, "서울-마포구")}`,
  );
  expect(urls).not.toContain(
    `https://example.com${areaPath(map.slug, "서울")}`,
  );
  expect(urls.filter((url) => url.includes("/places/place-"))).toHaveLength(5);
  expect(new Set(urls).size).toBe(urls.length);
});
