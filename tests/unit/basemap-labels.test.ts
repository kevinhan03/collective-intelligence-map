import { afterEach, expect, it, vi } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type {
  StyleSpecification,
  SourceSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function setup(zoom = 12, domestic = true) {
  const style: StyleSpecification = {
    version: 8,
    glyphs: "https://example.com/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      { id: "Background", type: "background" },
      {
        id: "Original labels",
        type: "symbol",
        source: "base",
        "source-layer": "place",
        layout: { "text-font": ["Noto Sans Regular"] },
      },
    ],
  };
  const listeners = new Set<() => void>();
  const map = {
    getStyle: () => style,
    setLayoutProperty: vi.fn(),
    getLayer: vi.fn((id: string) =>
      style.layers.find((layer) => layer.id === id),
    ),
    addLayer: vi.fn((layer: SymbolLayerSpecification) => {
      style.layers.push(layer);
    }),
    getSource: vi.fn((id: string) => style.sources[id]),
    addSource: vi.fn((id: string, source: SourceSpecification) => {
      style.sources[id] = source;
    }),
    getZoom: vi.fn(() => zoom),
    getBounds: vi.fn(() => ({
      getWest: () => (domestic ? 126 : -74),
      getEast: () => (domestic ? 128 : -73),
      getSouth: () => 37,
      getNorth: () => 38,
    })),
    on: vi.fn((_name: string, handler: () => void) => {
      listeners.add(handler);
    }),
    off: vi.fn((_name: string, handler: () => void) => {
      listeners.delete(handler);
    }),
  };
  return { map, style, move: () => listeners.forEach((handler) => handler()) };
}

const data = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "한남동", code: "1117068500" },
      geometry: { type: "Point", coordinates: [127, 37.5] },
    },
  ],
};
const flush = () =>
  vi
    .waitFor(() => expect(true).toBe(true))
    .then(() => new Promise((resolve) => setTimeout(resolve, 0)));

it("lazily loads an independent, collision-aware source at zoom 12 and caches it across maps", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => data });
  vi.stubGlobal("fetch", fetcher);
  const { configureBasemapLabels, NEIGHBORHOOD_SOURCE_ID } =
    await import("@/components/map/basemap-labels");
  const { map, style, move } = setup(11);
  configureBasemapLabels(map);
  expect(fetcher).not.toHaveBeenCalled();
  expect(map.setLayoutProperty).toHaveBeenCalledWith(
    "Original labels",
    "visibility",
    "none",
  );
  expect(map.setLayoutProperty).not.toHaveBeenCalledWith(
    "Background",
    expect.anything(),
    expect.anything(),
  );
  map.getZoom.mockReturnValue(12);
  move();
  move();
  await vi.waitFor(() => expect(map.addLayer).toHaveBeenCalledTimes(1));
  const layer = map.addLayer.mock.calls[0][0];
  expect(layer).toMatchObject({
    source: NEIGHBORHOOD_SOURCE_ID,
    minzoom: 12,
    layout: { "text-allow-overlap": false, "text-ignore-placement": false },
  });
  expect(layer["source-layer"]).toBeUndefined();
  expect(map.addSource.mock.calls[0][1]).toMatchObject({
    type: "geojson",
    data,
    attribution: expect.stringContaining("CC BY 4.0"),
  });
  expect(validateStyleMin({ ...style, layers: [layer] })).toEqual([]);
  move();
  configureBasemapLabels(map);
  const second = setup();
  configureBasemapLabels(second.map);
  await vi.waitFor(() => expect(second.map.addLayer).toHaveBeenCalledTimes(1));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(map.addLayer).toHaveBeenCalledTimes(1);
});

it("does not download when viewing overseas", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const { configureBasemapLabels } =
    await import("@/components/map/basemap-labels");
  configureBasemapLabels(setup(14, false).map);
  expect(fetcher).not.toHaveBeenCalled();
});

it("isolates download failures and avoids repeated retries on pan", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  vi.stubGlobal("fetch", fetcher);
  const { configureBasemapLabels } =
    await import("@/components/map/basemap-labels");
  const { map, move } = setup();
  configureBasemapLabels(map);
  await flush();
  move();
  move();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(map.addSource).not.toHaveBeenCalled();
  expect(map.addLayer).not.toHaveBeenCalled();
});

it("does not mutate a removed map when its download finishes", async () => {
  let finish!: (response: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const { configureBasemapLabels } =
    await import("@/components/map/basemap-labels");
  const { map } = setup();
  const dispose = configureBasemapLabels(map);
  dispose();
  finish({ ok: true, json: async () => data });
  await flush();
  expect(map.off).toHaveBeenCalledWith("moveend", expect.any(Function));
  expect(map.addSource).not.toHaveBeenCalled();
});
