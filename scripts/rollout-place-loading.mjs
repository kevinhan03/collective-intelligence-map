// Applies only this release's additive migrations; never resets or seeds a hosted DB.
import pg from "pg";
import fs from "node:fs/promises";
const projectArg = process.argv
  .find((arg) => arg.startsWith("--project-ref="))
  ?.split("=")[1];
const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
  ".",
)[0];
const url = new URL(process.env.OVERTURE_DATABASE_URL);
if (
  projectArg !== project ||
  !decodeURIComponent(url.username).endsWith("." + project)
)
  throw new Error("Explicit project ref, API and DB credentials must match");
const files = [
  "20261105051934_optimize_map_place_reads.sql",
  "20261105052037_batch_place_photo_previews.sql",
];
const dir = "artifacts/performance/place-loading/rollout";
await fs.mkdir(dir, { recursive: true });
const c = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
await c.connect();
try {
  const {
    rows: [original],
  } = await c.query(
    "select pg_get_functiondef('public.map_places_in_bounds(uuid,double precision,double precision,double precision,double precision)'::regprocedure) definition",
  );
  const history = (
    await c.query(
      "select version from supabase_migrations.schema_migrations where version=any($1)",
      [files.map((f) => f.split("_")[0])],
    )
  ).rows.map((r) => r.version);
  console.log(
    JSON.stringify({
      project,
      pending: files.filter((f) => !history.includes(f.split("_")[0])),
      apply: process.argv.includes("--apply"),
    }),
  );
  if (!process.argv.includes("--apply")) process.exitCode = 0;
  else {
    // Never overwrite the pre-release rollback snapshot on a repeated run.
    await fs
      .writeFile(`${dir}/rollback-original.sql`, original.definition + ";\n", {
        flag: "wx",
      })
      .catch((error) => {
        if (error.code !== "EEXIST") throw error;
      });
    await c.query("begin");
    try {
      await c.query(
        "set local lock_timeout='5s'; set local statement_timeout='15s'",
      );
      await c.query(
        "select pg_advisory_xact_lock(hashtext('place-loading-release'))",
      );
      for (const file of files) {
        const version = file.split("_")[0];
        if (
          (
            await c.query(
              "select 1 from supabase_migrations.schema_migrations where version=$1",
              [version],
            )
          ).rowCount
        )
          continue;
        const sql = await fs.readFile(`supabase/migrations/${file}`, "utf8");
        await c.query(sql);
        await c.query(
          "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)",
          [version, file.slice(version.length + 1, -4), [sql]],
        );
      }
      await c.query("notify pgrst,'reload schema'");
      await c.query("commit");
      console.log(
        "Applied both migrations; existing tables and data unchanged.",
      );
    } catch (error) {
      await c.query("rollback");
      throw error;
    }
  }
} finally {
  await c.end();
}
