import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {setupMatchDB} from '../fixtures/partner-match-db.mjs';
test('20-second migration preserves in-flight deadlines and existing records; repeatable',async()=>{
 const f=await setupMatchDB(),{db,call}=f;
 try{
  await db.exec('alter table partner_pilot.match_settings drop constraint match_settings_batch_seconds_check;alter table partner_pilot.match_settings alter column batch_seconds set default 30;update partner_pilot.match_settings set batch_seconds=30;alter table partner_pilot.match_settings add constraint match_settings_batch_seconds_check check(batch_seconds=30);update partner_pilot.match_settings set enabled=true;');
  const waiting=await call(2,{action:'join'});assert(Math.abs(Date.parse(waiting.deadline)-Date.parse(waiting.now)-30000)<1000);
  const before=(await db.query('select (select count(*) from partner_pilot.rooms) rooms,(select count(*) from partner_pilot.awards) awards,(select count(*) from partner_pilot.match_presence) presence')).rows;
  const sql=await fs.readFile('supabase/quiz-partner-match-20-seconds.sql','utf8');await db.exec(sql);await db.exec(sql);
  assert.equal((await call(2,{action:'status'})).deadline,waiting.deadline);
  assert.deepEqual((await db.query('select (select count(*) from partner_pilot.rooms) rooms,(select count(*) from partner_pilot.awards) awards,(select count(*) from partner_pilot.match_presence) presence')).rows,before);
  assert((await db.query('select batch_seconds from partner_pilot.match_settings')).rows.every(r=>r.batch_seconds===20));
  await assert.rejects(db.exec('update partner_pilot.match_settings set batch_seconds=30'),/check constraint/);
  await db.exec('update partner_pilot.match_settings set grade=grade');
 }finally{await db.close();}
});
