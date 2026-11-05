import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function testPhotoPreviews(c) {
  await c.query("begin");
  try {
    const owner = randomUUID(),
      admin = randomUUID(),
      map = randomUUID();
    const visible = randomUUID(),
      empty = randomUUID(),
      privatePlace = randomUUID(),
      missing = randomUUID();
    const low = "10000000-0000-4000-8000-000000000001",
      high = "f0000000-0000-4000-8000-000000000001";
    await c.query("insert into auth.users(id) values($1),($2)", [owner, admin]);
    await c.query(
      "insert into private.user_roles(user_id,role) values($1,'admin')",
      [admin],
    );
    await c.query(
      `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status) values($1,$2,'Photo previews','','','KR','Seoul','{"west":126,"south":36,"east":128,"north":38}','published')`,
      [map, "photo-previews-" + map],
    );
    for (const id of [visible, empty, privatePlace]) {
      await c.query(
        `insert into public.places(id,name,location,country,city,status,created_by) values($1,'Preview fixture',extensions.st_setsrid(extensions.st_makepoint(127,37),4326),'KR','Seoul','active',$2)`,
        [id, owner],
      );
      if (id !== privatePlace)
        await c.query(
          `insert into public.map_places(map_id,place_id,added_by,rationale,status) values($1,$2,$3,'A sufficiently detailed fixture recommendation','approved')`,
          [map, id, owner],
        );
    }
    for (const [id, place, status, at] of [
      [randomUUID(), visible, "visible", "2026-01-01"],
      [low, visible, "visible", "2026-02-01"],
      [high, visible, "visible", "2026-02-01"],
      [randomUUID(), visible, "hidden", "2026-03-01"],
      [randomUUID(), visible, "deleted", "2026-04-01"],
      [randomUUID(), privatePlace, "visible", "2026-05-01"],
    ])
      await c.query(
        `insert into public.place_photos(id,place_id,author_id,file_path,thumbnail_path,width,height,status,created_at) values($1::uuid,$2,$3,$1::text||'.webp',$1::text||'-thumb.webp',100,100,$4,$5)`,
        [id, place, owner, status, at],
      );
    const read = async (ids, user = null) => {
      await c.query(`set local role ${user ? "authenticated" : "anon"}`);
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user ?? "",
      ]);
      try {
        return (
          await c.query("select * from public.place_photo_previews($1)", [ids])
        ).rows;
      } finally {
        await c.query("reset role").catch(() => {});
      }
    };
    for (const user of [null, owner, admin]) {
      const rows = await read(
        [visible, visible, empty, privatePlace, missing],
        user,
      );
      assert.equal(rows.length, 4);
      const byId = Object.fromEntries(
        rows.map((r) => [r.place_id, r.photo_id]),
      );
      assert.deepEqual(byId, {
        [visible]: high,
        [empty]: null,
        [privatePlace]: null,
        [missing]: null,
      });
    }
    await c.query("set local role anon");
    const first = (
      await c.query(
        "select id from public.place_photos where place_id=$1 and status='visible' order by created_at desc,id desc limit 1",
        [visible],
      )
    ).rows[0].id;
    await c.query("reset role");
    assert.equal(first, high);
    for (const status of ["hidden", "deleted"]) {
      await c.query("update public.place_photos set status=$1 where id=$2", [
        status,
        high,
      ]);
      assert.equal((await read([visible]))[0].photo_id, low);
    }
    await c.query("update public.theme_maps set status='draft' where id=$1", [
      map,
    ]);
    for (const user of [null, owner, admin])
      assert.equal((await read([visible], user))[0].photo_id, null);
    await c.query(
      "update public.theme_maps set status='published' where id=$1",
      [map],
    );
    await c.query("update public.places set status='archived' where id=$1", [
      visible,
    ]);
    for (const user of [null, owner, admin])
      assert.equal((await read([visible], user))[0].photo_id, null);
    assert.equal((await read(Array(50).fill(empty))).length, 1);
    for (const ids of [[], Array(51).fill(empty), [null], null]) {
      await c.query("savepoint invalid_batch");
      await assert.rejects(read(ids), (e) => e.code === "22023");
      await c.query("rollback to savepoint invalid_batch");
    }
    assert.equal(
      (
        await c.query(
          "select prosecdef from pg_proc where oid='public.place_photo_previews(uuid[])'::regprocedure",
        )
      ).rows[0].prosecdef,
      false,
    );
    assert.equal(
      (
        await c.query(
          "select has_function_privilege('anon','public.place_photo_previews(uuid[])','execute') allowed",
        )
      ).rows[0].allowed,
      true,
    );
  } finally {
    await c.query("rollback");
  }
  console.log(
    "PASS: public preview ordering, duplicates, empty/hidden/deleted/private parents, uploader/admin privacy, batch bounds and invoker permissions",
  );
}
