import assert from "node:assert/strict";
import fs from "node:fs/promises";
export async function testMapTags(c) {
  const sql = await fs.readFile("docs/sql/add-map-place-tags.sql", "utf8");
  await c.query(sql);
  await c.query(sql);
  await c.query("begin");
  try {
    const admin = "aa001111-1111-4111-8111-111111111111",
      owner = "aa002222-2222-4222-8222-222222222222",
      member = "aa003333-3333-4333-8333-333333333333";
    const map = "bb001111-1111-4111-8111-111111111111",
      draft = "bb002222-2222-4222-8222-222222222222";
    for (const u of [admin, owner, member])
      await c.query("insert into auth.users(id) values($1)", [u]);
    await c.query(
      "insert into private.user_roles(user_id,role) values($1,'admin')",
      [admin],
    );
    for (const [id, kind, status] of [
      [map, "community", "published"],
      [draft, "creator", "draft"],
    ])
      await c.query(
        `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status,kind,owner_id) values($1::uuid,$1::uuid::text,'tag fixture','tags','tags','KR','서울','{"west":126,"south":37,"east":128,"north":38}',$3,$2,$4)`,
        [id, kind, status, kind === "creator" ? owner : null],
      );
    const places = (
      await c.query(
        `with p as (insert into public.places(name,address,category,location,country,city,status) select 'Tag fixture '||i,'서울 용산구','식당',extensions.st_setsrid(extensions.st_makepoint(127,37.5),4326),'KR','서울','active' from generate_series(1,25)i returning id) insert into public.map_places(map_id,place_id,rationale,status) select $1,id,'tag fixture','approved' from p returning id`,
        [map],
      )
    ).rows.map((x) => x.id);
    async function as(user, fn, role = "authenticated") {
      await c.query("savepoint tag_request");
      try {
        await c.query(`set local role ${role}`);
        await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
          user ?? "",
        ]);
        const result = await fn();
        await c.query("reset role");
        await c.query("release savepoint tag_request");
        return result;
      } catch (e) {
        await c.query("rollback to savepoint tag_request");
        throw e;
      }
    }
    const command = (user, payload) =>
      as(
        user,
        async () =>
          (
            await c.query("select public.map_tag_command($1) result", [
              JSON.stringify(payload),
            ])
          ).rows[0].result,
      );
    const create = (user, mapId, name) =>
      command(user, { action: "create", mapId, name });
    const a = (await create(admin, map, "#혼밥")).id,
      b = (await create(admin, map, "야외좌석")).id;
    await assert.rejects(() => create(member, map, "무단"), /권한/);
    await assert.rejects(() => create(owner, map, "남의지도"), /권한/);
    await assert.rejects(
      () =>
        as(
          null,
          () =>
            c.query("select public.map_tag_command($1)", [
              JSON.stringify({ action: "create", mapId: map, name: "익명" }),
            ]),
          "anon",
        ),
      /permission denied/,
    );
    const privateTag = (await create(owner, draft, "비공개")).id;
    const hidden = await as(
      null,
      async () =>
        (await c.query("select public.map_tag_catalog($1) result", [draft]))
          .rows[0].result,
      "anon",
    );
    assert.equal(hidden, null);
    const ownerRead = await as(
      owner,
      async () =>
        (await c.query("select public.map_tag_catalog($1) result", [draft]))
          .rows[0].result,
    );
    assert.equal(ownerRead.canManage, true);
    assert.equal(ownerRead.tags.length, 1);
    await assert.rejects(() => create(admin, map, "＃혼밥"), /태그/);
    await assert.rejects(() => create(admin, map, "혼밥"), /duplicate/);
    await create(admin, map, "Ｃａｆｅ");
    await assert.rejects(() => create(admin, map, "cafe"), /duplicate/);
    await assert.rejects(
      () =>
        command(admin, {
          action: "assign",
          mapId: map,
          mapPlaceId: places[0],
          tagIds: [privateTag],
        }),
      /이 지도/,
    );
    await assert.rejects(
      () =>
        command(member, {
          action: "assign",
          mapId: map,
          mapPlaceId: places[0],
          tagIds: [a],
        }),
      /권한/,
    );
    await assert.rejects(
      () =>
        as(admin, () =>
          c.query("insert into public.map_tags(map_id,name) values($1,$2)", [
            map,
            "direct",
          ]),
        ),
      /permission denied/,
    );
    for (let i = 0; i < places.length; i++)
      await command(admin, {
        action: "assign",
        mapId: map,
        mapPlaceId: places[i],
        tagIds: i === 0 ? [a, b] : [a],
      });
    const search = (tagIds, extra = {}) =>
      as(
        null,
        async () =>
          (
            await c.query("select public.search_map_places($1) result", [
              JSON.stringify({ mapId: map, tagIds, ...extra }),
            ])
          ).rows[0].result,
        "anon",
      );
    const both = await search([a, b]);
    assert.equal(both.total, 1);
    assert.equal(both.items[0].id, places[0]);
    assert.deepEqual(new Set(both.items[0].tag_ids), new Set([a, b]));
    const page1 = await search([a]);
    assert.equal(page1.total, 25);
    assert.equal(page1.items.length, 20);
    assert.equal(page1.hasMore, true);
    assert.equal((await search([a], { offset: 20 })).items.length, 5);
    assert.equal((await search([a, b], { q: "no-such-name" })).total, 0);
    assert.equal((await search([privateTag])).total, 0);
    await command(admin, {
      action: "rename",
      mapId: map,
      id: b,
      name: "테라스",
    });
    assert.equal((await search([a, b])).total, 1);
    await command(admin, { action: "archive", mapId: map, id: b });
    assert.equal((await search([a, b])).total, 0);
    const catalog = await as(
      null,
      async () =>
        (await c.query("select public.map_tag_catalog($1) result", [map]))
          .rows[0].result,
      "anon",
    );
    assert.equal(catalog.canManage, false);
    assert.ok(catalog.tags.every((t) => t.id !== b));
    const extras = [];
    for (let i = 0; i < 11; i++)
      extras.push((await create(admin, map, `제한${i}`)).id);
    await command(admin, {
      action: "assign",
      mapId: map,
      mapPlaceId: places[0],
      tagIds: extras.slice(0, 10),
    });
    await assert.rejects(
      () =>
        command(admin, {
          action: "assign",
          mapId: map,
          mapPlaceId: places[0],
          tagIds: extras,
        }),
      /최대 10개/,
    );
    const saved = await as(
      null,
      async () =>
        (await c.query("select public.map_place_tag_ids($1) ids", [places[0]]))
          .rows[0].ids,
      "anon",
    );
    assert.equal(saved.length, 10);
    assert.equal(
      (
        await c.query(
          "select count(*)::int n from public.map_place_tags where map_place_id=$1 and tag_id=$2",
          [places[0], b],
        )
      ).rows[0].n,
      1,
    );
    let activeCount = (
      await c.query(
        "select count(*)::int n from public.map_tags where map_id=$1 and not archived",
        [map],
      )
    ).rows[0].n;
    while (activeCount < 30) await create(admin, map, `상한${activeCount++}`);
    await assert.rejects(() => create(admin, map, "초과"), /최대 30개/);
    await c.query(
      "update private.user_roles set suspended=true where user_id=$1",
      [admin],
    );
    await assert.rejects(() => create(admin, map, "정지계정"), /제한/);
    console.log(
      "PASS: map tag permissions, private-map isolation, normalized duplicates, atomic same-map assignments, AND filtering, pagination, rename, archive and limits",
    );
  } finally {
    await c.query("rollback");
  }
}
