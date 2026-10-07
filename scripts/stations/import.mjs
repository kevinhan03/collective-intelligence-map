import fs from "node:fs/promises";
import path from "node:path";
import { regions, normalizeStations } from "./normalize.mjs";

const endpoints = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const output = path.resolve(
  args.find((arg) => arg.startsWith("--output="))?.slice(9) ??
    "supabase/manual/rail-stations",
);
const selected = args.filter((arg) => Object.hasOwn(regions, arg));
const snapshots = [];

// Fetch and validate ALL snapshots before writing files or changing any database.
for (const region of selected.length ? selected : Object.keys(regions)) {
  const query = `[out:json][timeout:25];nwr[railway~"^(station|halt)$"](${regions[region].bounds.join(",")});out center tags;`;
  let stations;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(
        `${endpoint}?${new URLSearchParams({ data: query })}`,
        {
          signal: AbortSignal.timeout(35000),
          headers: {
            "User-Agent":
              "TingMapStationImport/1.0 (+https://github.com/kevinhan03/collective-intelligence-map; Seoul/Tokyo railway dataset)",
          },
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json.remark || !Array.isArray(json.elements))
        throw new Error("Incomplete Overpass response");
      stations = normalizeStations(json.elements, region);
      if (stations.length < 20)
        throw new Error(
          "Snapshot is unexpectedly small; keeping existing data",
        );
      break;
    } catch (error) {
      console.warn(`${region}: ${error.message}; trying next source`);
    }
  }
  if (!stations)
    throw new Error(`Could not collect ${region}; no existing data changed`);
  snapshots.push({ region, stations });
  console.log(`${region}: ${stations.length} subway/train stations`);
}

await fs.mkdir(output, { recursive: true });
const quote = (value) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const sql =
  `-- Generated from OpenStreetMap via Overpass. © OpenStreetMap contributors, ODbL 1.0.\n-- https://www.openstreetmap.org/copyright\n-- Generated ${new Date().toISOString()}. Re-run this file safely to replace region snapshots.\nbegin;\n` +
  snapshots
    .map(
      ({ region, stations }) =>
        `select public.replace_rail_station_region('${region}',${quote(stations)});`,
    )
    .join("\n") +
  "\ncommit;\n";
await fs.writeFile(path.join(output, "02-station-data.sql"), sql);
await fs.writeFile(
  path.join(output, "station-data.json"),
  JSON.stringify(
    {
      source: "OpenStreetMap",
      license: "ODbL-1.0",
      collected_at: new Date().toISOString(),
      snapshots,
    },
    null,
    2,
  ) + "\n",
);
if (apply) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
    throw new Error("Server Supabase credentials required for --apply");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  for (const { region, stations } of snapshots) {
    const { error } = await client.rpc("replace_rail_station_region", {
      r: region,
      stations,
    });
    if (error) throw new Error(`Could not replace ${region}: ${error.code}`);
  }
  console.log(
    "Applied station snapshots. Region revisions invalidate the app station cache.",
  );
}
console.log(
  `SQL Editor data file: ${path.join(output, "02-station-data.sql")}`,
);
