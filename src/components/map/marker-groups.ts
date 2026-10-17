import type { MapPlace } from "@/domain/types";
export type MarkerGroup = { places: MapPlace[]; x: number; y: number };
/** Match the existing first-nearby grouping, checking only adjacent grid cells. */
export function groupMapMarkers(
  places: MapPlace[],
  selected: string | null,
  project: (place: MapPlace) => { x: number; y: number },
): MarkerGroup[] {
  const groups: MarkerGroup[] = [];
  const cells = new Map<string, number[]>();
  for (const place of places) {
    const point = project(place);
    const x = Math.floor(point.x / 36),
      y = Math.floor(point.y / 36);
    let match: number | undefined;
    if (place.id !== selected) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          for (const index of cells.get(`${x + dx}:${y + dy}`) ?? []) {
            const group = groups[index];
            if (
              (match === undefined || index < match) &&
              Math.hypot(group.x - point.x, group.y - point.y) < 36
            )
              match = index;
          }
        }
    }
    if (match !== undefined) groups[match].places.push(place);
    else {
      const index = groups.push({ places: [place], ...point }) - 1;
      if (place.id !== selected) {
        const key = `${x}:${y}`;
        const bucket = cells.get(key) ?? [];
        bucket.push(index);
        cells.set(key, bucket);
      }
    }
  }
  return groups;
}
