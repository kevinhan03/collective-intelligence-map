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
export function controversy(positive: number, negative: number) {
  const total = positive + negative;
  if (!positive || !negative) return 0;
  return total * (Math.min(positive, negative) / Math.max(positive, negative));
}
export function isNew(place: MapPlace) {
  return Date.now() - new Date(place.created_at).getTime() < 1000 * 60 * 60 * 48;
}
export function isControversial(place: MapPlace) {
  const total = place.positive + place.negative;
  if (total < 5) return false;
  return Math.min(place.positive, place.negative) / Math.max(place.positive, place.negative) >= 0.5;
}
export function isVerified(place: MapPlace) {
  return (
    Boolean(place.last_verified_at) &&
    place.positive + place.negative >= 5 &&
    wilson(place.positive, place.negative) >= 0.7
  );
}
export function sortPlaces(places: MapPlace[], sort: Sort) {
  return [...places].sort((a, b) => {
    const score =
      sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : sort === "verified"
          ? (b.last_verified_at ?? "").localeCompare(a.last_verified_at ?? "")
          : sort === "controversial"
            ? controversy(b.positive, b.negative) - controversy(a.positive, a.negative)
            : sort === "popular"
              ? b.positive - a.positive
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
