import pg from "pg";
import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
const url =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.USER}@127.0.0.1:55432/cim_test`;
if (!new URL(url).pathname.endsWith("_test"))
  throw new Error("Use an isolated *_test database only");
const c = new pg.Client({ connectionString: url });
await c.connect();
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  await c.query("begin");
  const previous = await fs.readFile(
    "supabase/migrations/20260916143000_use_indexed_overture_prefix_search.sql",
    "utf8",
  );
  const oldFunction = previous
    .slice(
      previous.indexOf("create or replace function"),
      previous.indexOf("grant execute"),
    )
    .replace(
      "public.search_overture_places",
      "public.benchmark_legacy_proposal_search",
    );
  await c.query(oldFunction);
  const map = "75757575-7575-4575-8575-757575757575";
  await c.query(
    `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status)
   values($1,'search-benchmark','Benchmark','test','test','JP','Tokyo','{"west":139,"east":140,"south":35,"north":36}','published')`,
    [map],
  );
  await c.query(`insert into public.our_search_places(source,source_id,primary_name,alternate_names,country_code,latitude,longitude,search_text,release)
   select 'overture','benchmark-'||lpad(i::text,6,'0'),
     case when i%100=0 then 'ビンテージ Store '||i when i%100=1 then 'ヴィンテージ Shop '||i else 'Inventory Shop '||i end,
     case when i%500=0 then ARRAY['Vintage Shop '||i,'別名 '||i] else '{}'::text[] end,
     case when i%10=0 then 'FR' else 'JP' end,35.5,139.5,
     case when i%100=0 then 'ビンテージ Store '||i||' Vintage Shop '||i||' 別名 '||i when i%100=1 then 'ヴィンテージ Shop '||i else 'Inventory Shop '||i end,'test'
   from generate_series(1,20000)i`);
  await c.query("analyze public.our_search_places");
  const results = [];
  for (const query of ["Inventory", "ヴィ", "ビンテージ", "Vintage"]) {
    const times = { legacy: [], optimized: [] };
    for (let iteration = 0; iteration < 7; iteration++)
      for (const [label, fn] of [
        ["legacy", "benchmark_legacy_proposal_search"],
        ["optimized", "search_overture_places"],
      ]) {
        const start = performance.now();
        const r = await c.query(`select public.${fn}($1,$2) result`, [
          query,
          map,
        ]);
        if (iteration) times[label].push(performance.now() - start);
        if (!Array.isArray(r.rows[0].result))
          throw new Error("Invalid search result");
      }
    results.push({
      sample: query,
      legacyMedianMs: +median(times.legacy).toFixed(2),
      optimizedMedianMs: +median(times.optimized).toFixed(2),
      legacyMaxMs: +Math.max(...times.legacy).toFixed(2),
      optimizedMaxMs: +Math.max(...times.optimized).toFixed(2),
    });
  }
  const plan = await c.query(`explain (analyze,buffers,format json)
    select source_id from public.our_search_places
    where source='overture' and country_code='JP'
    and location operator(extensions.&&) public.proposal_region_geometry('{"west":139,"east":140,"south":35,"north":36}')
    and (search_text ilike 'ヴィ%' or search_text ilike '% ヴィ%')
    order by source_id limit 10`);
  const report = {
    fixture:
      "20,000 synthetic POIs, isolated local PostgreSQL; 6 warm runs per sample; not production latency",
    results,
    prefixPlan: plan.rows[0]["QUERY PLAN"],
  };
  await fs.mkdir("artifacts/proposal-search", { recursive: true });
  await fs.writeFile(
    "artifacts/proposal-search/benchmark.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ fixture: report.fixture, results }, null, 2));
} finally {
  await c.query("rollback");
  await c.end();
}
