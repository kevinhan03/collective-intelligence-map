import assert from "node:assert/strict";
import fs from "node:fs/promises";
export async function testCreatorMaps(c) {
  const sql = await fs.readFile("docs/sql/add-creator-maps.sql", "utf8");
  await c.query(sql);
  await c.query(sql);
  // Reproduce a project that has never installed anonymous voting. Renaming
  // preserves older function dependencies; no optional relation is resolved.
  await c.query("begin");
  try {
    await c.query(
      "alter table public.anonymous_map_place_votes rename to creator_test_optional_votes",
    );
    const withoutTransaction = sql
      .replace(/^begin;\s*$/m, "")
      .replace(/^commit;\s*$/m, "");
    await c.query(withoutTransaction);
    await c.query(withoutTransaction);
    assert.equal(
      (
        await c.query(
          "select to_regclass('public.anonymous_map_place_votes') relation",
        )
      ).rows[0].relation,
      null,
    );
    assert.ok(
      (
        await c.query(
          "select to_regprocedure('public.creator_command(jsonb)') rpc",
        )
      ).rows[0].rpc,
    );
  } finally {
    await c.query("rollback");
  }
  assert.equal(
    (
      await c.query(
        "select count(*)::int n from pg_trigger where tgrelid='public.anonymous_map_place_votes'::regclass and tgname='guard_creator_vote'",
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: creator Editor SQL repeats with anonymous voting present or absent",
  );
  const a = "dd000000-0000-4000-8000-000000000001",
    b = "de000000-0000-4000-8000-000000000002",
    admin = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await c.query("insert into auth.users(id) values($1),($2)", [a, b]);
  async function as(user, fn, role = "authenticated") {
    await c.query("begin");
    try {
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user ?? "",
      ]);
      const result = await fn();
      await c.query("commit");
      return result;
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  }
  const command = (user, payload) =>
    as(
      user,
      async () =>
        (
          await c.query("select public.creator_command($1::jsonb) result", [
            JSON.stringify(payload),
          ])
        ).rows[0].result,
    );
  const m = (
    await command(a, {
      action: "create",
      title: "나만의 서울",
      description: "추천 지도",
      country: "KR",
    })
  ).id;
  const m2 = (
    await command(b, {
      action: "create",
      title: "도쿄",
      description: "",
      country: "JP",
    })
  ).id;
  await assert.rejects(
    command(b, { action: "status", mapId: m, status: "published" }),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    as(null, () => c.query("select public.creator_command('{}')"), "anon"),
    (e) => e.code === "42501",
  );
  const add = await command(a, {
    action: "add_place",
    mapId: m,
    name: "크리에이터 비공개 원본",
    address: "서울 용산구 테스트로 1",
    countryCode: "KR",
    lat: 37.54,
    lng: 126.99,
    rationale: "이 장소는 직접 방문해 추천하는 장소입니다.",
  });
  assert.equal(add.status, "draft");
  assert.equal(
    (
      await as(admin, () =>
        c.query("select * from public.theme_maps where id=$1", [m]),
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await as(admin, () =>
        c.query("select * from public.places where id=$1", [add.placeId]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    as(a, () =>
      c.query("select public.creator_add_resolved('{}',$1,'overture','test')", [
        a,
      ]),
    ),
    (e) => e.code === "42501",
  );
  assert.equal(
    (
      await as(
        null,
        () => c.query("select * from public.places where id=$1", [add.placeId]),
        "anon",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await as(
        null,
        () => c.query("select * from public.theme_maps where id=$1", [m]),
        "anon",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await as(b, () => c.query("select public.creator_places($1) result", [m])))
      .rows[0].result.length,
    0,
  );
  assert.ok(
    (
      await as(a, () =>
        c.query(
          "select public.search_internal_places('크리에이터',$1) result",
          [m],
        ),
      )
    ).rows[0].result.length,
  );
  assert.equal(
    (
      await as(b, () =>
        c.query(
          "select public.search_internal_places('크리에이터',$1) result",
          [m],
        ),
      )
    ).rows[0].result.length,
    0,
  );
  await assert.rejects(
    command(a, {
      action: "add_place",
      mapId: m,
      placeId: add.placeId,
      rationale: "짧음",
    }),
  );
  await assert.rejects(
    command(a, {
      action: "add_place",
      mapId: m,
      name: "일본 장소",
      address: "도쿄",
      countryCode: "JP",
      lat: 35.68,
      lng: 139.76,
      rationale: "일본에 있는 다른 장소입니다.",
    }),
  );
  await command(a, { action: "status", mapId: m, status: "published" });
  assert.equal(
    (
      await as(
        null,
        () => c.query("select public.creator_places($1) result", [m]),
        "anon",
      )
    ).rows[0].result.length,
    1,
  );
  assert.equal(
    (
      await c.query("select status from public.places where id=$1", [
        add.placeId,
      ])
    ).rows[0].status,
    "active",
  );
  await assert.rejects(
    command(a, {
      action: "profile",
      displayName: "test",
      bio: "",
      instagram: "",
      featuredMapId: m2,
    }),
  );
  await command(a, {
    action: "profile",
    displayName: "test",
    bio: "소개",
    instagram: "https://www.instagram.com/test/",
    featuredMapId: m,
  });
  await assert.rejects(command(a, { action: "order_maps", ids: [m, m] }));
  await assert.rejects(command(a, { action: "order_maps", ids: [m2] }));
  await assert.rejects(
    command(a, { action: "order_places", mapId: m, ids: [add.id, add.id] }),
  );
  const p2 = await command(a, {
    action: "add_place",
    mapId: m,
    name: "다음 장소",
    address: "서울 테스트로 2",
    countryCode: "KR",
    lat: 37.55,
    lng: 127,
    rationale: "다음으로 추천하는 좋은 장소입니다.",
  });
  await command(a, { action: "order_places", mapId: m, ids: [p2.id, add.id] });
  const search = (
    await as(
      null,
      () =>
        c.query("select public.search_map_places($1) result", [
          JSON.stringify({ mapId: m, q: "", sort: "relevance" }),
        ]),
      "anon",
    )
  ).rows[0].result;
  assert.equal(search.items[0].id, p2.id);
  const duplicate = await command(a, {
    action: "add_place",
    mapId: m,
    placeId: add.placeId,
    rationale: "중복으로 입력한 추천 근거입니다.",
  });
  assert.equal(duplicate.created, false);
  await command(a, { action: "remove_place", mapId: m, id: add.id });
  assert.equal(
    (
      await c.query("select status from public.places where id=$1", [
        add.placeId,
      ])
    ).rows[0].status,
    "active",
  );
  await assert.rejects(
    as(b, () =>
      c.query("select public.community_command($1)", [
        JSON.stringify({ action: "vote", id: p2.id, value: 1 }),
      ]),
    ),
    (e) => e.code === "42501",
  );
  const cover = await command(a, { action: "cover_reserve", mapId: m });
  await assert.rejects(
    command(a, { action: "cover", mapId: m, path: cover.path }),
  );
  await c.query(
    "insert into storage.objects(bucket_id,name) values('creator-map-covers',$1)",
    [cover.path],
  );
  await command(a, { action: "cover", mapId: m, path: cover.path });
  await assert.rejects(
    command(b, { action: "cover", mapId: m, path: cover.path }),
  );
  await command(a, { action: "status", mapId: m, status: "archived" });
  assert.equal(
    (
      await as(
        null,
        () => c.query("select * from public.theme_maps where id=$1", [m]),
        "anon",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await c.query(
        "select featured_map_id from public.creator_profiles where user_id=$1",
        [a],
      )
    ).rows[0].featured_map_id,
    null,
  );
  assert.equal(
    (
      await c.query(
        "select count(*)::int n from private.creator_cover_cleanup where path=$1",
        [cover.path],
      )
    ).rows[0].n,
    1,
  );
  await command(a, { action: "status", mapId: m, status: "published" });
  await as(b, () =>
    c.query("select public.creator_report($1,'부적절한 지도 정보입니다.')", [
      m,
    ]),
  );
  await assert.rejects(
    command(b, { action: "hide", mapId: m, reason: "운영자 검토로 숨김 처리" }),
    (e) => e.code === "42501",
  );
  await command(admin, {
    action: "hide",
    mapId: m,
    reason: "운영자 검토로 숨김 처리",
  });
  await assert.rejects(
    command(a, { action: "status", mapId: m, status: "published" }),
  );
  assert.equal(
    (
      await as(
        null,
        () => c.query("select public.creator_catalog() result"),
        "anon",
      )
    ).rows[0].result.some((x) => x.map.id === m),
    false,
  );
  await assert.rejects(
    as(b, () => c.query("select public.creator_admin_snapshot()")),
    (e) => e.code === "42501",
  );
  for (let i = 0; i < 9; i++)
    await command(a, {
      action: "create",
      title: `제한 ${i}`,
      description: "",
      country: "world",
    });
  await assert.rejects(
    command(a, {
      action: "create",
      title: "제한 초과",
      description: "",
      country: "world",
    }),
  );
  await c.query(
    "insert into private.user_roles(user_id,role,suspended) values($1,'contributor',true)",
    [b],
  );
  await assert.rejects(
    command(b, {
      action: "create",
      title: "정지 계정",
      description: "",
      country: "KR",
    }),
    (e) => e.code === "42501",
  );

  await assert.rejects(
    as(b, () => c.query("select public.creator_snapshot()")),
    (e) => e.code === "42501",
  );
  // Verify a 200-place map cannot exceed the cap without deleting shared places.
  const cap = await command(a, {
    action: "status",
    mapId: m,
    status: "archived",
  });
  void cap;
  const capMap = (
    await command(a, {
      action: "create",
      title: "장소 제한 검증",
      description: "",
      country: "world",
    })
  ).id;
  await c.query(
    `with p as (insert into public.places(name,address,category,location,country,city,status,created_by)
    select '한도 장소 '||x,'검증 주소 '||x,'기타',extensions.st_setsrid(extensions.st_makepoint(127,37),4326),'KR','서울','pending',$1 from generate_series(1,200) x returning id)
    insert into public.map_places(map_id,place_id,added_by,rationale,status) select $2,id,$1,'장소 수 제한을 검증하는 추천 이유','draft' from p`,
    [a, capMap],
  );
  await assert.rejects(
    command(a, {
      action: "add_place",
      mapId: capMap,
      name: "201번째 장소",
      address: "서울 다른 주소",
      countryCode: "KR",
      lat: 37,
      lng: 127,
      rationale: "이 지도에 추가할 다음 장소입니다.",
    }),
    (e) => e.message.includes("200"),
  );
  // Signed-server reference reuse shares the physical UUID across owner maps.
  const providerPayload = {
    mapId: capMap,
    name: "원천 후보",
    address: "서울 원천로",
    countryCode: "KR",
    lat: 37.5,
    lng: 127,
    rationale: "검증된 원천 후보의 추천 이유입니다.",
  };
  await assert.rejects(
    as(a, () =>
      c.query(
        "select public.creator_add_resolved($1,$2,'overture','creator-source')",
        [JSON.stringify(providerPayload), a],
      ),
    ),
  );
  const providerMap = await command(a, {
    action: "status",
    mapId: capMap,
    status: "archived",
  });
  void providerMap;
  const sourceMap = (
    await command(a, {
      action: "create",
      title: "원천 후보 지도",
      description: "",
      country: "KR",
    })
  ).id;
  const sourcePayload = { ...providerPayload, mapId: sourceMap };
  const resolved = (
    await as(
      null,
      () =>
        c.query(
          "select public.creator_add_resolved($1,$2,'overture','creator-source') result",
          [JSON.stringify(sourcePayload), a],
        ),
      "service_role",
    )
  ).rows[0].result;
  const repeated = (
    await as(
      null,
      () =>
        c.query(
          "select public.creator_add_resolved($1,$2,'overture','creator-source') result",
          [JSON.stringify(sourcePayload), a],
        ),
      "service_role",
    )
  ).rows[0].result;
  assert.equal(repeated.placeId, resolved.placeId);
  assert.equal(repeated.created, false);
  // An independent public place appearing after draft creation wins at publication.
  const canonical = (
    await c.query(
      "insert into public.places(name,address,category,location,country,city,status,created_by) values('원천 후보','서울 원천로','기타',extensions.st_setsrid(extensions.st_makepoint(127,37.5),4326),'KR','서울','active',$1) returning id",
      [admin],
    )
  ).rows[0].id;
  await c.query(
    "insert into public.map_places(map_id,place_id,added_by,rationale,status) values('11111111-1111-4111-8111-111111111111',$1,$2,'공개 장소 중복을 검증하는 추천 근거','approved')",
    [canonical, admin],
  );
  await command(a, { action: "status", mapId: sourceMap, status: "published" });
  assert.equal(
    (
      await c.query("select place_id from public.map_places where id=$1", [
        resolved.id,
      ])
    ).rows[0].place_id,
    canonical,
  );
  assert.equal(
    (
      await c.query(
        "select place_id from private.place_provider_refs where provider='overture' and external_id='creator-source'",
      )
    ).rows[0].place_id,
    canonical,
  );
  const check = await c.query(
    await fs.readFile("docs/sql/check-creator-maps.sql", "utf8"),
  );
  const row = check[0].rows[0];
  assert.ok(
    Object.entries(row)
      .filter(([key]) => key !== "database_size")
      .every(([, v]) => v === true),
  );
  console.log(
    "PASS: creator SQL repeats; member ownership, draft privacy, scoped search, publication, curated order, duplicate reuse, removal, covers, moderation, map limits and suspension",
  );
}
