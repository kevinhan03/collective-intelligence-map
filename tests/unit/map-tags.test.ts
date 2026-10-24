import { expect, it } from "vitest";
import { matchesTags, tagNameSchema, tagIdsSchema } from "@/domain/map-tags";
import { localMapSearch, mapSearchInput } from "@/domain/map-search";
import { demoMap, demoPlaces } from "@/server/demo";

it("normalizes hashtag input, rejects whitespace and keeps names within the limit", () => {
  expect(tagNameSchema.parse("　＃Ｃａｆｅ　")).toBe("Cafe");
  expect(tagNameSchema.parse("##혼밥")).toBe("혼밥");
  for (const invalid of ["#", "#야외 좌석", "a#b", "가".repeat(21)])
    expect(tagNameSchema.safeParse(invalid).success).toBe(false);
});
it("deduplicates and sorts tag IDs and validates UUIDs and limits", () => {
  const [a, b] = demoMap.place_tags!;
  expect(tagIdsSchema.parse([b.id, a.id, a.id])).toEqual([a.id, b.id]);
  expect(tagIdsSchema.safeParse(["bad-id"]).success).toBe(false);
  expect(tagIdsSchema.safeParse(Array(11).fill(a.id)).success).toBe(false);
});
it("matches every selected tag, including untagged and cleared states", () => {
  expect(matchesTags({ tag_ids: ["a", "b"] }, ["a", "b"])).toBe(true);
  expect(matchesTags({ tag_ids: ["a"] }, ["a", "b"])).toBe(false);
  expect(matchesTags({}, ["a"])).toBe(false);
  expect(matchesTags({}, [])).toBe(true);
});
it("combines tag AND filtering with text search before counting and paging", () => {
  const tags = demoMap.place_tags!;
  const input = mapSearchInput.parse({ tagIds: [tags[0].id, tags[3].id] });
  expect(localMapSearch(demoPlaces, input).items.map((p) => p.name)).toEqual([
    "Archive Room",
  ]);
  expect(localMapSearch(demoPlaces, { ...input, q: "Studio" }).total).toBe(0);
  const places = Array.from({ length: 25 }, (_, i) => ({
    ...demoPlaces[0],
    id: `copy-${i}`,
  }));
  expect(localMapSearch(places, input)).toMatchObject({
    total: 25,
    hasMore: true,
  });
  expect(localMapSearch(places, { ...input, offset: 20 }).items).toHaveLength(
    5,
  );
});
