import assert from "node:assert/strict";
export async function testMapSearch(c) {
  await c.query("begin");
  try {
    const map = "89898989-8989-4989-8989-898989898989";
    await c.query(
      `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status) values($1,'search-db-fixture','검색 테스트','테스트','테스트','KR','서울','{"west":126.75,"south":37.35,"east":127.25,"north":37.75}','published')`,
      [map],
    );
    await c.query(
      `with p as (insert into public.places(name,address,category,location,country,city,status)
      select 'Fixture '||lpad(i::text,4,'0'),'서울 용산구','thrift_store',extensions.st_setsrid(extensions.st_makepoint(127+i/100000.0,37.5),4326),'KR','서울','active' from generate_series(1,525)i returning id)
      insert into public.map_places(map_id,place_id,rationale,status) select $1,id,'추천할 만한 빈티지 가게','approved' from p`,
      [map],
    );
    const search = async (args = {}, role = "anon") => {
      await c.query("savepoint search_request");
      await c.query(`set local role ${role}`);
      try {
        const result = (
          await c.query("select public.search_map_places($1) result", [
            JSON.stringify({ mapId: map, ...args }),
          ])
        ).rows[0].result;
        await c.query("reset role");
        await c.query("release savepoint search_request");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint search_request");
        throw error;
      }
    };
    assert.equal((await search({ q: "fixture" })).total, 525);
    assert.equal(
      (await search({ q: "fixture", offset: 500 })).items.length,
      20,
    );
    assert.equal((await search({ q: "fixture", offset: 520 })).items.length, 5);
    assert.equal(
      (await search({ q: "ＦＩＸＴＵＲＥ　0525" })).items[0].name,
      "Fixture 0525",
    );
    assert.equal((await search({ q: "용산 빈티지숍" })).total, 525);
    assert.equal((await search({ q: "용산 부산" })).total, 0);
    assert.equal((await search({ q: "%" })).total, 0);
    const ids = (
      await c.query(
        "select id,place_id from public.map_places where map_id=$1 order by id limit 5",
        [map],
      )
    ).rows;
    for (const [i, status] of [
      "pending",
      "rejected",
      "archived",
      "draft",
      "disputed",
    ].entries())
      await c.query("update public.map_places set status=$1 where id=$2", [
        status,
        ids[i].id,
      ]);
    assert.equal((await search({ q: "fixture" })).total, 521);
    await c.query("update public.places set status='archived' where id=$1", [
      ids[4].place_id,
    ]);
    assert.equal((await search({ q: "fixture" })).total, 520);
    assert.equal((await search({ q: "fixture" }, "authenticated")).total, 520);
    await c.query(
      "update public.rail_station_regions set updated_at=now() where id='seoul'",
    );
    await c.query(`insert into public.rail_stations(id,region_id,name,local_name,kind,lat,lng) values
      ('search-station','seoul','검색역','검색역','subway',37.5,127),('search-train','seoul','검색역','검색역','train',37.5,127.001)`);
    const suggestions = (await search({ q: "검색역" })).suggestions;
    assert.equal(suggestions.filter((s) => s.kind === "station").length, 2);
    assert.equal((await search({ q: "검색역" })).total, 0); // No implicit station filter.
    const stationResult = await search({
      stationId: "search-station",
      q: "빈티지",
    });
    assert.equal(stationResult.total, 520);
    assert.equal(stationResult.station.id, "search-station");
    assert.ok(
      stationResult.items.every(
        (p) => p.station_distance_m >= 0 && p.station_distance_m <= 2000,
      ),
    );
    await c.query(
      `with p as (insert into public.places(name,address,category,location,country,city,status)
     select 'Boundary '||d,'서울 용산구','thrift_store',extensions.st_project(extensions.st_setsrid(extensions.st_makepoint(127,37.5),4326)::extensions.geography,d,0)::extensions.geometry,'KR','서울','active'
     from unnest(array[1999.9,2000.1])d returning id)
     insert into public.map_places(map_id,place_id,rationale,status) select $1,id,'경계 거리 검증용 장소','approved' from p`,
      [map],
    );
    assert.equal(
      (await search({ stationId: "search-station", q: "boundary" })).total,
      1,
    );
    const normalizeSamples = [
      "　ＡＲＣＨＩＶＥ\tRoom　",
      "빈티지\n 숍",
      "100%_가게",
      "\uFEFF Foo\u00a0Bar",
    ];
    for (const value of normalizeSamples)
      assert.equal(
        (await c.query("select public.search_normalize($1) value", [value]))
          .rows[0].value,
        value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(),
      );
    await c.query("update public.theme_maps set status='draft' where id=$1", [
      map,
    ]);
    assert.equal(await search({ q: "fixture" }), null);
    console.log(
      "PASS: map-wide search beyond 500, normalization/AND/category matching, paging, explicit station filters/2km boundary and public visibility",
    );
  } finally {
    await c.query("rollback");
  }
}
