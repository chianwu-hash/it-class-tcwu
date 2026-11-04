import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,studentId,TEACHER,OTHER_TEACHER} from '../lib/quiz-local-db.mjs';
import {newDocument,newQuestion,content} from '../../shared/quiz-document.mjs';
const sql=f=>readFile('supabase/'+f,'utf8');
const rpc=(db,uid,name,data={},role='authenticated')=>db.transaction(async tx=>{
 await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec('set local role '+role);
 return (await tx.query(`select public.${name}($1) result`,[JSON.stringify(data)])).rows[0].result;
});
async function setup(){const db=await createQuizDb(undefined,{batch2:false,batch3:false});for(const f of ['quiz-wrong-questions.sql','quiz-pool.sql','quiz-rewards.sql','quiz-load-batch1.sql','quiz-load-batch2.sql'])await db.exec(await sql(f));return db;}
async function alias(db,name){const s=(await db.query('select pg_get_functiondef(oid) s from pg_proc where proname=$1 and pronamespace=\'public\'::regnamespace',[name])).rows[0].s;await db.exec(s.replace('public.'+name+'(', 'public.'+name+'_before3('));}
test('第三批：學生白名單一次組裝與舊版JSON完全相同，含亂序、缺漏、重複、題組與隱密欄位',async()=>{
 const db=await setup();try{
  await alias(db,'quiz_student_document');await db.exec(await sql('quiz-load-batch3.sql'));
  const d=newDocument();d.blocks=Array.from({length:8},(_,i)=>({id:'b'+i,material:content('材料'+i),questions:Array.from({length:4},(_,j)=>{const q=newQuestion(j%2?'short':'single');q.id='q'+i+'_'+j;q.internal_secret='secret';return q;})}));
  d.blocks.push({id:'duplicate',material:content('不應選取'),questions:[{...d.blocks[0].questions[0],prompt:content('不應選取')}]});
  const ids=d.blocks.slice(0,8).flatMap(b=>b.questions.map(q=>q.id));const oo=Object.fromEntries(ids.map(id=>[id,['b','a','a','missing']]));
  for(const qo of [[],ids,ids.toReversed(),['missing',ids[0],ids[0],null],ids.slice(0,5)]){
   const r=(await db.query('select public.quiz_student_document($1,$2,$3) now,public.quiz_student_document_before3($1,$2,$3) old',[d,JSON.stringify(qo),oo])).rows[0];assert.deepEqual(r.now,r.old);assert.ok(!JSON.stringify(r.now).includes('internal_secret'));assert.ok(!JSON.stringify(r.now).includes('accepted'));
  }
 }finally{await db.close();}
});
test('第三批：抽題候選與第二批逐題完全一致，三難度、稀疏補題、題組去重、單元JSON相等與重送',async()=>{
 const db=await setup();try{
  await alias(db,'quiz_compose');await db.exec(await sql('quiz-load-batch3.sql'));await db.query("update public.student_enrollments set class_code='301'");
  for(let i=0;i<100;i++){const q=newQuestion();q.id='candidate_'+i;q.prompt=content('合成題'+i);
   await db.query('insert into public.quiz_question_pool values($1,$1,$2,$3,$4,$4,$5,$6,true,$7,$8,$9)',[q.id,'group_'+Math.floor(i/2),JSON.stringify([[1],[1,2],[2,1],[2],[3]][i%5]),'point_'+i%7,[-3,0,3][i%3],'test',q,{},i%17!==0]);}
  const compare=async data=>{const outputs=[];for(const fn of ['quiz_compose_before3','quiz_compose']){
   await assert.rejects(db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.query('select setseed(.42)');const result=(await tx.query(`select public.${fn}($1) r`,[data])).rows[0].r;
    const document=(await tx.query('select v.document from public.quiz_versions v join public.quiz_sessions s on s.version_id=v.id where s.id=$1',[result.session_id])).rows[0].document;
    assert.deepEqual((await tx.query(`select public.${fn}($1) r`,[data])).rows[0].r,{...result,reused:true});outputs.push({document,distribution:result.distribution,display_name:result.display_name});throw Error('rollback_comparison');}),/rollback_comparison/);
  }assert.deepEqual(outputs[1],outputs[0]);};
  for(const difficulty of ['easy','medium','hard'])for(const count of [5,10,20])for(const units of [[1,2],[3]])await compare({kind:'self',difficulty,count,units,request_id:crypto.randomUUID()});
  await db.query('update public.quiz_question_pool set usable=false where difficulty=3');
  for(const difficulty of ['easy','medium','hard'])await compare({kind:'self',difficulty,count:20,units:[1,2,3],request_id:crypto.randomUUID()});
 }finally{await db.close();}
});
test('第三批：教師彙整JSON與舊監看相同，權限、空場、保存、關場重送不變',async()=>{
 const db=await setup();try{
  const hashes=(await db.query("select proname,md5(pg_get_functiondef(oid)) hash from pg_proc where proname in('quiz_action','quiz_answer_guard','quiz_leaf_result')")).rows;
  await db.exec(await sql('quiz-load-batch3.sql'));assert.deepEqual((await db.query("select proname,md5(pg_get_functiondef(oid)) hash from pg_proc where proname in('quiz_action','quiz_answer_guard','quiz_leaf_result')")).rows,hashes);
  const bank_id=crypto.randomUUID(),d=newDocument();await quizCall(db,TEACHER,'save',{bank_id,expected_revision:0,document:d});const v=await quizCall(db,TEACHER,'publish',{bank_id,expected_revision:1});const args={session_id:crypto.randomUUID()};
  await quizCall(db,TEACHER,'open',{...args,version_id:v.id,school_year:115,class_codes:['603'],reveal:'complete',access_mode:'practice',shuffle_questions:true,shuffle_options:true});
  const compare=async()=>assert.deepEqual(await rpc(db,TEACHER,'quiz_monitor',args),await quizCall(db,TEACHER,'monitor',args));await compare();
  for(let i=1;i<=30;i++){await quizCall(db,studentId(i),'join',args);if(i%2)await quizCall(db,studentId(i),'submit',{...args,question_id:d.blocks[0].questions[0].id,response:'a',request_id:crypto.randomUUID()});}await compare();
  for(const [uid,error] of [[null,/login_required/],[studentId(1),/teacher_required/],[OTHER_TEACHER,/session_unavailable/]])await assert.rejects(rpc(db,uid,'quiz_monitor',args),error);
  await assert.rejects(rpc(db,null,'quiz_monitor',args,'anon'),/permission denied/);
  await quizCall(db,TEACHER,'close',args);await compare();await db.exec(await sql('quiz-load-batch3.sql'));await compare();
 }finally{await db.close();}
});
