import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,studentId,TEACHER} from '../lib/quiz-local-db.mjs';
import {newDocument,newQuestion} from '../../shared/quiz-document.mjs';
const sql=f=>readFile('supabase/'+f,'utf8');
const FILES=['quiz-wrong-questions.sql','quiz-pool.sql','quiz-rewards.sql','quiz-load-batch1.sql','quiz-load-batch2.sql','quiz-load-batch3.sql','quiz-load-batch4.sql'];
async function setup(){
 const db=await createQuizDb(undefined,{batch2:false,batch3:false});for(const f of FILES)await db.exec(await sql(f));
 const d=newDocument();d.blocks=Array.from({length:10},(_,i)=>{const q=newQuestion();q.id='midterm_'+['00062843','0070a479','002d7628','002d9366','004ca0c9','00a1','00b2','00c3','00d4','00e5'][i];return {id:'b'+i,material:{text:'',media:[]},questions:[q]};});
 const bank_id=crypto.randomUUID();await quizCall(db,TEACHER,'save',{bank_id,expected_revision:0,document:d});const v=await quizCall(db,TEACHER,'publish',{bank_id,expected_revision:1});
 const args={session_id:crypto.randomUUID()};await quizCall(db,TEACHER,'open',{...args,version_id:v.id,school_year:115,class_codes:['603'],reveal:'immediate',access_mode:'practice'});
 return {db,args,ids:d.blocks.map(b=>b.questions[0].id)};
}
// Force the production plan: statistics moved it to a hash anti join, whose output is not in array order.
const forceHash=db=>db.exec("set enable_nestloop=off;set enable_mergejoin=off;set enable_indexscan=off;set enable_bitmapscan=off;set enable_indexonlyscan=off");
const nextId=(db,attempt)=>db.query("select value#>>'{}' v from jsonb_array_elements((select question_order from public.quiz_attempts where id=$1)) x(value) where not exists(select 1 from public.quiz_answers q where q.attempt_id=$1 and q.question_id=x.value#>>'{}') limit 1",[attempt]);
test('修正前：hash anti join 下，LIMIT 1 不一定回傳第一題（重現正式環境）',async()=>{
 const {db,args,ids}=await setup();try{
  const j=await quizCall(db,studentId(1),'join',args);await forceHash(db);
  const plan=(await db.query(`explain select value#>>'{}' from jsonb_array_elements((select question_order from public.quiz_attempts where id='${j.attempt_id}')) x(value) where not exists(select 1 from public.quiz_answers q where q.attempt_id='${j.attempt_id}' and q.question_id=x.value#>>'{}') limit 1`)).rows.map(r=>r['QUERY PLAN']).join('\n');
  assert.match(plan,/Hash.*Anti/,plan);
  assert.notEqual((await nextId(db,j.attempt_id)).rows[0].v,ids[0],'hash order happens to match; fixture no longer reproduces');
  await assert.rejects(quizCall(db,studentId(1),'view_question',{...args,question_id:ids[0]}),/question_order/);
 }finally{await db.close();}
});
test('修正後：同樣的計畫下依序作答全部通過，順序檢查仍然有效',async()=>{
 const {db,args,ids}=await setup();try{
  const before=(await db.query("select proname,md5(pg_get_functiondef(oid)) h from pg_proc where proname in('quiz_answer_guard','quiz_leaf_result','quiz_student_document','quiz_compose') order by 1")).rows;
  await db.exec(await sql('quiz-order-fix.sql'));
  assert.deepEqual((await db.query("select proname,md5(pg_get_functiondef(oid)) h from pg_proc where proname in('quiz_answer_guard','quiz_leaf_result','quiz_student_document','quiz_compose') order by 1")).rows,before);
  await db.query('update public.quiz_integrity_settings set enabled=false');
  const j=await quizCall(db,studentId(1),'join',args);await forceHash(db);
  for(const [i,id] of ids.entries()){
   await quizCall(db,studentId(1),'view_question',{...args,question_id:id});
   // Skipping ahead is still rejected at every position.
   if(i+1<ids.length){await assert.rejects(quizCall(db,studentId(1),'view_question',{...args,question_id:ids[i+1]}),/question_order/);
    await assert.rejects(quizCall(db,studentId(1),'submit',{...args,question_id:ids[i+1],response:'a',request_id:crypto.randomUUID(),compact:true}),/question_order/);}
   const opt=(await db.query("select q->'answer'->>'option_id' o from public.quiz_versions v,jsonb_array_elements(v.document->'blocks') b,jsonb_array_elements(b->'questions') q where q->>'id'=$1 limit 1",[id])).rows[0].o;
   const r=await quizCall(db,studentId(1),'submit',{...args,question_id:id,response:opt,request_id:crypto.randomUUID(),compact:true});
   assert.equal(Object.keys(r.responses).length,i+1);
  }
  assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[j.attempt_id])).rows[0].n,10);
 }finally{await db.close();}
});
