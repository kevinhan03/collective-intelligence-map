import assert from "node:assert/strict";
export async function testProposalSearch(c) {
  await c.query("begin");
  try {
    const region = "71717171-7171-4171-8171-717171717171";
    const country = "72727272-7272-4272-8272-727272727272";
    const world = "73737373-7373-4373-8373-737373737373";
    const dateline = "74747474-7474-4474-8474-747474747474";
    const member = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await c.query(
      `insert into public.theme_maps(id,slug,title,description,rules,country,city,bounds,status,search_scope) values
      ($1,'proposal-region','지역','test','test','JP','도쿄','{"west":139,"east":140,"south":35,"north":36}','published','region'),
      ($2,'proposal-country','국가','test','test','JP','일본','{"west":139,"east":140,"south":35,"north":36}','published','country'),
      ($3,'proposal-world','세계','test','test',null,'세계','{"west":-180,"east":180,"south":-90,"north":90}','published','world'),
      ($4,'proposal-dateline','경계','test','test','FJ','test','{"west":170,"east":-170,"south":-10,"north":10}','published','region')`,
      [region, country, world, dateline],
    );
    await c.query(`insert into public.our_search_places(source,source_id,primary_name,alternate_names,country_code,latitude,longitude,search_text,release) values
      ('overture','scope-1','Scope Vintage',ARRAY['別名'],'JP',35.5,139.5,'Scope Vintage 別名','test'),
      ('overture','scope-2','Scope Vintage Kyoto','{}','JP',35,135,'Scope Vintage Kyoto','test'),
      ('overture','scope-3','Scope Vintage France','{}','FR',48.8,2.3,'Scope Vintage France','test'),
      ('overture','scope-4','Scope Boundary East','{}','FJ',0,179,'Scope Boundary East','test'),
      ('overture','scope-5','Scope Boundary West','{}','FJ',0,-179,'Scope Boundary West','test'),
      ('overture','scope-6','Scope Boundary Outside','{}','FJ',0,0,'Scope Boundary Outside','test')`);
    const rpc = async (query, map, role = "service_role") => {
      await c.query("savepoint scope_request");
      await c.query(`set local role ${role}`);
      try {
        const r = (
          await c.query("select public.search_overture_places($1,$2) items", [
            query,
            map,
          ])
        ).rows[0].items;
        await c.query("reset role");
        await c.query("release savepoint scope_request");
        return r;
      } catch (e) {
        await c.query("rollback to savepoint scope_request");
        throw e;
      }
    };
    assert.equal(
      (
        await c.query(
          "select to_regclass('public.proposal_search_names') names",
        )
      ).rows[0].names,
      null,
    );

    await c.query(`insert into public.our_search_places(source,source_id,primary_name,alternate_names,country_code,latitude,longitude,search_text,release) values
      ('overture','rank-1','Ranking Shop Extra','{}','JP',35.5,139.5,'Ranking Shop Extra','test'),
      ('overture','rank-2','Other Ranking Shop','{}','JP',35.5,139.5,'Other Ranking Shop','test'),
      ('overture','rank-3','Alias Shop',ARRAY['Ranking Shop'],'JP',35.5,139.5,'Alias Shop Ranking Shop','test'),
      ('overture','rank-4','Ranking Shop','{}','JP',35.5,139.5,'Ranking Shop','test')`);
    assert.deepEqual(
      (await rpc("Ranking Shop", region)).map((p) => p.externalId),
      ["rank-4", "rank-3", "rank-1", "rank-2"],
    );
    assert.deepEqual(
      (await rpc("  ＲＡＮＫＩＮＧ　SHOP  ", region)).map((p) => p.externalId),
      ["rank-4", "rank-3", "rank-1", "rank-2"],
    );
    await c.query(`insert into public.our_search_places(source,source_id,primary_name,country_code,latitude,longitude,search_text,release)
      select 'overture','limit-'||lpad(i::text,2,'0'),'Limited Shop '||i,'JP',35.5,139.5,'Limited Shop '||i,'test' from generate_series(1,15)i`);
    assert.equal((await rpc("Limited", region)).length, 10);
    assert.deepEqual(
      (await rpc("Limited", region)).map((p) => p.externalId),
      Array.from(
        { length: 10 },
        (_, i) => `limit-${String(i + 1).padStart(2, "0")}`,
      ),
    );
    assert.equal((await rpc("L", region)).length, 0);
    assert.equal((await rpc("x".repeat(101), region)).length, 0);
    assert.equal((await rpc("scope_", world)).length, 0);
    assert.equal((await rpc("scope\\", world)).length, 0);
    const inside = (
      await c.query("select public.overture_place_details($1,$2) item", [
        "scope-1",
        region,
      ])
    ).rows[0].item;
    const outside = (
      await c.query("select public.overture_place_details($1,$2) item", [
        "scope-2",
        region,
      ])
    ).rows[0].item;
    assert.ok(inside);
    assert.equal(outside, null);

    await c.query("set local role service_role");
    await c.query(`insert into public.our_search_places(source,source_id,primary_name,country_code,latitude,longitude,search_text,release)
      values('overture','scope-service-write','Service Test','JP',35.5,139.5,'Service Test','test')`);
    await c.query("reset role");
    assert.equal((await rpc("service test", region)).length, 1);
    assert.equal((await rpc("scope vintage", region)).length, 1);
    assert.equal((await rpc("scope vintage", country)).length, 2);
    assert.equal((await rpc("scope vintage", world)).length, 3);
    assert.equal((await rpc("scope boundary", dateline)).length, 2);
    assert.equal((await rpc("別名", region))[0].matchType, "exact");
    assert.equal((await rpc("ＶＩＮＴＡＧＥ", region)).length, 1);
    assert.equal((await rpc("scope%", world)).length, 0);
    await assert.rejects(() => rpc("scope", world, "anon"));
    await assert.rejects(() => rpc("scope", world, "authenticated"));
    await c.query("update public.theme_maps set status='draft' where id=$1", [
      world,
    ]);
    assert.deepEqual(await rpc("scope", world), []);
    await c.query(
      "update public.theme_maps set status='published' where id=$1",
      [world],
    );
    await c.query(
      "update public.our_search_places set primary_name='Updated Scope', alternate_names='{}',search_text='Updated Scope' where source_id='scope-1'",
    );
    assert.equal((await rpc("別名", region)).length, 0);
    assert.equal((await rpc("updated", region)).length, 1);
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
      member,
    ]);
    const submit = async (map, countryCode, lat, lng, name) => {
      await c.query("savepoint proposal");
      try {
        const r = (
          await c.query("select public.submit_proposal_result($1) result", [
            JSON.stringify({
              mapId: map,
              countryCode,
              lat,
              lng,
              name,
              address: "Scope test address",
              rationale: "테스트 추천 이유",
              sourceNote: "사용자가 직접 확인한 테스트 장소입니다.",
            }),
          ])
        ).rows[0].result;
        await c.query("release savepoint proposal");
        return r;
      } catch (e) {
        await c.query("rollback to savepoint proposal");
        throw e;
      }
    };
    const global = await submit(world, "FR", 48.8, 2.3, "Scope French Place");
    const national = await submit(
      country,
      undefined,
      35,
      135,
      "Scope Kyoto Place",
    );
    await submit(dateline, undefined, 0, -179, "Scope Dateline Place");
    await assert.rejects(() =>
      submit(region, undefined, 35, 135, "Outside Region"),
    );
    await assert.rejects(() =>
      submit(world, undefined, 48, 2, "Missing Country"),
    );
    await c.query("reset role");
    assert.equal(
      (
        await c.query("select country from public.places where id=$1", [
          global.placeId,
        ])
      ).rows[0].country,
      "FR",
    );
    assert.equal(
      (
        await c.query("select country from public.places where id=$1", [
          national.placeId,
        ])
      ).rows[0].country,
      "JP",
    );
    await c.query(
      "update public.map_places set status='approved' where id=any($1::uuid[])",
      [[global.id, national.id]],
    );
    await c.query(
      "update public.places set status='active' where id=any($1::uuid[])",
      [[global.placeId, national.placeId]],
    );
    await c.query("set local role anon");
    const internal = (
      await c.query("select public.search_internal_places('scope',$1) items", [
        world,
      ])
    ).rows[0].items;
    assert.ok(internal.some((p) => p.id === global.placeId));
    assert.ok(internal.some((p) => p.id === national.placeId));
    const regional = (
      await c.query("select public.search_internal_places('scope',$1) items", [
        region,
      ])
    ).rows[0].items;
    assert.ok(
      !regional.some(
        (p) => p.id === global.placeId || p.id === national.placeId,
      ),
    );
    console.log(
      "PASS: proposal search region/country/world, dateline, ranking, width normalization, source refresh without duplicated index, service permissions and submission country",
    );
  } finally {
    await c.query("rollback");
  }
}
