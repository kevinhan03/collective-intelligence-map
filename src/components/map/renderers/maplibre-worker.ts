import * as maplibregl from "maplibre-gl";

// maplibre-gl resolves its tile-parsing worker at runtime via
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Bundlers copy that
// file as an opaque static asset without rewriting the *relative* import
// inside it (`./maplibre-gl-shared.mjs`), so the worker 404s on its own
// first import and vector tiles silently never load (style/sprite still
// succeed since they don't need the worker). `public/maplibre-gl/` carries
// both files unmodified under their original names (see
// scripts/copy-maplibre-worker.mjs) so that relative import resolves on its
// own, with no bundler or blob-URL involved.
let didSet = false;

export function ensureMapLibreWorkerReady(): void {
  if (didSet) return;
  didSet = true;
  maplibregl.setWorkerUrl("/maplibre-gl/maplibre-gl-worker.mjs");
}
