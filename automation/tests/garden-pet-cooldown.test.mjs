import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {setup,leaves,growth} from '../lib/garden-level2-local-db.mjs';
import {createPetVisitClient} from '../../shared/garden-pet-visit.mjs';
const cid='grade3-115-1',first='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
test('server cooldown is shared, fixed for five minutes, detects rapid visits, preserves rewards/preferences',async()=>{
 const db=await setup();try{
  await leaves(db,48);await growth(db);
  const visit=async()=>(await db.query('select garden_pet_visit($1) r',[cid])).rows[0].r;
  assert.deepEqual(await visit(),{surprise:false,refreshMessage:false});assert.equal((await db.query('select count(*) n from garden_pet_visits')).rows[0].n,0);
  await db.query("select garden_companions($1,'save',$2)",[cid,{pet:'cat',petMode:'rest'}]);
  const snapshot=async()=>JSON.stringify((await db.query('select (select jsonb_agg(to_jsonb(x)) from student_progress x) p,(select jsonb_agg(to_jsonb(x)) from garden_growth x) g,(select jsonb_agg(to_jsonb(x)) from garden_companion_choices x) c')).rows);
  const before=await snapshot(),a=await visit();assert.equal(typeof a.surprise,'boolean');assert.equal(a.refreshMessage,false);
  const start=(await db.query('select * from garden_pet_visits')).rows[0];assert(Math.abs((Date.parse(start.next_roll_at)-Date.parse(start.refresh_window_at))-300000)<10);
  const b=await visit();assert.equal(b.surprise,false);assert.equal(b.refreshMessage,false);assert.equal(b.cooldownUntil,a.cooldownUntil);
  // Changing species does not open a new cooldown bucket.
  await db.query("select garden_companions($1,'save',$2)",[cid,{pet:'dog',petMode:'rest'}]);
  const c=await visit();assert.equal(c.surprise,false);assert.equal(c.refreshMessage,true);assert.equal(c.cooldownUntil,a.cooldownUntil);
  await db.exec("update garden_pet_visits set refresh_window_at=clock_timestamp()-interval '61 seconds'");
  assert.equal((await visit()).refreshMessage,false);assert.equal((await visit()).cooldownUntil,a.cooldownUntil);
  await db.exec("update garden_pet_visits set next_roll_at=clock_timestamp()-interval '1 second'");
  const next=await visit();assert(Date.parse(next.cooldownUntil)>Date.parse(a.cooldownUntil));assert.equal(next.refreshMessage,false);
  await db.query("select garden_companions($1,'save',$2)",[cid,{pet:'cat',petMode:'rest'}]);
  // Restore explicit test changes before checking production data immutability.
  await db.query("update garden_companion_choices set modes=jsonb_set(modes,'{dog}','\"walk\"'),updated_at=(($1::jsonb)->0->'c'->0->>'updated_at')::timestamptz where user_id=auth.uid()",[before]);
  assert.equal(await snapshot(),before);
  await db.exec(await fs.readFile('supabase/garden-pet-visit.sql','utf8'));assert.equal((await visit()).surprise,false);
  await db.query("select set_config('test.uid',$1,false)",[other]);assert.deepEqual(await visit(),{surprise:false,refreshMessage:false});
  assert.equal((await db.query('select count(*) n from garden_pet_visits')).rows[0].n,1);
  await db.query("select set_config('test.uid',$1,false)",[first]);await db.exec("select set_config('test.teacher','yes',false)");await assert.rejects(visit,/student_required/);await db.exec("select set_config('test.teacher','no',false)");
  await assert.rejects(db.query('select garden_pet_visit(null)'),/invalid_request/);
  await db.exec('set role anon');await assert.rejects(visit,/permission denied/);await db.exec('reset role');
  await db.exec('set role authenticated');await assert.rejects(db.query('update garden_pet_visits set next_roll_at=now()'),/permission denied/);await db.exec('reset role');
 }finally{await db.close()}
});
test('one RPC per student/page, accepts server decision, fails closed and times out without reattempts',async()=>{
 let n=0;const api=createPetVisitClient({rpc:async()=>{n++;return {data:{surprise:true,refreshMessage:false}}}});
 const [a,b]=await Promise.all([api.get('one',cid),api.get('one',cid)]);assert(a.surprise&&b.surprise);assert.equal(n,1);await api.get('one','grade3-114-2');assert.equal(n,1);await api.get('two',cid);assert.equal(n,2);
 const failed=createPetVisitClient({rpc:()=>new Promise(()=>{})},{timeoutMs:20});assert.deepEqual(await failed.get('one',cid),{surprise:false,refreshMessage:false});
});
