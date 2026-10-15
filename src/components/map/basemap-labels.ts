import type { FeatureCollection, Point } from "geojson";
import type {
  Map,
  SourceSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

export const NEIGHBORHOOD_LABEL_ID = "ting-neighborhood-labels";
export const NEIGHBORHOOD_SOURCE_ID = "ting-neighborhoods";
export const NEIGHBORHOOD_MIN_ZOOM = 12;
export const NEIGHBORHOOD_DATA_URL =
  "/map-data/korea-dong-labels.20260701.geojson";

type DongLabels = FeatureCollection<Point, { name: string; code: string }>;
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
    if (layer.type === "symbol" && layer.id !== NEIGHBORHOOD_LABEL_ID) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
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
