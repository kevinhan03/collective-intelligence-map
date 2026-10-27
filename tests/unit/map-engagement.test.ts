import { expect, test } from "vitest";
import { rankMaps } from "@/domain/map-engagement";
import type { ThemeMap } from "@/domain/types";
const maps = [
  {
    id: "old",
    created_at: "2026-09-01",
    hype_count: 100,
    hype_week_count: 1,
    saved_count: 10,
  },
  {
    id: "rising",
    created_at: "2026-10-01",
    hype_count: 4,
    hype_week_count: 4,
    saved_count: 2,
  },
  {
    id: "new",
    created_at: "2026-10-26",
    hype_count: 0,
    hype_week_count: 0,
    saved_count: 0,
  },
].map((map) => ({ ...map, follower_count: 0 }) as ThemeMap);
test("popular ranks recent Hype rather than lifetime totals; saved and newest remain independent", () => {
  expect(rankMaps(maps, "popular").map((map) => map.id)).toEqual([
    "rising",
    "old",
    "new",
  ]);
  expect(rankMaps(maps, "saved").map((map) => map.id)).toEqual([
    "old",
    "rising",
    "new",
  ]);
  expect(rankMaps(maps, "newest").map((map) => map.id)).toEqual([
    "new",
    "rising",
    "old",
  ]);
  expect(maps[0].id).toBe("old");
});

test("zero-Hype cold start keeps populated maps ahead of new empty maps", () => {
  const empty = {
    id: "empty",
    created_at: "2026-10-27",
    hype_week_count: 0,
    saved_count: 0,
    place_count: 0,
    follower_count: 0,
  } as ThemeMap;
  const full = {
    ...empty,
    id: "full",
    created_at: "2026-09-01",
    place_count: 7,
  };
  expect(rankMaps([empty, full], "popular").map((map) => map.id)).toEqual([
    "full",
    "empty",
  ]);
});
