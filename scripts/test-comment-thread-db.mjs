import assert from "node:assert/strict";
export async function testCommentThread(c) {
  const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const place = (
    await c.query(
      "select id from public.map_places where private.public_map_place(id) limit 1",
    )
  ).rows[0].id;
  const ids = (
    await c.query(
      "insert into public.comments(map_place_id,author_id,body) select $1,$2,'Thread test ' || n from generate_series(1,35) n returning id",
      [place, a],
    )
  ).rows.map((r) => r.id);
  async function as(user, fn, role = "authenticated") {
    await c.query("begin");
    try {
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user || "",
      ]);
      const result = await fn();
      await c.query("commit");
      return result;
    } catch (error) {
      await c.query("rollback");
      throw error;
    }
  }
  const like = (user, enabled) =>
    as(user, () =>
      c.query("select public.set_comment_like($1,$2) result", [
        ids[0],
        enabled,
      ]),
    );
  const read = (user, offset = 0) =>
    as(
      user,
      () =>
        c.query("select public.place_comment_thread($1,$2,30) result", [
          place,
          offset,
        ]),
      user ? "authenticated" : "anon",
    );
  assert.equal((await like(a, true)).rows[0].result.likes, 1);
  assert.equal((await like(a, true)).rows[0].result.likes, 1);
  assert.equal((await like(b, true)).rows[0].result.likes, 2);
  assert.equal((await like(a, false)).rows[0].result.likes, 1);
  const own = (await read(b)).rows[0].result;
  const ownComment =
    own.comments.find((x) => x.id === ids[0]) ??
    (await read(b, 30)).rows[0].result.comments.find((x) => x.id === ids[0]);
  assert.equal(ownComment.liked, true);
  assert.equal(ownComment.likes, 1);
  const anonymous = (await read(null)).rows[0].result;
  assert.ok(anonymous.comments.every((x) => x.liked === false));
  assert.equal(anonymous.comments.length, 30);
  assert.ok((await read(null, 30)).rows[0].result.comments.length >= 5);
  await assert.rejects(
    as(
      null,
      () => c.query("select public.set_comment_like($1,true)", [ids[0]]),
      "anon",
    ),
  );
  await assert.rejects(
    as(b, () => c.query("select * from private.comment_likes")),
  );
  await c.query("update public.comments set status='hidden' where id=$1", [
    ids[0],
  ]);
  await assert.rejects(like(b, true));
  await c.query(
    "update public.comments set status='visible',kind='introduction' where id=$1",
    [ids[0]],
  );
  await assert.rejects(like(b, true));
  console.log(
    "PASS: comment pagination, public counts/private identities, own likes, idempotence, unlike, anonymous/hidden/introduction denial",
  );
}
