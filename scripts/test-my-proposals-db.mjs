import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function testMyProposals(c) {
  await c.query("begin");
  try {
    const owner = randomUUID(),
      other = randomUUID(),
      empty = randomUUID(),
      map = randomUUID();
    await c.query("insert into auth.users(id) values($1),($2),($3)", [
      owner,
      other,
      empty,
    ]);
    // owner_id is deliberately different from the proposal author: after creator
    // support, this column must never shadow the authenticated identity variable.
    await c.query(
      `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status,owner_id)
   values($1,$2,'Proposals fixture','','','KR','Seoul','{"west":126,"south":36,"east":128,"north":38}','published',$3)`,
      [map, "proposals-" + map, other],
    );
    const ownIds = [];
    for (let i = 0; i < 23; i++) {
      const place = randomUUID(),
        mp = randomUUID();
      await c.query(
        `insert into public.places(id,name,address,location,country,city,status,created_by) values($1,$2,'Seoul',extensions.st_setsrid(extensions.st_makepoint(127,37),4326),'KR','Seoul','active',$3)`,
        [place, "Proposal fixture " + i, i < 22 ? owner : other],
      );
      await c.query(
        `insert into public.map_places(id,map_id,place_id,added_by,rationale,status,created_at,updated_at)
    values($1,$2,$3,$4,'A sufficiently detailed fixture recommendation',$5,'2026-10-01'::timestamptz+$6*interval '1 day','2026-11-01'::timestamptz)`,
        [
          mp,
          map,
          place,
          i < 22 ? owner : other,
          i === 0
            ? "pending"
            : i === 1
              ? "rejected"
              : i === 2
                ? "disputed"
                : "approved",
          i,
        ],
      );
      if (i < 22) ownIds.push(mp);
    }
    for (const [status, reason, at] of [
      ["rejected", "Original rejection", "2026-10-10"],
      ["rejected", "Latest rejection", "2026-10-11"],
      ["approved", "Unrelated decision", "2026-10-12"],
    ]) {
      await c.query(
        `insert into private.moderation_actions(actor_id,action,map_place_id,reason,after_state,created_at) values($1,'moderate',$2,$3,jsonb_build_object('status',$4::text),$5)`,
        [other, ownIds[1], reason, status, `${at}T00:00:00Z`],
      );
    }
    const as = async (user, page = 1, role = "authenticated") => {
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user ?? "",
      ]);
      try {
        return (await c.query("select public.my_proposals($1) result", [page]))
          .rows[0].result;
      } finally {
        await c.query("reset role").catch(() => {});
      }
    };
    const first = await as(owner),
      second = await as(owner, 2);
    assert.equal(first.length, 21);
    assert.equal(second.length, 2);
    assert.deepEqual(
      [...first.slice(0, 20), ...second].map((r) => r.id),
      [...ownIds].reverse(),
    );
    const pending = second.find((r) => r.id === ownIds[0]);
    assert.equal(pending.reviewed_at, null);
    assert.equal(pending.rejection_reason, null);
    const rejected = second.find((r) => r.id === ownIds[1]);
    assert.equal(rejected.rejection_reason, "Latest rejection");
    assert.equal(
      new Date(rejected.reviewed_at).toISOString(),
      "2026-10-11T00:00:00.000Z",
    );
    assert.equal((await as(other)).length, 1);
    assert.deepEqual(await as(empty), []);
    assert.deepEqual(await as(owner, 3), []);
    assert.ok(
      first.every(
        (r) =>
          typeof r.place_id === "string" &&
          r.map_slug === "proposals-" + map &&
          typeof r.created_at === "string",
      ),
    );
    for (const [user, page, role, code] of [
      [owner, 0, "authenticated", "P0001"],
      [owner, 100001, "authenticated", "P0001"],
      [null, 1, "anon", "42501"],
      [null, 1, "authenticated", "42501"],
    ]) {
      await c.query("savepoint denied");
      await assert.rejects(as(user, page, role), (e) => e.code === code);
      await c.query("rollback to savepoint denied");
    }
    await c.query(
      "insert into private.user_roles(user_id,role,suspended) values($1,'contributor',true)",
      [owner],
    );
    await c.query("savepoint suspended");
    await assert.rejects(as(owner), (e) => e.code === "42501");
    await c.query("rollback to savepoint suspended");
  } finally {
    await c.query("rollback");
  }
  console.log(
    "PASS: my proposals with owner_id column, own-author isolation, 21-row paging, moderation outcomes, empty pages and anonymous/suspended denial",
  );
}
