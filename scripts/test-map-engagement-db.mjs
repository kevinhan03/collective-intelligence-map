import assert from 'node:assert/strict';
export async function testMapEngagement(c) {
  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', map='11111111-1111-4111-8111-111111111111';
  await c.query('begin');
  try {
    await c.query("insert into auth.users(id) values($1),($2) on conflict do nothing",[a,b]);
    // Existing fixture profiles are created by the auth trigger.
    const as = async (id, sql, values=[]) => {
      await c.query('set local role authenticated');
      await c.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
      return c.query(sql,values);
    };
    await as(a,'select public.set_map_hype($1,true)',[map]);
    await as(a,'select public.set_map_hype($1,true)',[map]);
    assert.equal((await as(a,'select count(*)::int n from public.map_hypes where map_id=$1',[map])).rows[0].n,1);
    assert.equal((await as(b,'select count(*)::int n from public.map_hypes where map_id=$1',[map])).rows[0].n,0);
    await as(b,'select public.set_map_hype($1,true)',[map]);
    await c.query('reset role');
    await c.query("update public.map_hypes set created_at=now()-interval '8 days' where user_id=$1 and map_id=$2",[a,map]);
    const result=(await as(a,'select public.set_map_hype($1,false) r',[map])).rows[0].r;
    assert.equal(result.hype_count,1); assert.equal(result.hype_week_count,1);
    const restored=(await as(a,'select public.set_map_hype($1,true) r',[map])).rows[0].r;
    assert.equal(restored.hype_count,2); assert.equal(restored.hype_week_count,1);
    await c.query('reset role');
    await c.query("update public.theme_maps set status='draft' where id=$1",[map]);
    await c.query('set local role anon');
    assert.equal((await c.query('select * from public.map_engagement_stats() where map_id=$1',[map])).rowCount,0);
    await c.query('savepoint denied');
    await assert.rejects(c.query('select public.set_map_hype($1,true)',[map]),e=>e.code==='42501');
    await c.query('rollback to savepoint denied');
    await c.query('reset role');
    await c.query("update public.theme_maps set status='published' where id=$1",[map]);
    await as(a,'select 1');
    await c.query('savepoint direct_write');
    await assert.rejects(c.query('insert into public.map_hypes(user_id,map_id) values($1,$2)',[b,map]),e=>e.code==='42501');
    await c.query('rollback to savepoint direct_write');
  } finally { await c.query('rollback'); }
  console.log('PASS: map Hype idempotency, own-row RLS, seven-day aging, toggle stability, visibility and write permissions');
}
