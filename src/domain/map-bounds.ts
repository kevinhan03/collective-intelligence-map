import type { Bounds } from "./types";

type Point = { lat: number; lng: number };

export function boundsForPlaces(places: Point[], fallback: Bounds): Bounds {
  const valid = places.filter(
    (place) =>
      Number.isFinite(place.lat) &&
      Number.isFinite(place.lng) &&
      Math.abs(place.lat) <= 90 &&
      Math.abs(place.lng) <= 180,
  );
  if (!valid.length) return fallback;

  const latitudes = valid.map((place) => place.lat);
  const longitudes = valid.map((place) => place.lng);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  // The map search bar and bottom controls sit over the canvas. Leave enough
  // space for markers near the edges on a narrow screen.
  const latPadding = Math.max((north - south) * 0.25, 0.012);
  const lngPadding = Math.max((east - west) * 0.15, 0.012);

  return {
    south: Math.max(-90, south - latPadding),
    north: Math.min(90, north + latPadding),
    west: Math.max(-180, west - lngPadding),
    east: Math.min(180, east + lngPadding),
  };
}
