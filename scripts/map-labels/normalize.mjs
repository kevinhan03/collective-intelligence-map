import polylabel from "polylabel";

function ringArea(ring) {
  // Translate to the first vertex to avoid cancellation at WGS84 magnitudes.
  const [x, y] = ring[0];
  let area = 0;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1],
      b = ring[i];
    area += (a[0] - x) * (b[1] - y) - (b[0] - x) * (a[1] - y);
  }
  return Math.abs(area / 2);
}

function polygonArea(polygon) {
  return (
    ringArea(polygon[0]) -
    polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0)
  );
}

export function normalizeDongLabels(collection) {
  const codes = new Set();
  const features = [];
  for (const feature of collection.features) {
    const name = feature.properties.adm_nm.trim().split(/\s+/).at(-1);
    if (!name.endsWith("동")) continue;
    const code = String(feature.properties.adm_cd2);
    if (!/^\d{10}$/.test(code) || codes.has(code))
      throw new Error(`Invalid/duplicate dong code: ${code}`);
    codes.add(code);
    const geometry = feature.geometry;
    const polygons =
      geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : geometry.type === "Polygon"
          ? [geometry.coordinates]
          : [];
    const largest = polygons.reduce(
      (best, polygon) =>
        !best || polygonArea(polygon) > polygonArea(best) ? polygon : best,
      null,
    );
    if (!largest) throw new Error(`Missing boundary: ${code}`);
    const point = polylabel(largest, 0.000001);
    if (!(point.distance > 0))
      throw new Error(`No interior label point: ${code}`);
    features.push({
      type: "Feature",
      properties: { name, code },
      geometry: {
        type: "Point",
        coordinates: point.slice(0, 2).map((value) => Number(value.toFixed(7))),
      },
    });
  }
  features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));
  return { type: "FeatureCollection", features };
}
