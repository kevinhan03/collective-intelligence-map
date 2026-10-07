export type Coordinate = { lat: number; lng: number };

export function distanceMeters(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10}m`
    : `${(meters / 1000).toFixed(1)}km`;
}

export function directionsUrl(destination: Coordinate, origin?: Coordinate) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  if (origin) {
    url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
    url.searchParams.set("travelmode", "walking");
  }
  return url.toString();
}

export type CheckSummary = {
  visited: number;
  open: number;
  needs_review: number;
  last_checked_at: string | null;
  last_open_checked_at?: string | null;
};

export function operationLabel(summary: CheckSummary) {
  if (summary.needs_review > 0) return "폐업·이전 확인 제보 있음";
  if (summary.open > 0 && summary.last_open_checked_at)
    return `최근 운영 확인 · ${new Date(summary.last_open_checked_at).toLocaleDateString("ko-KR")}`;
  return summary.open > 0 ? "최근 운영 확인 있음" : "최근 운영 확인 없음";
}
