import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {setup} from '../lib/garden-level2-local-db.mjs';
import {splitSnapshot} from '../lib/db-snapshot.mjs';
import {buildWeeklyFiveRewardMigration} from '../lib/weekly-five-reward-migration.mjs';
import {validateCatalog} from '../../release/garden-catalog.mjs';
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
async function load(p){let s=await read(p);for(const m of [...s.matchAll(/from ["'](\.\/[^"']+)["']/g)])s=s.replace(m[0],`from '${await load('shared/'+m[1].slice(2).split('?')[0])}'`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64');}
const {deriveRewardTreeModel}=await import(await load('shared/reward-tree-model.js'));
const {getRewardTreeCourses}=await import(await load('shared/reward-tree-config.js'));
const courseId='grade3-115-1',a={courseId,type:'typing',weekCode:'11',activityKey:'typing_task_6',totalLevels:6,rewardMode:'five-then-flower',pageHref:'/grade3/115-1/week11.html',label:'本週'};
const model=(n,activity=a)=>deriveRewardTreeModel([{course_id:activity.courseId,week_code:activity.weekCode,activity_key:activity.activityKey,current_level:Math.min(n+1,activity.totalLevels),completed:n===activity.totalLevels}], [activity]);
test('提交的遷移函式與快照來源一致，指紋接受正式來源且沒有其他函式改寫',async()=>{
 const {createHash}=await import('node:crypto');
 const sql=(await read('supabase/grade3_week11_typing.sql')).replaceAll('\r\n','\n');
 const source=(splitSnapshot(await read('supabase/production-snapshot/functions.sql')).find(x=>x.signature==='garden_growth(text,text)').definition+'\n').replaceAll('\r\n','\n');
 const digest=createHash('md5').update(source).digest('hex');assert(sql.includes("'"+digest+"'"));
 const next=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.garden_growth('),sql.lastIndexOf('commit;')).trim().replace(/;$/,'');
 if(source.includes("if r.reward_mode='five-then-flower'"))assert.equal(next,source.trim());
 else assert.equal(sql,buildWeeklyFiveRewardMigration(source));
 assert.equal((sql.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,1);
});
test('新六關在0～4關零葉、5關一葉、6關一葉一花；ID穩定且待領連到第5關',()=>{
 for(let n=0;n<=6;n++){const m=model(n);assert.equal(m.stats.leafCount,n>=5?1:0);assert.equal(m.stats.flowerCount,n===6?1:0);assert.equal(m.rewards.length+m.pendingRewards.length,2);if(n<5)assert.match(m.pendingRewards.find(r=>r.kind==='typing-leaf').href,/#block-level5$/);}
 assert.deepEqual(model(5).rewards.map(r=>r.id),model(6).rewards.filter(r=>r.kind==='typing-leaf').map(r=>r.id));
});
test('所有舊活動按原規則保留：逐關葉、一般魔王花、獨立魔王',()=>{
 for(const c of getRewardTreeCourses())for(const entry of c.activities.filter(x=>x.type==='typing'&&x.rewardMode!=='five-then-flower')){const x={...entry,courseId:c.id};for(let n=0;n<=x.totalLevels;n++){const m=model(n,x);assert.equal(m.stats.leafCount,x.rewardMode==='boss'?0:Math.min(n,x.totalLevels-1),c.id+':'+x.weekCode);assert.equal(m.stats.flowerCount,n===x.totalLevels?1:0);}}
});
test('目錄驗證接受新模式，拒絕錯關數與錯活動種類',()=>{
 const row={course_id:courseId,week_code:'11',activity_key:'typing_task_6',kind:'typing',total_levels:6,reward_mode:'five-then-flower'};
 validateCatalog([row]);for(const change of [{kind:'quiz'},{total_levels:5},{reward_mode:'unknown'}])assert.throws(()=>validateCatalog([{...row,...change}]));
});
test('正式garden_growth函式在隔離庫與前端一致；舊baseline、進度、seen不被遷移或重練改寫',async()=>{
 const db=await setup();try{
  await db.exec(`alter table garden_growth add column foundation_reward_version integer default 1;
  create table foundation_milestone_policy(id boolean,activated_at timestamptz);
  create function foundation_milestone_rewards(text,jsonb) returns jsonb language sql as $$select '[]'::jsonb$$;
  create function quiz_partner_reward_ids(text) returns jsonb language sql as $$select '[]'::jsonb$$;
  create table grade3_google_activities(week_code text,activity_key text,total int,primary key(week_code,activity_key));`);
  const growth=splitSnapshot(await read('supabase/production-snapshot/functions.sql')).find(x=>x.signature==='garden_growth(text,text)');
  await db.exec(growth.definition+';');
  const call=async()=>(await db.query("select garden_growth('grade3-115-1') r")).rows[0].r;
  const before=(await db.query('select * from garden_growth')).rows,progress=(await db.query('select * from student_progress')).rows;
  const source=(await db.query("select pg_get_functiondef('public.garden_growth(text,text)'::regprocedure) d")).rows[0].d;
  const sql=buildWeeklyFiveRewardMigration(source);await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('select * from garden_growth')).rows,before);assert.deepEqual((await db.query('select * from student_progress')).rows,progress);
  for(let n=0;n<=6;n++){
   await db.query("delete from student_progress where week_code='11'");
   if(n)await db.query("insert into student_progress values(auth.uid(),'grade3-115-1','11','typing_task_6',$1,$2)",[Math.min(n+1,6),n===6]);
   const r=await call(),ids=r.order.filter(x=>x.id.startsWith(courseId+':11:'));
   assert.equal(r.newLeaves,n>=5?1:0);assert.equal(r.newFlowers,n===6?1:0);
   assert.deepEqual(new Set(ids.map(x=>x.id)),new Set(model(n).rewards.map(x=>x.id)));
   assert.deepEqual((await call()).order,r.order);
   assert.deepEqual((await db.query('select baseline,seen_at from garden_growth')).rows,before.map(x=>({baseline:x.baseline,seen_at:x.seen_at})));
  }
  await db.exec("update grade3_google_activities set total=5 where week_code='11'");await assert.rejects(db.exec(sql),/registration conflict/);await db.exec('rollback');
 }finally{await db.close();}
});
