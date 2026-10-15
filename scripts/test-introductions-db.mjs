import assert from "node:assert/strict";
import fs from "node:fs/promises";

export async function testIntroductions(c) {
  // Legacy SQL Editor compatibility tests reinstall older functions; reapply this
  // migration so the final database represents the current application.
  const sql = await fs.readFile(
    "supabase/migrations/20261015061536_optional_place_introductions.sql",
    "utf8",
  );
  await c.query(sql);
  await c.query(sql);
  const a = "ae000000-0000-4000-8000-000000000001";
  const b = "be000000-0000-4000-8000-000000000002";
  const admin = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await c.query("insert into auth.users(id) values($1),($2)", [a, b]);
  async function as(user, run, role = "authenticated") {
    await c.query("begin");
    try {
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user ?? "",
      ]);
      const result = await run();
      await c.query("commit");
      return result;
    } catch (error) {
      await c.query("rollback");
      throw error;
    }
  }
  const command = (user, payload) =>
    as(user, () =>
      c.query("select public.community_command($1::jsonb) result", [
        JSON.stringify(payload),
      ]),
    );
  const proposal = {
    mapId: "11111111-1111-4111-8111-111111111111",
    name: "Optional introduction shop",
    address: "Test introduction street",
    category: "편집숍",
    lat: 35.67,
    lng: 139.71,
    sourceNote: "독립적으로 생성한 테스트 장소의 출처입니다.",
  };
  const created = await as(admin, () =>
    c.query("select public.submit_proposal_result($1::jsonb) result", [
      JSON.stringify(proposal),
    ]),
  );
  const id = created.rows[0].result.id;
  assert.equal(
    (await c.query("select rationale from public.map_places where id=$1", [id]))
      .rows[0].rationale,
    "",
  );
  await assert.rejects(
    as(admin, () =>
      c.query("select public.submit_proposal_result($1::jsonb)", [
        JSON.stringify({ ...proposal, rationale: "x".repeat(1001) }),
      ]),
    ),
  );
  const save = (user, text, editId = null, target = id) =>
    as(user, () =>
      c.query("select public.save_place_introduction($1,$2,$3) id", [
        target,
        text,
        editId,
      ]),
    );
  const first = (await save(a, "첫 번째 방문자의 소개입니다.")).rows[0].id;
  const second = (await save(b, "두 번째 방문자의 다른 소개입니다.")).rows[0]
    .id;
  assert.equal(
    (
      await as(
        null,
        () =>
          c.query(
            "select id from public.comments where map_place_id=$1 and kind='introduction' and status='visible'",
            [id],
          ),
        "anon",
      )
    ).rowCount,
    2,
  );
  await assert.rejects(
    as(
      null,
      () =>
        c.query("select public.save_place_introduction($1,'익명 소개',null)", [
          id,
        ]),
      "anon",
    ),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    as(b, () =>
      c.query("update public.comments set body='직접 변경' where id=$1", [
        first,
      ]),
    ),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    save(b, "다른 사람의 소개 변경", first),
    (e) => e.code === "42501",
  );
  await save(a, "본인의 소개를 수정했습니다.", first);
  assert.equal(
    (await c.query("select body from public.comments where id=$1", [first]))
      .rows[0].body,
    "본인의 소개를 수정했습니다.",
  );
  await assert.rejects(save(a, " "));
  await assert.rejects(save(a, "x".repeat(1001)));
  await command(b, {
    action: "report",
    id: first,
    target: "comment",
    reason: "장소와 무관한 내용을 확인해 주세요.",
  });
  assert.equal(
    (
      await c.query("select id from public.reports where comment_id=$1", [
        first,
      ])
    ).rowCount,
    1,
  );
  await command(admin, {
    action: "hide_comment",
    id: first,
    reason: "관리자가 숨김 처리한 소개입니다.",
  });
  await assert.rejects(
    save(a, "숨겨진 소개를 다시 공개", first),
    (e) => e.code === "42501",
  );
  assert.equal(
    (
      await as(
        null,
        () => c.query("select id from public.comments where id=$1", [first]),
        "anon",
      )
    ).rowCount,
    0,
  );
  await assert.rejects(command(a, { action: "delete_comment", id: second }));
  await command(b, { action: "delete_comment", id: second });
  assert.equal(
    (
      await as(
        null,
        () => c.query("select id from public.comments where id=$1", [second]),
        "anon",
      )
    ).rowCount,
    0,
  );
  await c.query(
    "insert into private.user_roles(user_id,role,suspended) values($1,'contributor',true)",
    [a],
  );
  await assert.rejects(
    save(a, "정지된 사용자의 소개"),
    (e) => e.code === "42501",
  );
  const creator = async (user, payload) =>
    (
      await as(user, () =>
        c.query("select public.creator_command($1::jsonb) result", [
          JSON.stringify(payload),
        ]),
      )
    ).rows[0].result;
  const map = await creator(b, {
    action: "create",
    title: "소개 선택 테스트",
    description: "",
    country: "JP",
  });
  const draft = await creator(b, {
    action: "add_place",
    mapId: map.id,
    name: "빈 소개의 개인 지도 장소",
    address: "Tokyo test",
    lat: 35.68,
    lng: 139.72,
    countryCode: "JP",
  });
  await assert.rejects(save(b, "비공개 장소의 소개", null, draft.id));
  await creator(b, { action: "status", mapId: map.id, status: "published" });
  await save(b, "공개된 뒤 소개를 추가합니다.", null, draft.id);
  await creator(b, {
    action: "edit_place",
    mapId: map.id,
    id: draft.id,
    rationale: "",
  });
  console.log(
    "PASS: optional proposals/creator publication, shared introductions, ownership, guest access, suspension, reports and moderation",
  );
}
