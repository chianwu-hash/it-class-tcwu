import {test} from 'node:test';import assert from 'node:assert/strict';
import {setupCatalogFixture} from '../lib/garden-catalog-fixture.mjs';
const snapshot=process.env.GARDEN_CATALOG_SNAPSHOT;
test('deployed growth function upgrades 62/10 only after missing task is registered',{skip:!snapshot},async()=>{
 const {db,model,call}=await setupCatalogFixture(snapshot);try{
  const first=await call();assert.equal(first.level,2);assert.equal(first.seen,false);assert.equal(first.order.length,72);
  assert.deepEqual(new Set(first.order.map(r=>r.id)),new Set(model.rewards.map(r=>r.id)));
  const baseline=first.baseline;await call('seen');const next=await call();assert.equal(next.seen,true);assert.deepEqual(next.baseline,baseline);
  assert.equal((await db.query('select count(*) n from garden_growth')).rows[0].n,1);
  await db.query("select set_config('test.uid','00000000-0000-4000-8000-000000000002',false)");assert.equal((await call()).level,1);
  await db.query("select set_config('test.teacher','yes',false)");await assert.rejects(call(),/student_required/);
 }finally{await db.close()}
});
