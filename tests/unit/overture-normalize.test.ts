import { expect, it } from "vitest";
import { normalizePlace } from "../../scripts/overture/normalize.mjs";
const region = {
  country: "JP",
  city: "Tokyo",
  bounds: { west: 139, south: 35, east: 140, north: 36 },
};
const row = {
  id: "test",
  names: { primary: "A shop", common: { ja: "お店" } },
  addresses: [{ country: "JP", locality: "Shibuya", freeform: "test" }],
  latitude: 35.6,
  longitude: 139.7,
  categories: { primary: "vintage_store" },
};
it("normalizes minimal inventory without community or photo fields", () => {
  const result = normalizePlace(
    { ...row, photos: ["external"], websites: ["unused"] },
    region,
    "2026-08-19.0",
  );
  if (!result) throw new Error("Expected normalized point");
  expect(result.source_id).toBe("test");
  expect(result.search_text).toContain("お店");
  expect(result.locality).toBe("Shibuya");
  expect(result).not.toHaveProperty("photos");
  expect(result).not.toHaveProperty("websites");
});
it("excludes closed, out-of-region and other-country records", () => {
  expect(
    normalizePlace({ ...row, operating_status: "closed" }, region, "test"),
  ).toBeNull();
  expect(normalizePlace({ ...row, longitude: 2 }, region, "test")).toBeNull();
  expect(
    normalizePlace({ ...row, addresses: [{ country: "KR" }] }, region, "test"),
  ).toBeNull();
  expect(() =>
    normalizePlace({ ...row, latitude: "bad" }, region, "test"),
  ).toThrow();
});
