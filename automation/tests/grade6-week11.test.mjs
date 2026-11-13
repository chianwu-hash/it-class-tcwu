import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {setup} from '../lib/garden-level2-local-db.mjs';
import {splitSnapshot} from '../lib/db-snapshot.mjs';
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
async function dataModule(p){let s=await read(p);for(const m of [...s.matchAll(/from ["'](\.\/[^"']+)["']/g)])s=s.replace(m[0],`from '${await dataModule('shared/'+m[1].slice(2).split('?')[0])}'`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64');}
const {deriveRewardTreeModel}=await import(await dataModule('shared/reward-tree-model.js'));
const {getRewardTreeCourse}=await import(await dataModule('shared/reward-tree-config.js'));
const cid='grade6-115-1',activities=getRewardTreeCourse(cid).activities.filter(a=>a.weekCode==='11');
test('六年級新三活動識別獨立、0～4／5／6關葉花一致，舊活動保留',()=>{
 assert.equal(activities.length,3);
 for(let n=0;n<=6;n++){
  const rows=[{course_id:cid,week_code:'11',activity_key:'typing_task_6',current_level:Math.min(n+1,6),completed:n===6}];
  const model=deriveRewardTreeModel(rows,activities);
  assert.equal(model.stats.leafCount,n>=5?1:0);assert.equal(model.stats.flowerCount,n===6?1:0);
 }
 const rows=activities.map(a=>({course_id:cid,week_code:'11',activity_key:a.activityKey,current_level:a.totalLevels,completed:true}));
 const model=deriveRewardTreeModel(rows,activities);assert.equal(model.stats.leafCount,1);assert.equal(model.stats.flowerCount,3);
 assert.ok(getRewardTreeCourse(cid).activities.some(a=>a.weekCode==='09'&&a.activityKey==='typing_task_5'&&a.rewardMode!=='five-then-flower'));
});
test('正式 growth 定義在隔離 PostgreSQL 執行：六年級目錄可重跑、衝突拒絕，邊界與前端相同',async()=>{
 const db=await setup();try{
  await db.exec(`alter table garden_growth add column foundation_reward_version integer default 1;
  create table foundation_milestone_policy(id boolean,activated_at timestamptz);
  create function foundation_milestone_rewards(text,jsonb) returns jsonb language sql as $$select '[]'::jsonb$$;
  create function quiz_partner_reward_ids(text) returns jsonb language sql as $$select '[]'::jsonb$$;
  update student_enrollments set class_code='604';
  insert into garden_reward_catalog select 'grade6-115-1',week_code,activity_key,kind,total_levels,reward_mode from garden_reward_catalog where course_id='grade3-115-1';
  insert into student_progress select user_id,'grade6-115-1',week_code,activity_key,current_level,completed from student_progress where course_id='grade3-115-1';`);
  const growth=splitSnapshot(await read('supabase/production-snapshot/functions.sql')).find(x=>x.signature==='garden_growth(text,text)');await db.exec(growth.definition+';');
  const sql=await read('supabase/grade6-week11-catalog.sql');const before=(await db.query('select * from student_progress')).rows;
  await db.exec(sql);await db.exec(sql);assert.deepEqual((await db.query('select * from student_progress')).rows,before);
  assert.equal((await db.query("select count(*) n from garden_reward_catalog where course_id=$1 and week_code='11'",[cid])).rows[0].n,3);
  await db.query('select garden_growth($1)',[cid]);
  for(let n=0;n<=6;n++){
   await db.query("delete from student_progress where course_id=$1 and week_code='11'",[cid]);
   if(n)await db.query("insert into student_progress values(auth.uid(),$1,'11','typing_task_6',$2,$3)",[cid,Math.min(n+1,6),n===6]);
   const actual=(await db.query('select garden_growth($1) r',[cid])).rows[0].r;
   assert.equal(actual.newLeaves,n>=5?1:0);assert.equal(actual.newFlowers,n===6?1:0);
   const frontend=deriveRewardTreeModel(n?[{course_id:cid,week_code:'11',activity_key:'typing_task_6',current_level:Math.min(n+1,6),completed:n===6}]:[],activities);
   assert.deepEqual(new Set(actual.order.filter(r=>r.id.startsWith(cid+':11:')).map(r=>r.id)),new Set(frontend.rewards.map(r=>r.id)));
  }
  for(const key of ['typing_boss_zh_1','typing_boss_en_1'])await db.query("insert into student_progress values(auth.uid(),$1,'11',$2,1,true)",[cid,key]);
  const all=(await db.query('select garden_growth($1) r',[cid])).rows[0].r;assert.equal(all.newLeaves,1);assert.equal(all.newFlowers,3);assert.deepEqual((await db.query('select garden_growth($1) r',[cid])).rows[0].r.order,all.order);
  await db.query("update garden_reward_catalog set total_levels=5 where course_id=$1 and week_code='11' and activity_key='typing_task_6'",[cid]);await assert.rejects(db.exec(sql),/catalogue conflict/);await db.exec('rollback');
 }finally{await db.close();}
});
