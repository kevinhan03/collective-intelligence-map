import pg from "pg";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
const url =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.USER}@127.0.0.1:55432/cim_perf_test`;
if (!new URL(url).pathname.endsWith("_test"))
  throw new Error("Use an isolated *_test database only.");
const c = new pg.Client({ connectionString: url });
await c.connect();
const signature =
  "public.map_places_in_bounds(uuid,double precision,double precision,double precision,double precision)";
const before = await fs.readFile(
  "docs/sql/rollback-map-place-reads.sql",
  "utf8",
);
const after = await fs.readFile(
  "supabase/migrations/20261105051934_optimize_map_place_reads.sql",
  "utf8",
);
const artifact = "artifacts/performance/place-loading";
await fs.mkdir(artifact, { recursive: true });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const results = [];
await c.query("begin");
try {
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await c.query(
    "insert into auth.users(id) values($1) on conflict do nothing",
    [owner],
  );
  await c.query(`insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status)
 values('f0000000-0000-4000-8000-000000000001','perf-fixture','Perf fixture','','','KR','Seoul','{"west":-180,"south":-80,"east":180,"north":80}','published')`);
  const map = "f0000000-0000-4000-8000-000000000001";
  await c.query(
    `insert into public.places(id,name,address,location,country,city,status,created_by)
 select md5('perf-place-'||i)::uuid,'Performance fixture '||i,'Seoul',extensions.st_setsrid(extensions.st_makepoint(case when i=1 then 170 when i=2 then -170 when i=3 then 180 else 127 end,37),4326),'KR','Seoul','active',$1 from generate_series(1,502) i`,
    [owner],
  );
  await c.query(
    `insert into public.map_places(id,map_id,place_id,added_by,rationale,status)
 select md5('perf-mp-'||i)::uuid,$1,md5('perf-place-'||i)::uuid,$2,'A sufficiently detailed fixture recommendation','approved' from generate_series(1,502) i`,
    [map, owner],
  );
  await c.query(
    `insert into public.map_place_votes(map_place_id,user_id,value,updated_at) select id,$1,1,'2026-10-01T00:00:00Z' from public.map_places where map_id=$2`,
    [owner, map],
  );
  await c.query(
    `insert into public.anonymous_map_place_votes(map_place_id,token_hash,value,updated_at) select id,repeat('a',64),-1,'2026-10-02T00:00:00Z' from public.map_places where map_id=$1`,
    [map],
  );
  await c.query(
    `insert into public.saves(user_id,map_place_id) select $1,id from public.map_places where map_id=$2`,
    [owner, map],
  );
  const read = async (args) => {
    await c.query("set local role anon");
    try {
      return (
        await c.query(
          "select public.map_places_in_bounds($1,$2,$3,$4,$5) result",
          args,
        )
      ).rows[0].result;
    } finally {
      await c.query("reset role");
    }
  };
  const cases = [
    [map, -180, -80, 180, 80],
    [map, 170, 36, -170, 38],
    [map, 127, 37, 128, 38],
    [map, 0, 0, 1, 1],
    [map, 0, 38, 1, 37],
    ["00000000-0000-4000-8000-000000000000", 0, 0, 1, 1],
  ];
  await c.query(before);
  const expected = [];
  for (let i = 0; i < cases.length; i++) expected[i] = await read(cases[i]);
  await c.query(after);
  for (let i = 0; i < cases.length; i++)
    assert.deepEqual(await read(cases[i]), expected[i]);
  assert.equal(expected[0].length, 501);
  assert.equal(expected[1].length, 3);
  assert.equal(expected[0][0].positive, 1);
  assert.equal(expected[0][0].negative, 1);
  assert.equal(expected[0][0].saved_count, 1);
  for (const change of [
    "update public.theme_maps set status='draft' where id='" + map + "'",
    "update public.places set status='archived' where id in (select place_id from public.map_places where map_id='" +
      map +
      "')",
  ]) {
    await c.query("savepoint visibility");
    await c.query(change);
    await c.query(before);
    const oldResult = await read(cases[0]);
    await c.query(after);
    assert.deepEqual(await read(cases[0]), oldResult);
    assert.equal(oldResult.length, 0);
    await c.query("rollback to savepoint visibility");
  }
  for (const count of [74, 500]) {
    await c.query(
      `update public.map_places set status=case when id in (select id from public.map_places where map_id=$1 order by id limit $2) then 'approved' else 'pending' end where map_id=$1`,
      [map, count],
    );
    const samples = { before: [], after: [] };
    const server = { before: [], after: [] };
    for (let round = -2; round < 10; round++)
      for (const mode of round % 2
        ? ["after", "before"]
        : ["before", "after"]) {
        await c.query(mode === "before" ? before : after);
        await c.query("set local role anon");
        const start = performance.now();
        const result = await c.query(
          "select public.map_places_in_bounds($1,-180,-80,180,80) result",
          [map],
        );
        const elapsed = performance.now() - start;
        assert.equal(result.rows[0].result.length, count);
        const explain = (
          await c.query(
            "explain (analyze,buffers,verbose,format json) select public.map_places_in_bounds($1,-180,-80,180,80)",
            [map],
          )
        ).rows[0]["QUERY PLAN"];
        await c.query("reset role");
        if (round >= 0) {
          samples[mode].push(elapsed);
          server[mode].push(explain[0]["Execution Time"]);
        }
        if (round === 9) {
          await fs.writeFile(
            `${artifact}/${count}-${mode}-explain.json`,
            JSON.stringify(explain, null, 2),
          );
          const def = (
            await c.query(
              "select prosrc from pg_proc where oid=$1::regprocedure",
              [signature],
            )
          ).rows[0].prosrc;
          await c.query("set local role anon");
          const body = (
            await c.query(
              `explain (analyze,buffers,verbose,format json) ${def.replaceAll(/\bm\b/g, `'${map}'::uuid`).replaceAll(/\bw\b/g, "-180::float8").replaceAll(/\bs\b/g, "-80::float8").replaceAll(/\be\b/g, "180::float8").replaceAll(/\bn\b/g, "80::float8")}`,
            )
          ).rows[0]["QUERY PLAN"];
          await c.query("reset role");
          await fs.writeFile(
            `${artifact}/${count}-${mode}-body-explain.json`,
            JSON.stringify(body, null, 2),
          );
        }
      }
    const improvement = 1 - median(server.after) / median(server.before);
    results.push({
      count,
      clientMs: samples,
      serverMs: server,
      medianBefore: median(server.before),
      medianAfter: median(server.after),
      improvement,
    });
    assert.ok(
      improvement >= 0.2,
      `Expected >=20% SQL improvement for ${count}; got ${improvement}`,
    );
  }
  await fs.writeFile(
    `${artifact}/sql-results.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify(
      results.map(({ count, medianBefore, medianAfter, improvement }) => ({
        count,
        medianBefore,
        medianAfter,
        improvement,
      })),
      null,
      2,
    ),
  );
  console.log(
    "PASS: bounds, dateline, ordering, 501 limit, counts, empty and invalid bounds; 10 alternating samples per variant",
  );
} finally {
  await c.query("rollback");
  await c.end();
}
