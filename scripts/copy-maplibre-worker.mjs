import fs from "node:fs/promises";

// maplibre-gl resolves its tile-parsing worker at runtime via
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Bundlers copy that
// file as an opaque static asset without rewriting the *relative* import
// inside it (`./maplibre-gl-shared.mjs`), so the worker 404s on its own
// first import in both dev and production, and vector tiles silently never
// load (style/sprite still succeed since they don't need the worker).
// Serving both files, unmodified and under their original names, from the
// same public/ directory lets that relative import resolve on its own.
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
const outDir = new URL("../public/maplibre-gl/", import.meta.url);
await fs.mkdir(outDir, { recursive: true });
for (const file of files) {
  await fs.copyFile(
    new URL(`../node_modules/maplibre-gl/dist/${file}`, import.meta.url),
    new URL(file, outDir),
  );
}
console.log("Copied maplibre-gl worker assets to public/maplibre-gl/");
