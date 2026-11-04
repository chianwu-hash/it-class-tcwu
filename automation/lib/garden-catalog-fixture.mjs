// Exact deployed growth function and catalogue, with synthetic student data only.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {setup} from './garden-level2-local-db.mjs';
const cid='grade3-115-1';
export async function setupCatalogFixture(snapshot){
 const source=JSON.parse(await fs.readFile(snapshot+'/database.json','utf8'));
 const expected=JSON.parse(await fs.readFile(snapshot+'/expected.json','utf8'));
 const db=await setup();
 await db.exec(`delete from garden_item_notices;delete from garden_item_unlocks;delete from garden_growth;delete from student_progress;delete from garden_reward_catalog;
 alter table garden_growth add column foundation_reward_version integer default 0;
 create table foundation_milestone_policy(id boolean,activated_at timestamptz);
 insert into foundation_milestone_policy values(true,now());
 create function foundation_milestone_rewards(text,jsonb) returns jsonb language sql as $$select '[]'::jsonb$$;`);
 await db.exec(source.growth);
 // Recreate the pre-fix defect even when the captured live catalogue is repaired.
 for(const c of source.catalog.filter(c=>!(c.course_id===cid&&c.week_code==='10'&&c.activity_key==='typing_task_5')))await db.query('insert into garden_reward_catalog values($1,$2,$3,$4,$5,$6)',[c.course_id,c.week_code,c.activity_key,c.kind,c.total_levels,c.reward_mode]);
 for(const r of expected.filter(r=>r.course_id===cid&&r.week_code!=='foundation'))await db.query('insert into student_progress values(auth.uid(),$1,$2,$3,$4,true)',[cid,r.week_code,r.activity_key,r.total_levels]);
 await db.query("select set_config('test.quiz',$1,false)",[JSON.stringify(Array.from({length:16},(_,i)=>({id:'synthetic-'+i,half_units:2})))]);
 const call=async(action='get')=>(await db.query('select garden_growth($1,$2) r',[cid,action])).rows[0].r;
 const model={rewards:[],stats:{leafCount:62,flowerCount:10},pendingLeaves:[],pendingFlowers:[]};
 const report={before:(await call()).level};assert.equal(report.before,1);
 const before=await db.query('select * from student_progress order by week_code,activity_key');
 await db.exec(await fs.readFile('supabase/garden-catalog-20261103.sql','utf8'));
 await db.exec(await fs.readFile('supabase/garden-catalog-20261103.sql','utf8'));
 assert.deepEqual((await db.query('select * from student_progress order by week_code,activity_key')).rows,before.rows);
 assert.equal((await db.query('select count(*) n from garden_growth')).rows[0].n,0);
 // Browser is responsible for the first real call and animation, not the migration.
 const expectedIds=[];
 for(const a of expected.filter(r=>r.course_id===cid&&r.week_code!=='foundation')){
  const prefix=`${cid}:${a.week_code}:${a.activity_key}:`;
  if(a.kind==='typing'){for(let i=1;i<a.total_levels;i++)expectedIds.push({id:prefix+'typing-leaf:'+i,kind:'typing-leaf'});expectedIds.push({id:prefix+'flower:'+a.total_levels,kind:'flower'});}
  else expectedIds.push({id:prefix+(a.kind==='quiz'?'quiz-leaf':'practical-leaf')+':1',kind:a.kind==='quiz'?'quiz-leaf':'practical-leaf'});
 }
 for(let i=0;i<16;i++)expectedIds.push({id:`${cid}:00:practice_synthetic-${i}:quiz-leaf:1`,kind:'quiz-leaf'});
 model.rewards=expectedIds.map(r=>({...r,title:r.id,href:'/grade3/115-1/week10.html'}));
 assert.equal(model.rewards.filter(r=>r.kind!=='flower').length,62);assert.equal(model.rewards.filter(r=>r.kind==='flower').length,10);
 return {db,model,call,report};
}
