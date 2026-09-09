import type { Bounds, MapPlace, Sort } from "./types";
export function wilson(positive: number, negative: number) {
  const n = positive + negative;
  if (!n) return 0;
  const p = positive / n,
    z = 1.96;
  return (
    (p +
      (z * z) / (2 * n) -
      z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) /
    (1 + (z * z) / n)
  );
}
export function sortPlaces(places: MapPlace[], sort: Sort) {
  return [...places].sort((a, b) => {
    const score =
      sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : sort === "verified"
          ? (b.last_verified_at ?? "").localeCompare(a.last_verified_at ?? "")
          : wilson(b.positive, b.negative) - wilson(a.positive, a.negative);
    return score || a.id.localeCompare(b.id);
  });
}
export function inBounds(lat: number, lng: number, b: Bounds) {
  return (
    lat >= b.south &&
    lat <= b.north &&
    (b.west <= b.east
      ? lng >= b.west && lng <= b.east
      : lng >= b.west || lng <= b.east)
  );
}
