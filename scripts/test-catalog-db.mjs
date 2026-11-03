import assert from "node:assert/strict";
import crypto from "node:crypto";
export async function testCatalogAdmin(c) {
  await c.query("begin");
  try {
    const admin = crypto.randomUUID(),
      member = crypto.randomUUID(),
      other = crypto.randomUUID(),
      suspended = crypto.randomUUID();
    for (const id of [admin, member, other, suspended])
      await c.query("insert into auth.users(id) values($1)", [id]);
    await c.query(
      "insert into private.user_roles(user_id,role,suspended) values($1,'admin',false),($2,'admin',false),($3,'admin',true)",
      [admin, other, suspended],
    );
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      await c.query(
        `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status) values($1::uuid,$1::uuid::text,'catalog fixture','fixture','fixture','KR','서울','{"west":126,"south":37,"east":128,"north":38}','published')`,
        [id],
      );
    }
    async function as(user, sql, params = [], role = "authenticated") {
      await c.query("savepoint catalog_actor");
      try {
        await c.query(`set local role ${role}`);
        await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
          user ?? "",
        ]);
        const r = await c.query(sql, params);
        await c.query("reset role");
        await c.query("release savepoint catalog_actor");
        return r;
      } catch (e) {
        await c.query("rollback to savepoint catalog_actor");
        throw e;
      }
    }
    const command = (user, payload) =>
      as(user, "select public.admin_catalog_command($1::jsonb) result", [
        JSON.stringify(payload),
      ]).then((r) => r.rows[0].result);
    const change = (id, version = 0) => ({
      mapId: id,
      version,
      title: "편집한 이름",
      category: "fashion",
      region: "전국",
      aliases: ["별칭"],
      imageId: null,
      focalX: 50,
      focalY: 52,
    });
    for (const actor of [member, suspended])
      await assert.rejects(
        () => command(actor, { action: "apply", changes: [change(ids[0])] }),
        (e) => e.code === "42501",
      );
    await assert.rejects(
      () =>
        as(
          null,
          "select public.admin_catalog_command($1::jsonb)",
          [JSON.stringify({ action: "snapshot" })],
          "anon",
        ),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      () => as(admin, "update public.catalog_settings set value='{}'"),
      (e) => e.code === "42501",
    );
    await command(admin, {
      action: "apply",
      changes: ids.map((id) => change(id)),
    });
    assert.equal(
      (
        await as(
          null,
          "select map_id,value,version from public.catalog_settings where map_id=any($1::uuid[])",
          [ids],
          "anon",
        )
      ).rows.length,
      2,
    );
    // A stale second item must roll back a valid first item, irrespective of lock order.
    await assert.rejects(
      () =>
        command(admin, {
          action: "apply",
          changes: [change(ids[0], 1), change(ids[1], 0)],
        }),
      (e) => e.code === "40001",
    );
    assert.ok(
      (
        await c.query(
          "select version from public.catalog_settings where map_id=any($1::uuid[])",
          [ids],
        )
      ).rows.every((r) => r.version === 1),
    );
    await assert.rejects(() =>
      command(admin, {
        action: "apply",
        changes: [{ ...change(ids[0], 1), focalX: 101 }],
      }),
    );
    await assert.rejects(() =>
      command(admin, {
        action: "apply",
        changes: [{ ...change(ids[0], 1), version: null }],
      }),
    );
    const slot = await command(admin, { action: "reserve", mapId: ids[0] });
    await c.query(
      "insert into storage.objects(bucket_id,name) values('catalog-images',$1)",
      [slot.path],
    );
    await command(admin, { action: "ready", imageId: slot.id });
    const access = (user, id, role = "authenticated") =>
      as(
        user,
        "select public.catalog_image_access($1) result",
        [id],
        role,
      ).then((r) => r.rows[0].result);
    assert.ok(await access(admin, slot.id));
    assert.equal(await access(member, slot.id), null);
    assert.equal(await access(null, slot.id, "anon"), null);
    await assert.rejects(() =>
      command(other, {
        action: "apply",
        changes: [{ ...change(ids[0], 1), imageId: slot.id }],
      }),
    );
    await command(admin, {
      action: "apply",
      changes: [{ ...change(ids[0], 1), imageId: slot.id }],
    });
    assert.ok(await access(null, slot.id, "anon"));
    const expired = await command(admin, { action: "reserve", mapId: ids[1] });
    await c.query(
      "insert into storage.objects(bucket_id,name) values('catalog-images',$1)",
      [expired.path],
    );
    await command(admin, { action: "ready", imageId: expired.id });
    await c.query(
      "update private.catalog_images set expires_at=now()-interval '1 second' where id=$1",
      [expired.id],
    );
    await assert.rejects(() =>
      command(admin, {
        action: "apply",
        changes: [{ ...change(ids[1], 1), imageId: expired.id }],
      }),
    );
    assert.equal(await access(admin, expired.id), null);
    await assert.rejects(
      () =>
        as(
          admin,
          'select public.catalog_image_cleanup(\'{"action":"claim"}\')',
        ),
      (e) => e.code === "42501",
    );
    const jobs = (
      await as(
        null,
        'select public.catalog_image_cleanup(\'{"action":"claim"}\') result',
        [],
        "service_role",
      )
    ).rows[0].result;
    assert.ok(jobs.some((j) => j.id === expired.id));
    assert.ok(!jobs.some((j) => j.id === slot.id));
    assert.equal(
      (
        await c.query(
          "select count(*)::int n from private.catalog_audit where map_id=any($1::uuid[])",
          [ids],
        )
      ).rows[0].n,
      3,
    );
    await c.query(
      "update public.theme_maps set status='archived' where id=$1",
      [ids[0]],
    );
    assert.equal(await access(null, slot.id, "anon"), null);
    assert.equal(
      (
        await as(
          null,
          "select map_id,value,version from public.catalog_settings where map_id=$1",
          [ids[0]],
          "anon",
        )
      ).rows.length,
      0,
    );
    console.log(
      "PASS: catalog admin RLS, suspended/member/anon denial, atomic conflict rollback, audit, private staging, expiration and cleanup claims",
    );
  } finally {
    await c.query("rollback");
  }
}
