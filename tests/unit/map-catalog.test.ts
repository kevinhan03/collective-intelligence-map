import { expect, test } from "vitest";
import {
  buildCatalog,
  catalogHref,
  catalogLocation,
  emptyCatalogFilters,
  filterCatalog,
  homeCatalog,
  parseCatalogFilters,
} from "@/domain/map-catalog";
import type { ThemeMap } from "@/domain/types";
function map(slug: string, extra: Partial<ThemeMap> = {}): ThemeMap {
  return {
    id: slug,
    slug,
    title: slug,
    description: "",
    country: "KR",
    city: "Korea",
    tags: [],
    rules: "",
    bounds: { west: 0, east: 1, south: 0, north: 1 },
    created_at: "2026-10-01",
    place_count: 5,
    follower_count: 0,
    contributor_count: 0,
    ...extra,
  };
}
const maps = buildCatalog(
  [
    map("korea-vintage", {
      tags: ["빈티지"],
      hype_count: 100,
      hype_week_count: 1,
    }),
    map("tokyo-fashion", {
      city: "Tokyo",
      country: "JP",
      tags: ["빈티지"],
      hype_count: 3,
      hype_week_count: 3,
    }),
    map("seoul-night-view", {
      city: "Seoul",
      saved_count: 9,
      created_at: "2026-10-20",
    }),
    map("new-public-map"),
  ],
  { "korea-vintage": ["서울 · 강남구", "부산 · 해운대구"] },
);
test("metadata keeps original title and URL; unknown maps stay visible and unclassified", () => {
  expect(maps[0]).toMatchObject({
    title: "korea-vintage",
    displayTitle: "전국 빈티지숍",
    catalogCategory: "fashion",
    regionLabel: "전국",
  });
  expect(maps[3]).toMatchObject({ catalogCategory: null, featured: false });
  expect(homeCatalog(maps).featured?.slug).toBe("korea-vintage");
  expect(homeCatalog(maps).items.some((m) => m.slug === "korea-vintage")).toBe(
    false,
  );
  expect(
    homeCatalog(buildCatalog([map("korea-vintage", { place_count: 0 })]))
      .featured,
  ).toBeUndefined();
  expect(
    homeCatalog(maps.filter((m) => m.slug !== "korea-vintage")).featured,
  ).toBeUndefined();
  expect(
    homeCatalog(
      buildCatalog(Array.from({ length: 100 }, (_, i) => map(`map-${i}`))),
    ).items,
  ).toHaveLength(6);
});
test("search normalizes terms and aliases and combines category, region and theme", () => {
  expect(
    filterCatalog(maps, {
      ...emptyCatalogFilters,
      q: "  SEOUL   빈티지 ",
      category: "fashion",
      region: "서울",
      theme: "빈티지",
    }).map((m) => m.slug),
  ).toEqual(["korea-vintage"]);
  expect(
    filterCatalog(maps, { ...emptyCatalogFilters, q: "東京 fashion" }).map(
      (m) => m.slug,
    ),
  ).toEqual(["tokyo-fashion"]);
  expect(
    filterCatalog(maps, { ...emptyCatalogFilters, q: "없는지도" }),
  ).toHaveLength(0);
  expect(catalogLocation(maps[0], "서울")).toBe("전국 · 서울 포함");
});
test("explicit sorting distinguishes weekly Hype, saved counts and creation; default favors region-specific maps", () => {
  expect(
    filterCatalog(maps, { ...emptyCatalogFilters, sort: "popular" })[0].slug,
  ).toBe("tokyo-fashion");
  expect(
    filterCatalog(maps, { ...emptyCatalogFilters, sort: "saved" })[0].slug,
  ).toBe("seoul-night-view");
  expect(
    filterCatalog(maps, { ...emptyCatalogFilters, sort: "newest" })[0].slug,
  ).toBe("seoul-night-view");
  expect(
    filterCatalog(maps, { ...emptyCatalogFilters, region: "서울" })[0].slug,
  ).toBe("seoul-night-view");
});
test("URL filters ignore invalid values while preserving valid conditions and safe encoding", () => {
  expect(
    parseCatalogFilters(
      new URLSearchParams(
        "category=madeup&region=서울&theme=bad&sort=unknown&q=빈티지",
      ),
      maps,
    ),
  ).toEqual({ ...emptyCatalogFilters, region: "서울", q: "빈티지" });
  const parsed = {
    ...emptyCatalogFilters,
    q: "서울 빈티지",
    category: "fashion",
    region: "서울",
    theme: "빈티지",
  };
  expect(
    parseCatalogFilters(
      new URL(catalogHref(parsed), "https://example.com").searchParams,
      maps,
    ),
  ).toEqual(parsed);
  expect(catalogHref(emptyCatalogFilters)).toBe("/discover");
});
