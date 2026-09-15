import pg from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const url =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.USER}@127.0.0.1:55432/cim_test`;
if (!new URL(url).pathname.endsWith("_test"))
  throw new Error("Use an isolated *_test database only.");
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  await c.query(`drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; create schema public; create schema auth; create schema storage;
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
  for (const f of (await fs.readdir("supabase/migrations")).sort())
    await c.query(await fs.readFile(`supabase/migrations/${f}`, "utf8"));
  await c.query(await fs.readFile("supabase/seed.sql", "utf8"));
  console.log("PASS: migrations and seed apply to PostgreSQL/PostGIS");
  const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    admin = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    map = "11111111-1111-4111-8111-111111111111";
  await c.query("insert into auth.users(id) values($1),($2),($3)", [
    a,
    b,
    admin,
  ]);
  await c.query(
    "insert into private.user_roles(user_id,role) values($1,'contributor'),($2,'contributor'),($3,'admin')",
    [a, b, admin],
  );
  async function as(user, fn, role = "authenticated") {
    await c.query("begin");
    try {
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user ?? "",
      ]);
      const r = await fn();
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  }
  async function command(user, payload) {
    return as(user, () =>
      c.query("select public.community_command($1::jsonb) result", [
        JSON.stringify(payload),
      ]),
    );
  }
  const proposal = {
    mapId: map,
    name: "Test independent boutique",
    address: "Test",
    category: "빈티지",
    lat: 35.66,
    lng: 139.7,
    rationale: "직접 방문한 독립 편집숍으로 빈티지 선별이 주제에 적합합니다.",
    sourceNote: "테스트 전용 자체 생성 좌표와 이름. 외부 제공자 데이터 없음.",
  };
  const pid = (
    await as(a, () =>
      c.query("select public.submit_proposal($1::jsonb) id", [
        JSON.stringify(proposal),
      ]),
    )
  ).rows[0].id;
  const pendingRows = (
    await as(null, () => c.query("select * from public.map_places"), "anon")
  ).rows;
  assert.equal(pendingRows.length, 1);
  assert.equal(pendingRows[0].status, "pending");
  assert.equal(
    (
      await as(
        null,
        () =>
          c.query(
            "select public.map_places_in_bounds($1,139.6,35.6,139.8,35.8) items",
            [map],
          ),
        "anon",
      )
    ).rows[0].items.length,
    0,
  );
  assert.equal(
    (
      await as(
        null,
        () => c.query("select public.map_pending_places($1) items", [map]),
        "anon",
      )
    ).rows[0].items.length,
    1,
  );
  await command(b, { action: "vote", id: pid, value: 1 });
  assert.equal(
    (
      await c.query(
        "select count(*)::int n from public.map_place_votes where map_place_id=$1",
        [pid],
      )
    ).rows[0].n,
    1,
  );
  await command(b, { action: "vote", id: pid, value: 0 });
  console.log(
    "PASS: pending proposals are readable and votable on the theme map, but hidden from the public bbox query",
  );
  await assert.rejects(
    as(b, () =>
      c.query("update public.map_places set status='approved' where id=$1", [
        pid,
      ]),
    ),
  );
  await assert.rejects(
    command(b, {
      action: "moderate",
      id: pid,
      status: "approved",
      reason: "unauthorized approval",
    }),
  );
  await command(admin, {
    action: "moderate",
    id: pid,
    status: "approved",
    reason: "출처와 주제 적합성 확인 완료",
  });
  assert.equal(
    (await as(null, () => c.query("select * from public.map_places"), "anon"))
      .rowCount,
    1,
  );
  await command(a, { action: "vote", id: pid, value: 1 });
  await command(a, { action: "vote", id: pid, value: -1 });
  assert.equal(
    (await c.query("select count(*)::int n from public.map_place_votes"))
      .rows[0].n,
    1,
  );
  await command(b, { action: "save", id: pid, enabled: true });
  assert.equal(
    (await as(a, () => c.query("select * from public.saves"))).rowCount,
    0,
  );
  assert.equal(
    (await as(b, () => c.query("select * from public.saves"))).rowCount,
    1,
  );
  await command(b, {
    action: "comment",
    id: pid,
    body: "직접 방문한 경험을 공유합니다.",
  });
  await command(b, { action: "follow", id: map, enabled: true });
  await command(b, {
    action: "report",
    id: pid,
    target: "map_place",
    reason: "위치 재확인 요청입니다.",
  });
  const bounds = (
    await as(
      null,
      () =>
        c.query(
          "select public.map_places_in_bounds($1,139.6,35.6,139.8,35.8) items",
          [map],
        ),
      "anon",
    )
  ).rows[0].items;
  assert.equal(bounds.length, 1);
  assert.equal(bounds[0].negative, 1);
  assert.equal(
    (
      await as(
        null,
        () =>
          c.query(
            "select public.map_places_in_bounds($1,139.8,35.6,139.9,35.8) items",
            [map],
          ),
        "anon",
      )
    ).rows[0].items.length,
    0,
  );
  console.log(
    "PASS: pending privacy, approval authorization, votes, private saves, comments, follows, reports, bbox",
  );
  const pidPlaceId = (
    await c.query("select place_id from public.map_places where id=$1", [pid])
  ).rows[0].place_id;
  const noRef = await as(
    null,
    () =>
      c.query(
        "select public.resolve_provider_place('google','ext-test-nonexistent') data",
      ),
    "service_role",
  );
  assert.equal(noRef.rows[0].data, null);
  await c.query(
    "insert into private.place_provider_refs(place_id,provider,external_id) values($1,'google','ext-test-1')",
    [pidPlaceId],
  );
  const ref = await as(
    null,
    () =>
      c.query(
        "select public.resolve_provider_place('google','ext-test-1') data",
      ),
    "service_role",
  );
  assert.equal(ref.rows[0].data.placeId, pidPlaceId);
  assert.equal(ref.rows[0].data.name, "Test independent boutique");
  assert.equal(typeof ref.rows[0].data.lat, "number");
  console.log(
    "PASS: resolve_provider_place returns canonical fields once linked, null otherwise",
  );
  const pid2 = (
    await as(a, () =>
      c.query("select public.submit_proposal($1::jsonb) id", [
        JSON.stringify({ ...proposal, name: "Duplicate test" }),
      ]),
    )
  ).rows[0].id;
  await command(admin, {
    action: "moderate",
    id: pid2,
    status: "approved",
    reason: "테스트 중복 승인 출처 확인",
  });
  await command(a, { action: "vote", id: pid2, value: 1 });
  await command(b, { action: "save", id: pid2, enabled: true });
  const place1 = (
    await c.query("select place_id from public.map_places where id=$1", [pid])
  ).rows[0].place_id;
  const place2 = (
    await c.query("select place_id from public.map_places where id=$1", [pid2])
  ).rows[0].place_id;
  await command(admin, {
    action: "merge",
    id: place2,
    targetId: place1,
    reason: "동일 현실 장소 중복 병합 테스트",
  });
  assert.equal(
    (
      await c.query(
        "select count(*)::int n from public.map_place_votes where map_place_id=$1",
        [pid],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await c.query(
        "select count(*)::int n from public.saves where map_place_id=$1",
        [pid],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await c.query("select status from public.places where id=$1", [place2]))
      .rows[0].status,
    "merged",
  );
  await assert.rejects(
    command(admin, {
      action: "merge",
      id: place1,
      targetId: place1,
      reason: "잘못된 병합 롤백 테스트",
    }),
  );
  console.log(
    "PASS: transactional duplicate merge, one vote/save per user, invalid merge rollback",
  );
  await c.query(
    "update private.provider_settings set enabled=true,daily_limit=1 where provider='google'",
  );
  const session = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await as(
    null,
    () =>
      c.query(
        "select public.reserve_provider('google','autocomplete',$1,$2,$3,3000)",
        [a, map, session],
      ),
    "service_role",
  );
  await assert.rejects(
    as(
      null,
      () =>
        c.query(
          "select public.reserve_provider('google','autocomplete',$1,$2,$3,3000)",
          [a, map, session],
        ),
      "service_role",
    ),
  );
  await assert.rejects(
    as(a, () =>
      c.query(
        "select public.reserve_provider('google','autocomplete',$1,$2,$3,3000)",
        [a, map, session],
      ),
    ),
  );
  console.log("PASS: provider budget hard limit and service-only API");
  await c.query(
    "update private.provider_settings set enabled=true,daily_limit=1 where provider='kakao'",
  );
  const attempts = await Promise.allSettled(
    [1, 2].map(async () => {
      const connection = new pg.Client({ connectionString: url });
      await connection.connect();
      try {
        await connection.query("set role service_role");
        return await connection.query(
          "select public.reserve_provider('kakao','keyword',$1,$2,$3,1000)",
          [a, map, session],
        );
      } finally {
        await connection.end();
      }
    }),
  );
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  console.log("PASS: concurrent provider reservations cannot exceed hard cap");

  const member = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await c.query("insert into auth.users(id) values($1)", [member]);
  const pending = (
    await as(member, () =>
      c.query("select public.submit_proposal($1::jsonb) id", [
        JSON.stringify({
          ...proposal,
          name: "Member shop",
          rationale: "빈티지 추천",
        }),
      ]),
    )
  ).rows[0].id;
  assert.equal(
    (
      await c.query("select status from public.map_places where id=$1", [
        pending,
      ])
    ).rows[0].status,
    "pending",
  );
  await assert.rejects(
    command(member, {
      action: "moderate",
      id: pending,
      status: "approved",
      reason: "unauthorized",
    }),
  );
  await assert.rejects(
    as(member, () =>
      c.query(
        "insert into public.theme_maps select * from public.theme_maps limit 1",
      ),
    ),
  );
  await command(member, { action: "verify_place", id: pid, kind: "visited" });
  await command(member, { action: "verify_place", id: pid, kind: "open" });
  const checks = (
    await as(
      null,
      () => c.query("select public.place_check_summary($1) data", [pid]),
      "anon",
    )
  ).rows[0].data;
  assert.equal(checks.visited, 0);
  assert.equal(checks.open, 1);
  await assert.rejects(
    command(member, { action: "verify_place", id: pending, kind: "visited" }),
  );
  await c.query(
    "update private.provider_settings set enabled=true,daily_limit=100,monthly_limit=1000 where provider='google'",
  );
  await as(
    member,
    () =>
      c.query(
        "select public.reserve_provider('google','autocomplete',$1,$2,$3,2830)",
        [member, map, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
      ),
    "service_role",
  );
  console.log(
    "PASS: member proposal stays pending; approval/map creation denied; verification upsert and member search allowed",
  );

  const adminPid = (
    await as(admin, () =>
      c.query("select public.submit_proposal($1::jsonb) id", [
        JSON.stringify({
          ...proposal,
          name: "Admin curated shop",
          lat: 35.661,
          lng: 139.701,
        }),
      ]),
    )
  ).rows[0].id;
  assert.equal(
    (
      await c.query("select status from public.map_places where id=$1", [
        adminPid,
      ])
    ).rows[0].status,
    "approved",
  );
  assert.equal(
    (
      await as(
        null,
        () =>
          c.query(
            "select public.map_places_in_bounds($1,139.6,35.6,139.8,35.8) items",
            [map],
          ),
        "anon",
      )
    ).rows[0].items.some((item) => item.id === adminPid),
    true,
  );
  console.log("PASS: admin proposals publish immediately, no approval step");

  // Vertical slice inventory is synthetic test data, never production POIs.
  const beforeCount = Number(
    (await c.query("select count(*) from public.places")).rows[0].count,
  );
  await c.query(`insert into public.our_search_places(source,source_id,primary_name,country_code,locality,address,latitude,longitude,category,search_text,release) values
    ('overture','test-poi-1','Synthetic Overture Shop','JP','Tokyo','Test address',35.665,139.705,'vintage','Synthetic Overture Shop 別名','test'),
    ('overture','test-poi-outside','Synthetic Overture Shop','FR','Paris','Test address',48.85,2.35,'vintage','Synthetic Overture Shop','test')`);
  assert.equal(
    Number((await c.query("select count(*) from public.places")).rows[0].count),
    beforeCount,
  );
  await assert.rejects(() =>
    as(a, () => c.query("select * from public.our_search_places")),
  );
  await assert.rejects(() =>
    as(a, () =>
      c.query("select public.search_overture_places('Synthetic',$1)", [map]),
    ),
  );
  const hits = (
    await as(
      null,
      () =>
        c.query("select public.search_overture_places('別名',$1) items", [map]),
      "service_role",
    )
  ).rows[0].items;
  assert.equal(hits.length, 1);
  assert.equal(hits[0].externalId, "test-poi-1");
  const outside = (
    await as(
      null,
      () =>
        c.query(
          "select public.overture_place_details('test-poi-outside',$1) item",
          [map],
        ),
      "service_role",
    )
  ).rows[0].item;
  assert.equal(outside, null);
  const map2 = "22222222-2222-4222-8222-222222222229";
  await c.query(
    `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status) select $1,'test-second-theme','Second theme',description,rules,country,city,bounds,status from public.theme_maps where id=$2`,
    [map2, map],
  );
  const actor1 = "abcdef01-dddd-4ddd-8ddd-dddddddddddd",
    actor2 = "abcdef02-eeee-4eee-8eee-eeeeeeeeeeee";
  await c.query("insert into auth.users(id) values($1),($2)", [actor1, actor2]);
  const selected = {
    ...proposal,
    name: "Synthetic Overture Shop",
    address: "Test address",
    lat: 35.665,
    lng: 139.705,
  };
  async function resolved(connection, user, mapId) {
    return connection.query(
      "select public.submit_resolved_proposal($1,$2,'overture','test-poi-1',true) id",
      [JSON.stringify({ ...selected, mapId }), user],
    );
  }
  // Two separate database sessions submit the same provider ID simultaneously.
  const concurrent = new pg.Client({ connectionString: url });
  await concurrent.connect();
  let first, second;
  try {
    [first, second] = await Promise.all([
      resolved(c, actor1, map),
      resolved(concurrent, actor2, map2),
    ]);
  } finally {
    await concurrent.end();
  }
  const links = (
    await c.query(
      "select place_id from public.map_places where id=any($1::uuid[])",
      [[first.rows[0].id, second.rows[0].id]],
    )
  ).rows;
  assert.equal(links.length, 2);
  assert.equal(links[0].place_id, links[1].place_id);
  assert.equal(
    Number((await c.query("select count(*) from public.places")).rows[0].count),
    beforeCount + 1,
  );
  assert.equal((await resolved(c, actor1, map)).rows[0].id, first.rows[0].id);
  assert.equal(
    (
      await c.query("select source_type from public.places where id=$1", [
        links[0].place_id,
      ])
    ).rows[0].source_type,
    "overture",
  );
  const internalHits = (
    await as(actor2, () =>
      c.query("select public.search_internal_places('Synthetic',$1) items", [
        map,
      ]),
    )
  ).rows[0].items;
  assert.equal(internalHits[0].id, links[0].place_id);
  const pins = (
    await as(
      null,
      () => c.query("select public.map_pending_places($1) items", [map]),
      "anon",
    )
  ).rows[0].items;
  assert(pins.some((p) => p.id === first.rows[0].id && p.lat === 35.665));
  await assert.rejects(() =>
    as(actor1, () =>
      c.query(
        "select public.submit_resolved_proposal($1,$2,'overture','fake',true)",
        [JSON.stringify(selected), actor1],
      ),
    ),
  );
  // Conservative resolution reuses an exact nearby independently added place.
  const manual = (
    await as(actor2, () =>
      c.query("select public.submit_proposal($1) id", [
        JSON.stringify({ ...selected, mapId: map2 }),
      ]),
    )
  ).rows[0].id;
  assert.equal(manual, second.rows[0].id);
  const separate = (
    await as(actor2, () =>
      c.query("select public.submit_proposal($1) id", [
        JSON.stringify({
          ...selected,
          name: "Synthetic Overture Shop Annex",
          mapId: map2,
        }),
      ]),
    )
  ).rows[0].id;
  assert.notEqual(separate, manual);
  console.log(
    "PASS: search inventory isolation, scoped alias search, concurrent promotion, same/cross-map reuse, pending pins, conservative resolution and RPC permissions",
  );

  const etlDir = await fs.mkdtemp(path.join(tmpdir(), "cim-etl-test-"));
  try {
    const fixture = path.join(etlDir, "extract.ndjson");
    const row = {
      id: "etl-fixture",
      names: { primary: "ETL Fixture", common: { ja: "テスト" } },
      addresses: [{ country: "JP", locality: "Tokyo" }],
      categories: { primary: "vintage" },
      longitude: 139.71,
      latitude: 35.67,
    };
    await fs.writeFile(fixture, JSON.stringify(row) + "\n");
    const run = () =>
      promisify(execFile)(
        process.execPath,
        ["scripts/overture/ingest.mjs", "tokyo", "2026-08-19.0", fixture],
        { env: { ...process.env, OVERTURE_DATABASE_URL: url } },
      );
    const placeCount = Number(
      (await c.query("select count(*) from public.places")).rows[0].count,
    );
    await run();
    await run();
    assert.equal(
      Number(
        (
          await c.query(
            "select count(*) from public.our_search_places where source_id='etl-fixture'",
          )
        ).rows[0].count,
      ),
      1,
    );
    assert.equal(
      Number(
        (await c.query("select count(*) from public.places")).rows[0].count,
      ),
      placeCount,
    );
    await fs.writeFile(fixture, "");
    await assert.rejects(run);
    assert.equal(
      Number(
        (
          await c.query(
            "select count(*) from public.our_search_places where source_id='etl-fixture'",
          )
        ).rows[0].count,
      ),
      1,
    );
    console.log(
      "PASS: regional ETL normalization, idempotent refresh, no Place promotion and empty-extract rollback",
    );
  } finally {
    await fs.rm(etlDir, { recursive: true, force: true });
  }

  const functions = (
    await c.query(
      "select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef",
    )
  ).rows;
  assert.equal(functions.length, 0);
  console.log("PASS: no public SECURITY DEFINER functions");
} finally {
  await c.end();
}
