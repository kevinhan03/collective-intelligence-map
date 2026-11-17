import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
const url =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.USER}@127.0.0.1:55432/cim_test`;
if (!new URL(url).pathname.endsWith("_test"))
  throw new Error("Use an isolated *_test database only");
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  await c.query("begin");
  await c.query(
    await fs.readFile(
      "supabase/migrations/20261117113757_overseas_admin_registration.sql",
      "utf8",
    ),
  );
  const member = randomUUID(),
    admin = randomUUID();
  await c.query("select set_config('request.jwt.claim.sub','',true)");
  await c.query("insert into auth.users(id) values($1),($2)", [member, admin]);
  await c.query(
    "insert into private.user_roles(user_id,role) values($1,'contributor'),($2,'admin')",
    [member, admin],
  );
  const maps = {};
  for (const country of ["KR", "JP", "world"]) {
    const id = randomUUID();
    maps[country] = id;
    await c.query(
      `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status,search_scope)
      values($1,$2,'Registration test','Test description','Test rules',$3,'Test',$4,'published',$5)`,
      [
        id,
        `registration-${id}`,
        country === "world" ? null : country,
        JSON.stringify({ west: -180, south: -90, east: 180, north: 90 }),
        country === "world" ? "world" : "country",
      ],
    );
  }
  const actor = (id) =>
    c.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  async function denied(run) {
    await c.query("savepoint policy_test");
    try {
      await assert.rejects(
        run,
        (e) => e.code === "42501" && e.message.includes("관리자만"),
      );
    } finally {
      await c.query("rollback to savepoint policy_test");
    }
  }
  const payload = (mapId, countryCode) => ({
    mapId,
    countryCode,
    name: `Test ${randomUUID()}`,
    address: "Test address",
    category: "cafe",
    lat: 35.6,
    lng: 139.7,
    rationale: "Test recommendation",
  });
  const propose = (p) =>
    c.query("select public.submit_proposal($1::jsonb)", [JSON.stringify(p)]);
  await actor(member);
  await propose(payload(maps.KR, "KR"));
  await denied(() => propose(payload(maps.JP, "JP")));
  await denied(() => propose(payload(maps.world, "KR")));
  await denied(() =>
    c.query("select public.creator_command($1::jsonb)", [
      JSON.stringify({
        action: "create",
        title: "Foreign test",
        description: "Test",
        country: "world",
      }),
    ]),
  );
  // Service-role resolution must enforce the verified actor too.
  await c.query("set local role service_role");
  await denied(() =>
    c.query(
      "select public.submit_resolved_proposal($1::jsonb,$2,'overture',$3,true)",
      [JSON.stringify(payload(maps.JP, "JP")), member, randomUUID()],
    ),
  );
  await c.query("reset role");
  await actor(admin);
  await propose(payload(maps.JP, "JP"));
  await propose(payload(maps.world, "US"));
  const jpPlace = (
    await c.query(
      "select place_id from public.map_places where map_id=$1 limit 1",
      [maps.JP],
    )
  ).rows[0].place_id;
  await actor(member);
  await denied(() =>
    c.query(
      "insert into public.map_places(map_id,place_id,added_by,rationale) values($1,$2,$3,'Test reason')",
      [maps.KR, jpPlace, member],
    ),
  );
  await denied(() =>
    c.query("update public.theme_maps set country='JP' where id=$1", [maps.KR]),
  );
  await denied(() =>
    c.query(
      "insert into public.places(name,country,city,location,created_by) values('Foreign','JP','Tokyo',extensions.st_setsrid(extensions.st_makepoint(139.7,35.6),4326),$1)",
      [member],
    ),
  );
  await actor(admin);
  await c.query(
    "update private.user_roles set suspended=true where user_id=$1",
    [admin],
  );
  await denied(() =>
    c.query(
      "insert into public.places(name,country,city,location,created_by) values('Foreign','JP','Tokyo',extensions.st_setsrid(extensions.st_makepoint(139.7,35.6),4326),$1)",
      [admin],
    ),
  );
  console.log(
    "PASS: Korea participation; overseas/world admin curation; RPC, service-role, association and scope bypasses; suspended admin denied",
  );
} finally {
  await c.query("rollback");
  await c.end();
}
