import { expect, test } from "vitest";
import {
  visibleMarkerLabels,
  type LabelRect,
} from "@/components/map/marker-labels";

const rect = (
  left: number,
  top: number,
  width = 80,
  height = 18,
): LabelRect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

test("compact labels can touch their own pin halo but still avoid other pins", () => {
  const ownPin = rect(0, 0, 32, 32);
  const label = {
    id: "a",
    selected: false,
    rect: rect(0, 31),
    pinRect: ownPin,
  };
  expect([...visibleMarkerLabels([label], [ownPin])]).toEqual(["a"]);
  expect([
    ...visibleMarkerLabels([label], [ownPin, rect(50, 31, 32, 32)]),
  ]).toEqual([]);
});

test("selected names win collisions regardless of input order", () => {
  const candidates = [
    { id: "a", selected: false, rect: rect(0, 0) },
    { id: "z", selected: true, rect: rect(20, 0) },
    { id: "c", selected: false, rect: rect(200, 0) },
  ];
  expect([...visibleMarkerLabels(candidates, [])]).toEqual(["z", "c"]);
  expect([...visibleMarkerLabels(candidates.toReversed(), [])]).toEqual([
    "z",
    "c",
  ]);
});

test("normal names avoid pins and other names, while selected names stay visible", () => {
  const candidates = [
    { id: "selected", selected: true, rect: rect(0, 0) },
    { id: "pin-overlap", selected: false, rect: rect(200, 0) },
    { id: "clear", selected: false, rect: rect(400, 0) },
  ];
  expect([
    ...visibleMarkerLabels(candidates, [
      rect(0, 0, 32, 32),
      rect(220, 0, 32, 32),
    ]),
  ]).toEqual(["selected", "clear"]);
});

test("halo spacing and negative grid boundaries are included in collision checks", () => {
  expect([
    ...visibleMarkerLabels(
      [
        { id: "a", selected: false, rect: rect(-70, -20, 60) },
        { id: "b", selected: false, rect: rect(-9, -20, 60) },
        { id: "c", selected: false, rect: rect(100, 100) },
      ],
      [],
    ),
  ]).toEqual(["a", "c"]);
});
