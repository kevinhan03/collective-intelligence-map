import { describe, it, expect } from "vitest";
import {
  catalogBatchSchema,
  editForMap,
  previewEditorial,
  sameCatalogEdit,
} from "@/domain/catalog-admin";
import { catalogEditorial } from "@/domain/catalog-config";
import { buildCatalog } from "@/domain/map-catalog";
import type { ThemeMap } from "@/domain/types";
const map = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "korea-best-burger",
  title: "Original",
  description: "",
  rules: "",
  country: "KR",
  city: "한국",
  tags: [],
  bounds: { west: 0, east: 1, south: 0, north: 1 },
  created_at: "2026-01-01",
  place_count: 1,
  follower_count: 0,
  contributor_count: 0,
} satisfies ThemeMap;
describe("catalog editorial editing", () => {
  it("preserves original identity and whole-subject framing until photo replacement", () => {
    const [catalog] = buildCatalog([map]);
    const edit = editForMap(catalog);
    const result = previewEditorial(catalog.editorial, {
      ...edit,
      title: "Edited",
    });
    expect(result.wholeSubject).toBe(true);
    expect(map.title).toBe("Original");
    const replacement = previewEditorial(result, {
      ...edit,
      imageId: "22222222-2222-4222-8222-222222222222",
    });
    expect(replacement.wholeSubject).toBe(false);
    expect(replacement.image).toContain("/api/catalog/images/");
  });
  it("feeds display metadata and aliases through public search without changing original data", () => {
    const [catalog] = buildCatalog([map]);
    const edit = {
      ...editForMap(catalog),
      title: "새 이름",
      category: "travel" as const,
      region: "서울",
      aliases: ["새별칭"],
    };
    const [next] = buildCatalog(
      [map],
      {},
      { [map.slug]: previewEditorial(catalog.editorial, edit) },
    );
    expect(next.displayTitle).toBe("새 이름");
    expect(next.title).toBe("Original");
    expect(next.regionLabel).toBe("서울");
    expect(next.searchTerms).toContain("새별칭");
  });
  it("retains versioned drafts and validates atomic batches", () => {
    const [catalog] = buildCatalog([map]);
    const edit = editForMap(catalog, {
      map_id: map.id,
      value: catalogEditorial[map.slug],
      version: 4,
    });
    expect(edit.version).toBe(4);
    expect(sameCatalogEdit(edit, { ...edit })).toBe(true);
    for (const change of [
      { title: "" },
      { focalX: 101 },
      { aliases: Array(21).fill("x") },
      { imageId: "https://bad.example" },
    ])
      expect(
        catalogBatchSchema.safeParse({ changes: [{ ...edit, ...change }] })
          .success,
      ).toBe(false);
    expect(
      catalogBatchSchema.safeParse({ changes: [edit, edit] }).success,
    ).toBe(false);
  });
});
