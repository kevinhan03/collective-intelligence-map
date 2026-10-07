import { expect, it } from "vitest";
import { distanceMeters, directionsUrl, operationLabel } from "@/domain/visit";
import { sortPlaces } from "@/domain/relevance";
import { homeMapFirst } from "@/domain/map-order";
import { demoPlaces, demoMap } from "@/server/demo";

it("uses precise destinations and only station routes prescribe walking", () => {
  const destination = { lat: 37.5, lng: 127 };
  const url = new URL(directionsUrl(destination));
  expect(url.pathname).toBe("/maps/dir/");
  expect(url.searchParams.get("destination")).toBe("37.5,127");
  expect(url.searchParams.has("origin")).toBe(false);
  expect(url.searchParams.has("travelmode")).toBe(false);
  const walking = new URL(
    directionsUrl(destination, { lat: 37.51, lng: 127.01 }),
  );
  expect(walking.searchParams.get("origin")).toBe("37.51,127.01");
  expect(walking.searchParams.get("travelmode")).toBe("walking");
});
it("sorts loaded places by straight line distance without mutating them", () => {
  const places = [
    { ...demoPlaces[0], lat: 0, lng: 0.02 },
    { ...demoPlaces[1], lat: 0, lng: 0.01 },
  ];
  expect(distanceMeters({ lat: 0, lng: 0 }, places[1])).toBeCloseTo(1111.95, 0);
  expect(sortPlaces(places, "distance", { lat: 0, lng: 0 })[0]).toBe(places[1]);
  expect(places[0].lng).toBe(0.02);
});
it("separates visits from operations and prioritizes unconfirmed reports", () => {
  const summary = {
    visited: 3,
    open: 0,
    needs_review: 0,
    last_checked_at: "2026-10-07",
  };
  expect(operationLabel(summary)).toBe("최근 운영 확인 없음");
  expect(
    operationLabel({
      ...summary,
      open: 1,
      last_open_checked_at: "2026-10-06T12:00:00Z",
    }),
  ).toContain("최근 운영 확인 ·");
  expect(operationLabel({ ...summary, open: 1, needs_review: 1 })).toBe(
    "폐업·이전 확인 제보 있음",
  );
});
it("puts nonempty maps ahead of empty maps with more followers", () => {
  const empty = { ...demoMap, place_count: 0, follower_count: 10000 };
  const active = { ...demoMap, place_count: 1, follower_count: 0 };
  expect([empty, active].sort(homeMapFirst)[0]).toBe(active);
});
