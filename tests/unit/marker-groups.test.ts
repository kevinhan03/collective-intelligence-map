import { expect, test } from "vitest";
import { groupMapMarkers } from "@/components/map/marker-groups";
import type { MapPlace } from "@/domain/types";
function sample(index: number): MapPlace {
  return {
    id: String(index),
    lat: (index * 47) % 700,
    lng: (index * 83) % 900,
  } as MapPlace;
}
const project = (place: MapPlace) => ({ x: place.lng, y: place.lat });
function original(places: MapPlace[], selected: string | null) {
  const groups: { places: MapPlace[]; x: number; y: number }[] = [];
  for (const place of places) {
    const point = project(place);
    const nearby = groups.find(
      (group) =>
        place.id !== selected &&
        group.places.every((member) => member.id !== selected) &&
        Math.hypot(group.x - point.x, group.y - point.y) < 36,
    );
    if (nearby) nearby.places.push(place);
    else groups.push({ places: [place], ...point });
  }
  return groups;
}
test("grid grouping preserves the original cluster membership and order for 500 places", () => {
  const places = Array.from({ length: 500 }, (_, index) => sample(index));
  for (const selected of [null, "10", "250"])
    expect(groupMapMarkers(places, selected, project)).toEqual(
      original(places, selected),
    );
});
test("selected pins remain separate and negative cell boundaries work", () => {
  const places = [
    sample(0),
    { ...sample(1), lng: -1, lat: -1 },
    { ...sample(2), lng: -2, lat: -2 },
  ];
  expect(
    groupMapMarkers(places, "0", project).map((group) =>
      group.places.map((p) => p.id),
    ),
  ).toEqual([["0"], ["1", "2"]]);
  expect(groupMapMarkers([], null, project)).toEqual([]);
});
