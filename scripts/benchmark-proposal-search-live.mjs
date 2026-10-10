// Remote reads only. Copies external POIs into a dedicated local *_test DB.
import nextEnv from "@next/env";
import pg from "pg";
import fs from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const ref = "cujmxwlwijwomngchwoi";
const remoteUrl = process.env.SUPABASE_DB_URL;
if (!remoteUrl) throw new Error("Direct connection required");
const target = new URL(remoteUrl);
if (
  !target.hostname.includes(ref) &&
  !decodeURIComponent(target.username).includes(ref)
)
  throw new Error("Unexpected project");
const localUrl = `postgresql://${process.env.USER}@127.0.0.1:55432/cim_proposal_benchmark_test`;
const admin = new pg.Client({
  connectionString: `postgresql://${process.env.USER}@127.0.0.1:55432/postgres`,
});
await admin.connect();
if (
  !(
    await admin.query(
      "select 1 from pg_database where datname='cim_proposal_benchmark_test'",
    )
  ).rowCount
)
  await admin.query(
    "create database cim_proposal_benchmark_test template cim_test",
  );
await admin.end();
const local = new pg.Client({ connectionString: localUrl });
const remote = new pg.Client({
  connectionString: remoteUrl,
  ssl: { rejectUnauthorized: false },
  application_name: "proposal_readonly_benchmark",
});
await local.connect();
await remote.connect();
const columns =
  "source,source_id,primary_name,alternate_names,country_code,region,locality,address,latitude,longitude,category,search_text,release,imported_at";
try {
  await local.query("begin");
  const reuse = process.argv.includes("--reuse-local");
  if (!reuse) {
    await local.query("truncate public.our_search_places");
    // Only local test indexes: build once after the bulk copy instead of
    // maintaining them for every inserted row.
    await local.query(
      "drop index public.search_places_text; drop index public.search_places_location",
    );
  }
  await remote.query("begin read only");
  await remote.query("set local statement_timeout='20s'");
  const sizeBefore = (
    await remote.query("select pg_database_size(current_database()) bytes")
  ).rows[0].bytes;
  let copied = 0;
  if (reuse) {
    copied = Number(
      (await local.query("select count(*) n from public.our_search_places"))
        .rows[0].n,
    );
    const expected = Number(
      (await remote.query("select count(*) n from public.our_search_places"))
        .rows[0].n,
    );
    if (copied !== expected)
      throw new Error(
        "Existing local fixture count differs; rerun without --reuse-local",
      );
  } else {
    await remote.query(
      `declare inventory_copy no scroll cursor for select ${columns} from public.our_search_places order by source,source_id`,
    );
    for (;;) {
      const batch = await remote.query("fetch 5000 from inventory_copy");
      if (!batch.rowCount) break;
      await local.query(
        `insert into public.our_search_places(${columns}) select ${columns} from jsonb_populate_recordset(null::public.our_search_places,$1::jsonb)`,
        [JSON.stringify(batch.rows)],
      );
      copied += batch.rowCount;
      if (copied % 50000 === 0)
        console.log(`Read-only copy: ${copied} source records`);
    }
    await remote.query("close inventory_copy");
  }
  const maps = (
    await remote.query(
      "select id,country,city,bounds,title from public.theme_maps where status='published'",
    )
  ).rows;
  const sizeAfter = (
    await remote.query("select pg_database_size(current_database()) bytes")
  ).rows[0].bytes;
  await remote.query("rollback");
  if (!reuse) {
    await local.query(
      "create index search_places_text on public.our_search_places using gin(search_text extensions.gin_trgm_ops); create index search_places_location on public.our_search_places using gist(location)",
    );
    await local.query("analyze public.our_search_places");
  }
  await local.query("commit");
  // Keep the copied external-only fixture if a later measurement fails.
  await local.query("begin");
  const activation = await fs.readFile(
    "docs/sql/activate-proposal-search.sql",
    "utf8",
  );
  await local.query(
    activation.slice(
      activation.indexOf(
        "create or replace function public.search_overture_places",
      ),
      activation.indexOf(
        "create or replace function public.overture_place_details",
      ),
    ),
  );
  const previous = await fs.readFile(
    "supabase/migrations/20260916143000_use_indexed_overture_prefix_search.sql",
    "utf8",
  );
  await local.query(
    previous
      .slice(
        previous.indexOf("create or replace function"),
        previous.indexOf("grant execute"),
      )
      .replace(
        "public.search_overture_places",
        "public.benchmark_legacy_proposal_search",
      ),
  );
  const map = maps.find((m) => m.country === "JP");
  if (!map) throw new Error("No JP map");
  const ids = [
    "76767676-7676-4767-8767-767676767676",
    "79797979-7979-4797-8797-797979797979",
    "78787878-7878-4787-8787-787878787878",
  ];
  for (const [i, scope] of ["region", "country", "world"].entries())
    await local.query(
      `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status,search_scope) values($1,$2,'Benchmark','test','test',$3,$4,$5,'published',$6)`,
      [
        ids[i],
        `live-benchmark-${scope}`,
        scope === "world" ? null : map.country,
        map.city,
        map.bounds,
        scope,
      ],
    );
  const samples = [
    "ヴィ",
    "ビンテージ",
    "Vintage",
    "カフ",
    "zz-no-place-result",
  ];
  const results = [];
  await local.query("set local statement_timeout='15s'");
  for (const [i, scope] of ["region", "country", "world"].entries())
    for (const query of samples) {
      for (const [label, fn] of [
        ["legacy", "benchmark_legacy_proposal_search"],
        ["lightweight", "search_overture_places"],
      ]) {
        if (label === "legacy" && scope !== "region") continue;
        const timings = [];
        let count = 0;
        for (let run = 0; run < 4; run++) {
          const start = performance.now();
          const result = await local.query(
            `select public.${fn}($1,$2) result`,
            [query, ids[i]],
          );
          count = result.rows[0].result.length;
          if (run) timings.push(performance.now() - start);
        }
        results.push({
          scope,
          sample: query,
          variant: label,
          count,
          medianMs: +timings.sort((a, b) => a - b)[1].toFixed(2),
          maxMs: +Math.max(...timings).toFixed(2),
        });
      }
    }
  const plans = [];
  for (const query of [
    "ヴィ",
    "ビンテージ",
    "Vintage",
    "カフ",
    "zz-no-place-result",
  ]) {
    const pattern = query.toLowerCase() + "%";
    const plan = await local.query(
      `explain(analyze,buffers,format json) select source_id from public.our_search_places where source='overture' and country_code=$1 and location operator(extensions.&&) public.proposal_region_geometry($2) and (($2::jsonb->>'west')::float8 < ($2::jsonb->>'east')::float8 or extensions.st_covers(public.proposal_region_geometry($2),location)) and (search_text ilike $3 or search_text ilike '% '||$3) order by source_id limit 10`,
      [map.country, map.bounds, pattern],
    );
    plans.push({ sample: query, plan: plan.rows[0]["QUERY PLAN"] });
  }
  const report = {
    copied,
    remoteReadOnly: true,
    remoteSizeBefore: sizeBefore,
    remoteSizeAfter: sizeAfter,
    fixture:
      "Actual external inventory copied to isolated local DB; 3 warm runs; not production latency",
    reusedSnapshot: reuse,
    results,
    plans,
  };
  await fs.mkdir("artifacts/proposal-search", { recursive: true });
  await fs.writeFile(
    "artifacts/proposal-search/actual-inventory-benchmark.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({ copied, results, remoteReadOnly: true }, null, 2),
  );
} catch (e) {
  console.error(
    JSON.stringify({
      code: e.code ?? "benchmark",
      message: e.code ? "Benchmark query failed" : e.message,
    }),
  );
  process.exitCode = 1;
} finally {
  await remote.query("rollback").catch(() => {});
  await local.query("rollback").catch(() => {});
  await remote.end();
  await local.end();
}
