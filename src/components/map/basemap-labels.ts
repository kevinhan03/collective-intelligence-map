import type { FeatureCollection, Point } from "geojson";
import type {
  Map,
  SourceSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

export const NEIGHBORHOOD_LABEL_ID = "ting-neighborhood-labels";
export const NEIGHBORHOOD_SOURCE_ID = "ting-neighborhoods";
export const CITY_LABEL_ID = "ting-city-labels";
export const CITY_SOURCE_ID = "ting-cities";
export const NEIGHBORHOOD_MIN_ZOOM = 12;
export const NEIGHBORHOOD_DATA_URL =
  "/map-data/korea-dong-labels.20260701.geojson";

type DongLabels = FeatureCollection<Point, { name: string; code: string }>;
// A small independent source keeps these orientation labels available even
// when the basemap omits lower-ranked cities from its low-zoom vector tiles.
const cityLabels: FeatureCollection<Point, { name: string }> = {
  type: "FeatureCollection",
  features: [
    { name: "서울", coordinates: [126.978, 37.5665] },
    { name: "부산", coordinates: [129.0756, 35.1796] },
    { name: "인천", coordinates: [126.7052, 37.4563] },
    { name: "대구", coordinates: [128.6014, 35.8714] },
    { name: "대전", coordinates: [127.3845, 36.3504] },
    { name: "광주", coordinates: [126.8526, 35.1595] },
    { name: "울산", coordinates: [129.3114, 35.5395] },
  ].map(({ name, coordinates }) => ({
    type: "Feature",
    properties: { name },
    geometry: { type: "Point", coordinates },
  })),
};
let dataPromise: Promise<DongLabels> | undefined;

function loadLabels() {
  // Share a single download across map instances, including React remounts.
  dataPromise ??= fetch(NEIGHBORHOOD_DATA_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Dong labels: ${response.status}`);
      const data = (await response.json()) as DongLabels;
      if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
        throw new Error("Invalid dong label data");
      }
      return data;
    })
    .catch((error: unknown) => {
      dataPromise = undefined;
      throw error;
    });
  return dataPromise;
}

type LabelMap = Pick<Map, "getStyle" | "setLayoutProperty" | "getZoom"> & {
  addLayer(layer: SymbolLayerSpecification): unknown;
  addSource(id: string, source: SourceSpecification): unknown;
  getLayer(id: string): unknown;
  getSource(id: string): unknown;
  getBounds(): Pick<
    ReturnType<Map["getBounds"]>,
    "getWest" | "getEast" | "getSouth" | "getNorth"
  >;
  on(event: "moveend", handler: () => void): unknown;
  off(event: "moveend", handler: () => void): unknown;
};

export function configureBasemapLabels(map: LabelMap) {
  const layers = map.getStyle().layers ?? [];
  const placeLayer = layers.find(
    (layer): layer is SymbolLayerSpecification =>
      layer.type === "symbol" &&
      ["place", "place_label"].includes(layer["source-layer"] ?? ""),
  );
  for (const layer of layers) {
    if (
      layer.type === "symbol" &&
      ![NEIGHBORHOOD_LABEL_ID, CITY_LABEL_ID].includes(layer.id)
    ) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
  // A background-only/custom style may have no glyph endpoint at all.
  if (!map.getStyle().glyphs) return () => {};

  if (!map.getSource(CITY_SOURCE_ID)) {
    map.addSource(CITY_SOURCE_ID, { type: "geojson", data: cityLabels });
  }
  if (!map.getLayer(CITY_LABEL_ID)) {
    map.addLayer({
      id: CITY_LABEL_ID,
      type: "symbol",
      source: CITY_SOURCE_ID,
      minzoom: 4,
      maxzoom: NEIGHBORHOOD_MIN_ZOOM,
      layout: {
        "text-field": ["get", "name"],
        "text-font": placeLayer?.layout?.["text-font"] ?? ["Noto Sans Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          12,
          8,
          14,
          11,
          16,
        ],
        "text-variable-anchor": ["bottom", "top", "left", "right"],
        // The capital's dense place pins extend beyond its center point.
        "text-radial-offset": ["match", ["get", "name"], "서울", 2.4, 1.2],
        "text-padding": 4,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
      },
      paint: {
        "text-color": "#4e5955",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
      },
    });
  }

  let disposed = false;
  let attempted = false;
  const update = () => {
    if (disposed || attempted || map.getZoom() < NEIGHBORHOOD_MIN_ZOOM) return;
    const bounds = map.getBounds();
    // Fetch only when the viewport intersects Korea, including offshore islands.
    if (
      bounds.getEast() < 124 ||
      bounds.getWest() > 132 ||
      bounds.getNorth() < 33 ||
      bounds.getSouth() > 39
    )
      return;
    attempted = true;
    void loadLabels()
      .then((data) => {
        if (disposed || map.getLayer(NEIGHBORHOOD_LABEL_ID)) return;
        if (!map.getSource(NEIGHBORHOOD_SOURCE_ID)) {
          map.addSource(NEIGHBORHOOD_SOURCE_ID, {
            type: "geojson",
            data,
            attribution:
              '동 경계: <a href="https://sgis.kostat.go.kr">SGIS</a> (공공누리 제1유형) · 가공: <a href="https://github.com/vuski/admdongkor">vuski/admdongkor</a>, 팅맵 · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
          });
        }
        map.addLayer({
          id: NEIGHBORHOOD_LABEL_ID,
          type: "symbol",
          source: NEIGHBORHOOD_SOURCE_ID,
          minzoom: NEIGHBORHOOD_MIN_ZOOM,
          layout: {
            "text-field": ["get", "name"],
            "text-font": placeLayer?.layout?.["text-font"] ?? [
              "Noto Sans Regular",
            ],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              12,
              14,
              13,
              17,
              16,
            ],
            "text-transform": "none",
            "text-letter-spacing": 0.02,
            "text-padding": 12,
            "text-allow-overlap": false,
            "text-ignore-placement": false,
          },
          paint: {
            "text-color": "#6b7370",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      })
      .catch(() => {
        // This optional overlay must never interrupt the map or contributed pins.
        // A later map mount can retry; panning a failed map does not spam requests.
      });
  };
  map.on("moveend", update);
  update();
  return () => {
    disposed = true;
    map.off("moveend", update);
  };
}
