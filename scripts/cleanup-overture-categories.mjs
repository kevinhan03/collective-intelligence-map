import nextEnv from "@next/env";
import pg from "pg";
import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip, createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import excludedCategories from "./overture/excluded-categories.json" with { type: "json" };

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const apply = process.argv.includes("--apply");
const arg = (name) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const expected = Number(arg("expected-count"));
if (apply && (!Number.isInteger(expected) || expected < 1))
  throw new Error("--apply requires --expected-count=<preview count>");
const target = new URL(process.env.SUPABASE_DB_URL);
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
  ".",
)[0];
if (
  !target.hostname.includes(ref) &&
  !decodeURIComponent(target.username).includes(ref)
)
  throw new Error("Database does not match the app's Supabase project");
const pooler = arg("pooler-host");
if (pooler) {
  if (!pooler.endsWith(".pooler.supabase.com"))
    throw new Error("Unexpected pooler host");
  target.hostname = pooler;
  target.username = `postgres.${ref}`;
  target.port = "5432";
}
const c = new pg.Client({
  connectionString: target.toString(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  application_name: "overture_category_cleanup",
});
await c.connect();
try {
  await c.query(apply ? "begin" : "begin read only");
  await c.query(
    "set local statement_timeout='2min'; set local lock_timeout='5s'",
  );
  if (apply)
    await c.query(
      "lock table public.our_search_places in share row exclusive mode",
    );
  const where = "source='overture' and category=any($1::text[])";
  const counts = (
    await c.query(
      `select country_code,count(*)::int n from public.our_search_places where ${where} group by 1`,
      [excludedCategories],
    )
  ).rows;
  const count = counts.reduce((sum, r) => sum + r.n, 0);
  console.log(
    JSON.stringify({
      project: ref,
      apply,
      excludedCategoryCount: excludedCategories.length,
      count,
      countries: counts,
    }),
  );
  if (!apply) {
    await c.query("rollback");
  } else {
    if (count !== expected)
      throw new Error("Preview count changed; run a fresh preview");
    const dir = path.join(
      homedir(),
      ".local",
      "share",
      "collective-intelligence-map",
      "backups",
    );
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const backup = path.join(
      dir,
      `overture-excluded-${ref}-${Date.now()}.ndjson.gz`,
    );
    const rows = (
      await c.query(`select * from public.our_search_places where ${where}`, [
        excludedCategories,
      ])
    ).rows;
    await pipeline(
      Readable.from(
        (function* () {
          for (const r of rows) yield JSON.stringify(r) + "\n";
        })(),
      ),
      createGzip(),
      createWriteStream(backup, { flags: "wx", mode: 0o600 }),
    );
    let verified = 0;
    const lines = createInterface({
      input: createReadStream(backup).pipe(createGunzip()),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      const row = JSON.parse(line);
      if (
        row.source !== "overture" ||
        !excludedCategories.includes(row.category)
      )
        throw new Error("Invalid backup record");
      verified++;
    }
    if (verified !== count) throw new Error("Backup row count mismatch");
    const baseline = (
      await c.query(
        "select (select count(*) from public.places)::int places,(select count(*) from public.map_places)::int map_places,(select count(*) from public.our_search_places)::int search_places",
      )
    ).rows[0];
    const deleted = await c.query(
      `delete from public.our_search_places where ${where}`,
      [excludedCategories],
    );
    if (deleted.rowCount !== count) throw new Error("Deletion count mismatch");
    const after = (
      await c.query(
        "select (select count(*) from public.places)::int places,(select count(*) from public.map_places)::int map_places,(select count(*) from public.our_search_places)::int search_places",
      )
    ).rows[0];
    if (
      after.places !== baseline.places ||
      after.map_places !== baseline.map_places ||
      after.search_places !== baseline.search_places - count
    )
      throw new Error("Unexpected data change");
    const manifest = {
      project: ref,
      backup,
      excludedCategories,
      deleted: count,
      countries: counts,
      baseline,
      after,
      completedAt: new Date().toISOString(),
    };
    await fs.writeFile(backup + ".json", JSON.stringify(manifest, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    await c.query("commit");
    console.log(JSON.stringify({ deleted: count, backup, after }));
    await c.query("analyze public.our_search_places");
  }
} catch (error) {
  await c.query("rollback");
  throw error;
} finally {
  await c.end();
}
