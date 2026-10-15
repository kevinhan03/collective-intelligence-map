import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { normalizeDongLabels } from "./normalize.mjs";

const revision = "7360288277dfd12d74e54b959c59bdd66f852e3a";
const source = `https://raw.githubusercontent.com/vuski/admdongkor/${revision}/ver20260701/HangJeongDong_ver20260701.geojson`;
const response = await fetch(source);
if (!response.ok)
  throw new Error(`Boundary download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const original = JSON.parse(bytes.toString("utf8"));
const data = normalizeDongLabels(original);
const directory = new URL("../../public/map-data/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("korea-dong-labels.20260701.geojson", directory),
  JSON.stringify(data) + "\n",
);
await writeFile(
  new URL("korea-dong-labels.20260701.meta.json", directory),
  JSON.stringify(
    {
      referenceDate: "2026-07-01",
      source,
      revision,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      sourceFeatures: original.features.length,
      labelFeatures: data.features.length,
      processing:
        "Names ending 동 only; largest polygon by net ring area; polylabel 2.1.0 interior point, precision 0.000001 degrees; WGS84 coordinates rounded to 7 decimals.",
      license: "CC-BY-4.0",
      upstreamLicense: "KOGL Type 1",
      licenseUrl: `https://github.com/vuski/admdongkor/blob/${revision}/LICENSE-DATA`,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Generated ${data.features.length} dong labels from ${original.features.length} administrative areas.`,
);
