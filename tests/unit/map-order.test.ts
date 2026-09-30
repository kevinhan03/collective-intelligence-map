import { expect, it } from "vitest";
import { newestMapFirst } from "@/domain/map-order";
import type { ThemeMap } from "@/domain/types";

it("sorts by creation time even when the input order changes", () => {
  const older = { slug: "older", created_at: "2026-09-01T00:00:00Z" } as ThemeMap;
  const newer = { slug: "newer", created_at: "2026-10-01T00:00:00Z" } as ThemeMap;
  expect([older, newer].sort(newestMapFirst).map((map) => map.slug)).toEqual([
    "newer",
    "older",
  ]);
});
