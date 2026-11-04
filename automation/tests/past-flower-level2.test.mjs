import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createQuizDb,TEACHER,studentId} from '../lib/quiz-local-db.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const bundle=JSON.parse(read('automation/output/past-exam-production/bundle.private.json'));
const cid='grade3-115-1';
const asStudent=(db,fn)=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');return fn(tx)});
const action=(db,name,data={})=>asStudent(db,async tx=>(await tx.query('select public.quiz_past_action($1,$2) r',[name,{paper_id:bundle.paperId,...data}])).rows[0].r);
async function setup(){
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});
 await db.exec(read('supabase/quiz-past-exams.sql'));
 await db.exec("update student_enrollments set class_code='301' where email='student1@example.invalid'");
 await db.query('insert into quiz_past_papers(id,owner_id,grade,school_year,semester,title) values($1,$2,3,115,1,$3)',[bundle.paperId,TEACHER,bundle.document.title]);
 const v=(await db.query('insert into quiz_past_versions(paper_id,sha256,document,provenance) values($1,$2,$3,$4) returning id',[bundle.paperId,bundle.sha256,bundle.document,bundle.provenance])).rows[0].id;
 await db.query('update quiz_past_papers set enabled=true,active_version=$1',[v]);
 await db.exec(`create table if not exists student_progress(user_id uuid,course_id text,week_code text,activity_key text,current_level int,completed boolean);
 create or replace function public.typing_foundation_action(text,text,jsonb) returns jsonb language sql as $$select '[]'::jsonb$$;
 create or replace function public.homework_action(text,jsonb) returns jsonb language sql as $$select '{"assignments":[]}'::jsonb$$;
 create or replace function public.reading_action(text,jsonb) returns jsonb language sql as $$select '{"periods":[]}'::jsonb$$;
 create or replace function public.quiz_rewards_before_past(p_data jsonb default '{}') returns jsonb language sql as $$select jsonb_build_object('awards',coalesce(nullif(current_setting('test.normal_awards',true),'')::jsonb,'[]'))$$;`);
 await db.exec(read('supabase/garden-growth.sql'));
 return {db,v};
}
async function finish(db,v,aid,score){
 let left=score,result;
 for(const g of bundle.document.groups){
  const responses=g.fields.map(f=>{
   if(g.kind==='annotation')return {questionId:f.id,value:{mediaSha256:g.assets[0].sha256,point:{x:.4,y:.3},arrow:{from:{x:.4,y:.3},to:{x:.4,y:.6}}}};
   const ok=left>=f.points;if(ok)left-=f.points;
   const wrong=['single','code'].includes(g.kind)?g.choices.find(c=>c.id!==f.answer).id:g.kind==='mark'?!f.answer:g.kind==='sequence'?[...f.answer].reverse():[g.codes.find(c=>!f.answer.includes(c))];
   return {questionId:f.id,value:ok?f.answer:wrong};
  });
  await action(db,'view',{attempt_id:aid,group_id:g.id});
  await db.query("update quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=$1",[aid]);
  result=await action(db,'submit',{attempt_id:aid,version:v,group_id:g.id,request_id:randomUUID(),confirmed:true,responses});
 }
 return result;
}
const growth=db=>asStudent(db,async tx=>(await tx.query('select garden_growth($1) r',[cid])).rows[0].r);
const rewards=db=>asStudent(db,async tx=>(await tx.query('select quiz_rewards($1) r',[{course_id:cid}])).rows[0].r);
const migrate=async db=>{for(const p of ['quiz-past-flowers.sql','garden-reward-conversion.sql','garden-companions.sql','garden-level2.sql'])await db.exec(read('supabase/'+p))};

test('考古葉原筆換花、保留首次來源、重裝不重發、已成長者不因改制降級或重算新成果',async()=>{
 const {db,v}=await setup();try{
  const first=await action(db,'start',{request_id:randomUUID()});await finish(db,v,first.attemptId,56);
  const before=(await db.query('select * from quiz_past_leaves')).rows[0];assert.ok(before);
  await db.query(`insert into garden_reward_catalog values($1,'01','base','typing',44,null)`,[cid]);
  await db.query('insert into student_progress values($1,$2,\'01\',\'base\',44,false)',[studentId(1),cid]);
  await db.query("insert into garden_reward_catalog select $1,'02','boss'||i,'typing',1,'boss' from generate_series(1,10)i",[cid]);
  await db.query("insert into student_progress select $1,$2,'02','boss'||i,1,true from generate_series(1,10)i",[studentId(1),cid]);
  let g=await growth(db);assert.equal(g.level,2);assert.equal(g.baseline.filter(x=>x.kind==='flower').length,10);
  await migrate(db);
  let r=await rewards(db);assert.equal(r.awards.length,0);assert.equal(r.flowers.length,1);assert.equal(r.flowers[0].id,'past:'+before.id);assert.equal(r.flowers[0].attempt_id,first.attemptId);assert.equal(r.flowers[0].half_units,undefined);
  g=await growth(db);assert.equal(g.level,2);assert.equal(g.newLeaves,0);assert.equal(g.newFlowers,0);assert.equal(g.baseline.filter(x=>x.kind==='flower').length,11);assert.equal(g.petUnlocked,false);
  assert.equal((await db.query('select leaf_floor from garden_growth')).rows[0].leaf_floor,43);
  const converted=structuredClone(g.baseline);await migrate(db);assert.deepEqual((await growth(db)).baseline,converted);
  const state=await action(db,'resume',{attempt_id:first.attemptId});assert.equal(state.practice.flowerCount,1);assert.equal(state.practice.leafCount,undefined);assert.equal(state.practice.history[0].earned_flower,true);assert.equal(state.practice.history[0].earned_leaf,undefined);
  const next=await action(db,'restart',{request_id:randomUUID()});const again=await finish(db,v,next.attemptId,92);assert.equal(again.practice.flowerCount,1);assert.equal(again.practice.earnedByThisAttempt,false);
  assert.equal((await db.query('select count(*)::int n from quiz_past_leaves')).rows[0].n,1);
  await db.query("update student_progress set current_level=43 where activity_key='base'");assert.equal((await growth(db)).level,1);
  await db.query("update student_progress set current_level=44 where activity_key='base'");assert.equal((await growth(db)).level,2);
  // Converted past flowers must not replace a teacher-revoked boss flower.
  await db.query("update student_progress set completed=false where activity_key='boss1'");assert.equal((await growth(db)).level,1);
 }finally{await db.close()}
});

test('新作答55/92不開花、56/92開花；完整性、防快答與匿名隔離保留',async()=>{
 const {db,v}=await setup();try{
  await migrate(db);const first=await action(db,'start',{request_id:randomUUID()});
  await assert.rejects(action(db,'submit',{attempt_id:first.attemptId,version:v,group_id:bundle.document.groups[0].id,request_id:randomUUID(),confirmed:true,responses:[]}),/answer_too_fast|incomplete_group/);
  assert.equal((await finish(db,v,first.attemptId,55)).practice.flowerCount,0);
  const next=await action(db,'restart',{request_id:randomUUID()});assert.equal((await finish(db,v,next.attemptId,56)).practice.flowerCount,1);
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from quiz_past_leaves')}),/permission denied/);
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select quiz_rewards()')}),/permission denied/);
 }finally{await db.close()}
});

test('混合半葉移除考古貢獻後重新配對，兩個舊半葉不會變成新成果',async()=>{
 const {db}=await setup();try{
  await migrate(db);
  const awards=[{id:'normal-a',half_units:1},{id:'past:p',half_units:2,source_type:'past_exam'},{id:'normal-b',half_units:1}];
  const old=(await db.query('select garden_quiz_leaf_map($1,$2) r',[awards,cid])).rows[0].r;
  const converted=(await db.query('select garden_convert_quiz_snapshot($1,$2,$3) r',[old.map(({halves,...r})=>r),awards,cid])).rows[0].r;
  assert.equal(converted.filter(r=>r.kind==='quiz-leaf').length,1);assert.equal(converted.filter(r=>r.kind==='flower').length,1);
  assert.equal(converted[0].id,cid+':00:practice_pair:normal-a:0:normal-b:0:quiz-leaf:1');
  assert.equal(converted[1].id,cid+':00:practice_past:p:flower:1');
 }finally{await db.close()}
});
