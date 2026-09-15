import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { normalizePlace } from "./normalize.mjs";
// Node scripts do not receive Next.js's automatic `.env.local` loading.
// Load it for local operators while preserving explicitly supplied CI values.
if (!process.env.OVERTURE_DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // The explicit validation below provides the actionable error.
  }
}
// Explicit pinned release and region prevent accidental global ingestion.
const [regionKey, release, fixture] = process.argv.slice(2);
const regions = JSON.parse(
  await fs.readFile(new URL("./regions.json", import.meta.url), "utf8"),
);
const region = regions[regionKey];
if (!region || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release ?? ""))
  throw new Error(
    "Usage: node scripts/overture/ingest.mjs <region> <YYYY-MM-DD.N> [extracted.ndjson]",
  );
if (!process.env.OVERTURE_DATABASE_URL)
  throw new Error(
    "OVERTURE_DATABASE_URL is required (server-side ingestion role)",
  );
// `readline` also breaks lines on U+2028/U+2029 (valid, unescaped inside a
// JSON string but not an NDJSON record separator), so real-world addresses
// containing those characters get split mid-record. Split on the literal
// LF byte only.
async function* readNdjsonLines(filePath) {
  let leftover = "";
  for await (const chunk of createReadStream(filePath, { encoding: "utf8" })) {
    const parts = (leftover + chunk).split("\n");
    leftover = parts.pop();
    for (const part of parts) yield part;
  }
  if (leftover) yield leftover;
}
const temporary = await fs.mkdtemp(path.join(tmpdir(), "overture-"));
const output = fixture ?? path.join(temporary, "places.ndjson");
const c = new pg.Client({
  connectionString: process.env.OVERTURE_DATABASE_URL,
});
try {
  if (!fixture) {
    const b = region.bounds;
    const sql = `INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';
      COPY (SELECT id, names, addresses, categories, operating_status, ST_X(geometry) longitude, ST_Y(geometry) latitude
      FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*', hive_partitioning=true)
      WHERE bbox.xmin BETWEEN ${b.west} AND ${b.east} AND bbox.ymin BETWEEN ${b.south} AND ${b.north})
      TO '${output.replaceAll("'", "''")}' (FORMAT JSON, ARRAY false);`;
    await new Promise((resolve, reject) => {
      const child = spawn("duckdb", ["-c", sql], { stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`DuckDB exited ${code}`)),
      );
    });
  }
  await c.connect();
  await c.query("begin");
  // Dense metros (e.g. New York) can exceed the role's default statement
  // timeout on the final bulk upsert; this only applies to this transaction.
  await c.query("set local statement_timeout = '15min'");
  await c.query("select pg_advisory_xact_lock(781235)");
  await c.query(
    "create temporary table incoming (like public.our_search_places including defaults including generated) on commit drop",
  );
  let count = 0;
  let batch = [];
  const keys = [
    "source",
    "source_id",
    "primary_name",
    "alternate_names",
    "country_code",
    "region",
    "locality",
    "address",
    "latitude",
    "longitude",
    "category",
    "search_text",
    "release",
  ];
  async function flushBatch() {
    if (!batch.length) return;
    const values = batch.flatMap((row) => keys.map((key) => row[key]));
    const placeholders = batch
      .map(
        (_, rowIndex) =>
          `(${keys
            .map((_, columnIndex) => `$${rowIndex * keys.length + columnIndex + 1}`)
            .join(",")})`,
      )
      .join(",");
    await c.query(
      `insert into incoming (${keys.join(",")}) values ${placeholders}`,
      values,
    );
    batch = [];
  }
  for await (const line of readNdjsonLines(output)) {
    if (!line.trim()) continue;
    const row = normalizePlace(JSON.parse(line), region, release);
    if (!row) continue;
    batch.push(row);
    if (batch.length === 500) await flushBatch();
    count++;
  }
  await flushBatch();
  if (!count)
    throw new Error("Empty extract; refusing to replace region inventory");
  // Region refresh is atomic; source IDs crossing overlapping regions remain unique.
  const b = region.bounds;
  await c.query(
    `delete from public.our_search_places where source='overture' and country_code=$1 and longitude between $2 and $3 and latitude between $4 and $5`,
    [region.country, b.west, b.east, b.south, b.north],
  );
  await c.query(`insert into public.our_search_places(source,source_id,primary_name,alternate_names,country_code,region,locality,address,latitude,longitude,category,search_text,release)
    select source,source_id,primary_name,alternate_names,country_code,region,locality,address,latitude,longitude,category,search_text,release from incoming
    on conflict(source,source_id) do update set primary_name=excluded.primary_name,alternate_names=excluded.alternate_names,country_code=excluded.country_code,region=excluded.region,locality=excluded.locality,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,category=excluded.category,search_text=excluded.search_text,release=excluded.release,imported_at=now()`);
  await c.query("commit");
  console.log(`Indexed ${count} places for ${regionKey}, release ${release}`);
} catch (error) {
  await c.query("rollback").catch(() => {});
  throw error;
} finally {
  await c.end();
  await fs.rm(temporary, { recursive: true, force: true });
}
