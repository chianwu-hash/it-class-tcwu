import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,TEACHER,OTHER_TEACHER,studentId} from '../lib/quiz-local-db.mjs';
import {newDocument,content} from '../../shared/quiz-document.mjs';
const migration=await readFile(new URL('../../supabase/quiz-wrong-questions.sql',import.meta.url),'utf8');
async function wrong(db,uid,data={},role='authenticated'){
 return db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec(`set local role ${role}`);return (await tx.query('select public.quiz_wrong_questions($1) as result',[JSON.stringify(data)])).rows[0].result;});
}
async function paper(db,{reveal='immediate',mode='practice',group=false,count=2,subject='數學',unit='第一單元'}={}){
 const doc=newDocument();doc.title='錯題驗收';doc.catalog={...doc.catalog,volume:'6年級上學期',subject,unit};
 const template=doc.blocks[0].questions[0];template.explanation=content('原解析 $\\frac{1}{2}$');
 const qs=Array.from({length:count},(_,i)=>({...structuredClone(template),id:crypto.randomUUID(),prompt:content(`合成第${i+1}題`)}));
 doc.blocks=group?[{id:crypto.randomUUID(),material:content('共用材料'),questions:qs}]:qs.map(q=>({id:crypto.randomUUID(),material:content(),questions:[q]}));
 const bank_id=crypto.randomUUID();await quizCall(db,TEACHER,'save',{bank_id,expected_revision:0,document:doc});const v=await quizCall(db,TEACHER,'publish',{bank_id,expected_revision:1});
 const args={session_id:crypto.randomUUID(),version_id:v.id,school_year:115,class_codes:mode==='personal'?[]:['603'],access_mode:mode,reveal,shuffle_options:true};
 await quizCall(db,TEACHER,'open',args);return {args,qs};
}
async function answer(db,uid,p,i,correct=false){const q=p.qs[i];return quizCall(db,uid,'submit',{...p.args,question_id:q.id,response:correct?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id,request_id:crypto.randomUUID()});}
test('錯題整理：本人隔離、題組／整卷揭答、固定亂序、關場回顧與不改答案',async()=>{
 const db=await createQuizDb();try{
  await db.exec(migration);const p=await paper(db,{group:true});await quizCall(db,studentId(1),'join',p.args);
  await answer(db,studentId(1),p,0);assert.equal((await wrong(db,studentId(1))).total,0);
  const saved=await answer(db,studentId(1),p,1,true);const list=await wrong(db,studentId(1),{grade:3});assert.equal(list.total,1);assert.equal(list.grade,6);
  assert.doesNotMatch(JSON.stringify(list),/option_id|原解析/);assert.equal((await wrong(db,studentId(2),{user_id:studentId(1)})).total,0);
  const row=list.items[0],detail=await wrong(db,studentId(1),{action:'detail',...row});
  assert.deepEqual(detail.question.options,saved.document.questions[0].options);assert.equal(detail.response,saved.responses[p.qs[0].id]);assert.deepEqual(detail.review,saved.reviews[0]);
  await assert.rejects(wrong(db,studentId(2),{action:'detail',...row}),/wrong_question_unavailable/);
  await assert.rejects(wrong(db,studentId(1),{},'anon'),/permission denied/);await assert.rejects(wrong(db,null),/login_required/);
  const before=(await db.query('select * from public.quiz_answers order by question_id')).rows;
  await quizCall(db,TEACHER,'close',p.args);assert.equal((await wrong(db,studentId(1),{action:'detail',...row})).question.id,p.qs[0].id);
  const complete=await paper(db,{reveal:'complete',unit:'第二單元'});await quizCall(db,studentId(1),'join',complete.args);await answer(db,studentId(1),complete,0);
  assert.equal((await wrong(db,studentId(1),{unit:'第二單元'})).total,0);await answer(db,studentId(1),complete,1,true);assert.equal((await wrong(db,studentId(1),{unit:'第二單元'})).total,1);
  assert.deepEqual((await db.query('select * from public.quiz_answers where attempt_id=$1 order by question_id',[row.attempt_id])).rows,before);
  const personal=await paper(db,{mode:'personal',count:1});await assert.rejects(quizCall(db,TEACHER,'join',personal.args),/student_required/);
  await assert.rejects(wrong(db,TEACHER,{grade:6}),/student_required/);await assert.rejects(wrong(db,OTHER_TEACHER,{grade:6}),/student_required/);
  await db.query('delete from public.student_enrollments where email=$1',['student1@example.invalid']);await assert.rejects(wrong(db,studentId(1)),/roster_required/);
 }finally{await db.close();}
});
test('錯題科目單元篩選與分頁、不收正確及未答題、拒絕異常參數',async()=>{
 const db=await createQuizDb();try{
  await db.exec(migration);const p=await paper(db,{count:22,subject:'國語',unit:'字的小旅行'});await quizCall(db,studentId(1),'join',p.args);
  for(let i=0;i<21;i++)await answer(db,studentId(1),p,i);
  const first=await wrong(db,studentId(1));assert.equal(first.total,21);assert.equal(first.items.length,20);assert.equal((await wrong(db,studentId(1),{page:1})).items.length,1);
  assert.equal((await wrong(db,studentId(1),{subject:'數學'})).total,0);assert.equal((await wrong(db,studentId(1),{subject:'國語',unit:'字的小旅行'})).total,21);
  assert.equal(first.facets[0].unit,'字的小旅行');
  for(const data of [{page:-1},{page:'a'},{grade:9},{action:'delete'}])await assert.rejects(wrong(db,studentId(1),data),/invalid_request/);
 }finally{await db.close();}
});
