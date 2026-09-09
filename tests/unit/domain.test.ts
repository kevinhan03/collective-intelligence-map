import { describe, it, expect } from "vitest";
import { wilson, inBounds, sortPlaces } from "@/domain/relevance";
import {
  boundsSchema,
  proposalSchema,
  commandSchema,
} from "@/domain/validation";
import { demoPlaces, demoMap } from "@/server/demo";
describe("theme relevance and geography", () => {
  it("does not rank one positive vote above substantial agreement", () => {
    expect(wilson(1, 0)).toBeLessThan(wilson(90, 10));
    expect(wilson(0, 0)).toBe(0);
  });
  it("supports antimeridian and boundary points", () => {
    const b = { west: 170, east: -170, south: -10, north: 10 };
    expect(inBounds(0, 179, b)).toBe(true);
    expect(inBounds(0, -179, b)).toBe(true);
    expect(inBounds(0, 0, b)).toBe(false);
    expect(inBounds(10, 170, b)).toBe(true);
  });
  it("rejects invalid bounds and external-like incomplete canonical data", () => {
    expect(
      boundsSchema.safeParse({ west: 0, east: 1, south: 2, north: 1 }).success,
    ).toBe(false);
    expect(
      proposalSchema.safeParse({
        mapId: demoMap.id,
        rationale: "추천 근거는 충분하지만 독립 출처는 없습니다.",
      }).success,
    ).toBe(false);
  });
  it("keeps topic scores separate and sorts deterministically", () => {
    const places = [
      { ...demoPlaces[0], positive: 1, negative: 0 },
      { ...demoPlaces[1], positive: 30, negative: 2 },
    ];
    expect(sortPlaces(places, "relevance")[0].id).toBe(places[1].id);
    expect(places[0].positive).toBe(1);
  });
  it("rejects arbitrary administrator actions and bad vote values", () => {
    expect(
      commandSchema.safeParse({ action: "promote_me", id: demoMap.id }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({ action: "vote", id: demoMap.id, value: 8 })
        .success,
    ).toBe(false);
  });
});
