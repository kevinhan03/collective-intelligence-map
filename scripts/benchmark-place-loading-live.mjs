// Read-only: compare both SELECT bodies without replacing any hosted function.
import pg from "pg";
import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.OVERTURE_DATABASE_URL)
  throw new Error("Load the project environment first");
const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
  ".",
)[0];
const url = new URL(process.env.OVERTURE_DATABASE_URL);
if (!decodeURIComponent(url.username).endsWith("." + project))
  throw new Error("Database and API project must match");
const c = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
await c.connect();
const dir = "artifacts/performance/place-loading/live";
await fs.mkdir(dir, { recursive: true });
const migration = await fs.readFile(
  "supabase/migrations/20261105051934_optimize_map_place_reads.sql",
  "utf8",
);
const after = migration.split("$$")[1];
const baseline = (
  await fs.readFile("docs/sql/rollback-map-place-reads.sql", "utf8")
).split("$function$")[1];
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
try {
  await c.query("begin read only");
  await c.query("set local statement_timeout='15s'");
  const {
    rows: [original],
  } = await c.query(
    "select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='public.map_places_in_bounds(uuid,double precision,double precision,double precision,double precision)'::regprocedure",
  );
  await fs.writeFile(
    `${dir}/deployed-function.sql`,
    original.definition + ";\n",
  );
  const {
    rows: [map],
  } = await c.query(
    "select id,bounds from public.theme_maps where slug='korea-fashion-store' and status='published'",
  );
  if (!map) throw new Error("Expected public map is missing");
  const args = [
    map.id,
    map.bounds.west,
    map.bounds.south,
    map.bounds.east,
    map.bounds.north,
  ];
  const bodies = { before: baseline, after };
  const queries = Object.fromEntries(
    Object.entries(bodies).map(([key, body]) => [
      key,
      body
        .replaceAll(/\bm\b/g, "$1::uuid")
        .replaceAll(/\bw\b/g, "$2::float8")
        .replaceAll(/\bs\b/g, "$3::float8")
        .replaceAll(/\be\b/g, "$4::float8")
        .replaceAll(/\bn\b/g, "$5::float8"),
    ]),
  );
  await c.query("set local role anon");
  const old = (await c.query(queries.before, args)).rows[0];
  const next = (await c.query(queries.after, args)).rows[0];
  // Column names differ by expression, so compare the sole JSON value.
  if (
    JSON.stringify(Object.values(old)[0]) !==
    JSON.stringify(Object.values(next)[0])
  )
    throw new Error("Query output mismatch");
  const samples = { before: [], after: [] };
  const server = { before: [], after: [] };
  for (let round = -2; round < 10; round++)
    for (const mode of round % 2 ? ["after", "before"] : ["before", "after"]) {
      const start = performance.now();
      const plan = (
        await c.query(
          `explain(analyze,buffers,verbose,format json) ${queries[mode]}`,
          args,
        )
      ).rows[0]["QUERY PLAN"];
      if (round >= 0) {
        samples[mode].push(performance.now() - start);
        server[mode].push(plan[0]["Execution Time"]);
      }
      if (round === 9)
        await fs.writeFile(
          `${dir}/${mode}-explain.json`,
          JSON.stringify(plan, null, 2),
        );
    }
  const result = {
    places: Object.values(old)[0].length,
    clientIncludingExplainMs: samples,
    serverExecutionMs: server,
    medianBefore: median(server.before),
    medianAfter: median(server.after),
    improvement: 1 - median(server.after) / median(server.before),
  };
  await fs.writeFile(`${dir}/results.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      places: result.places,
      medianBefore: result.medianBefore,
      medianAfter: result.medianAfter,
      improvement: result.improvement,
    }),
  );
  if (result.improvement < 0.2)
    throw new Error(
      "Hosted SQL improvement is below 20%: investigate before rollout",
    );
} finally {
  await c.query("rollback");
  await c.end();
}
