import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rows: [] as {
    id: string;
    place_id: string;
    map_id: string;
    created_at: string;
    status: string;
  }[],
  filters: [] as unknown[],
  pages: [] as number[][],
  error: false,
}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () => ({
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          mocks.filters.push([table, key, value]);
          return builder;
        },
        in: (key: string, value: unknown) => {
          mocks.filters.push([table, key, value]);
          return builder;
        },
        order: () => builder,
        range: async (start: number, end: number) => {
          mocks.pages.push([start, end]);
          return {
            data: mocks.rows.slice(start, end + 1),
            error: mocks.error ? { code: "503" } : null,
          };
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: [
              { id: "map", slug: "test-map", title: "지도", kind: "community" },
            ],
            error: null,
          }).then(resolve),
      };
      return builder;
    },
  }),
}));
import { recommendedPlaces } from "@/server/profile";
import { uniqueRecommendedPlaces } from "@/domain/profile";
beforeEach(() => {
  mocks.filters = [];
  mocks.pages = [];
  mocks.error = false;
  mocks.rows = [];
});
it("combines the same actual place across themes and keeps the first ordered recommendation", () => {
  expect(
    uniqueRecommendedPlaces([
      { place_id: "p", id: "recent" },
      { place_id: "q", id: "other" },
      { place_id: "p", id: "old" },
    ]).map((row) => row.id),
  ).toEqual(["recent", "other"]);
});
it("reads beyond 100 and 500 places with public visibility filters", async () => {
  mocks.rows = Array.from({ length: 1001 }, (_, i) => ({
    id: `row-${i}`,
    place_id: i === 1000 ? "place-0" : `place-${i}`,
    map_id: "map",
    created_at: "2026-10-14",
    status: "approved",
  }));
  const rows = await recommendedPlaces("user");
  expect(rows).toHaveLength(1000);
  expect(rows[999].place_id).toBe("place-999");
  expect(mocks.pages).toEqual([
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
  expect(mocks.filters).toContainEqual(["map_place_cards", "added_by", "user"]);
  expect(mocks.filters).toContainEqual([
    "map_place_cards",
    "status",
    ["approved", "disputed"],
  ]);
  expect(mocks.filters).toContainEqual(["theme_maps", "status", "published"]);
});
it("does not invent an empty collection when the public query fails", async () => {
  mocks.error = true;
  await expect(recommendedPlaces("user")).rejects.toThrow(
    "불러오지 못했습니다",
  );
});
