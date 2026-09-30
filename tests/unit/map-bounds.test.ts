import { describe, expect, it } from "vitest";
import { boundsForPlaces } from "@/domain/map-bounds";

const fallback = { west: 125, south: 33, east: 130, north: 39 };

describe("initial map bounds", () => {
  it("keeps every distant place inside a padded view", () => {
    const bounds = boundsForPlaces(
      [{ lat: 37.56, lng: 126.97 }, { lat: 35.18, lng: 129.07 }],
      fallback,
    );
    expect(bounds.west).toBeLessThan(126.97);
    expect(bounds.east).toBeGreaterThan(129.07);
    expect(bounds.south).toBeLessThan(35.18);
    expect(bounds.north).toBeGreaterThan(37.56);
  });

  it("gives a single place enough space to see the surrounding area", () => {
    const bounds = boundsForPlaces([{ lat: 37.56, lng: 126.97 }], fallback);
    expect(bounds.north - bounds.south).toBeGreaterThan(0.02);
    expect(bounds.east - bounds.west).toBeGreaterThan(0.02);
  });

  it("uses configured bounds for an empty or invalid place set", () => {
    expect(boundsForPlaces([], fallback)).toEqual(fallback);
    expect(boundsForPlaces([{ lat: NaN, lng: 126 }], fallback)).toEqual(fallback);
  });
});
