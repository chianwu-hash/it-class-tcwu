import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,studentId} from '../lib/quiz-local-db.mjs';import {newQuestion,content} from '../../shared/quiz-document.mjs';
const rpc=(db,uid,name,data={})=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');return (await tx.query(`select public.${name}($1) result`,[JSON.stringify(data)])).rows[0].result;});
async function setup(){const db=await createQuizDb();for(const f of ['quiz-wrong-questions.sql','quiz-pool.sql','quiz-rewards.sql'])await db.exec(await readFile('supabase/'+f,'utf8'));await db.query("update public.student_enrollments set class_code='301' where email='student1@example.invalid'");
 for(const [id,grade,subject] of [['test3',3,'自然'],['test6',6,'國語']]){await db.query('insert into public.quiz_courses values($1,$2,$3,true)',[id,grade,JSON.stringify({school_year:'115',volume:grade+'年級上學期',subject,publisher:'測試',units:{'1':'第一單元','12':'第十二課'}})]);for(let i=0;i<30;i++){const q=newQuestion();q.id=id+'_'+i;q.prompt=content('題目 '+i);q.explanation=content('逐步核對解析 '+i);await db.query('insert into public.quiz_question_pool values($1,$1,$1,$2,$3,$3,$4,$5,true,$6,$7,true)',[q.id,JSON.stringify([i<20?1:12]),'shared-code',[-3,0,3][i%3],'immutable-v1',JSON.stringify(q),'{}']);await db.query('insert into public.quiz_pool_membership values($1,$2,true)',[q.id,id]);}}
 return db;}
const compose=(db,user,count=10,course='test3')=>rpc(db,user,'quiz_compose',{kind:'self',course_id:course,count,units:[1,12],request_id:crypto.randomUUID()});
async function answerAll(db,user,sid,correctCount){const joined=await quizCall(db,user,'join',{session_id:sid});let last,lastArgs;for(const [i,q] of joined.document.questions.entries()){await quizCall(db,user,'view_question',{session_id:sid,question_id:q.id});await db.query("update public.quiz_question_timing set first_seen=clock_timestamp()-interval '3 seconds' where attempt_id=$1 and question_id=$2",[joined.attempt_id,q.id]);lastArgs={session_id:sid,question_id:q.id,response:i<correctCount?'a':'b',request_id:crypto.randomUUID()};last=await quizCall(db,user,'submit',lastArgs);}return {last,lastArgs,joined};}

test('課程隔離、名冊、超過九課、跨科同碼延伸及零直接讀取權限',async()=>{const db=await setup();try{
 const one=studentId(1),two=studentId(2);let cat=await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[one]);await tx.exec('set local role authenticated');return (await tx.query('select public.quiz_pool_catalog() result')).rows[0].result;});assert.deepEqual(cat.courses.map(c=>c.id),['test3']);
 const a=await compose(db,one),b=await compose(db,two,10,'test6');const d=await quizCall(db,one,'join',{session_id:a.session_id});assert.ok(d.document.questions.every(q=>q.id.startsWith('test3_')));const six=await quizCall(db,two,'join',{session_id:b.session_id});assert.ok(six.document.questions.every(q=>q.id.startsWith('test6_')));
 await assert.rejects(compose(db,one,10,'test6'),/course_unavailable/);await assert.rejects(quizCall(db,two,'join',{session_id:a.session_id}),/session_unavailable|roster_required/);
 const q=d.document.questions[0];await quizCall(db,one,'submit',{session_id:a.session_id,question_id:q.id,response:'b',request_id:crypto.randomUUID()});const ext=await rpc(db,one,'quiz_compose',{kind:'extension',count:3,attempt_id:d.attempt_id,question_id:q.id,request_id:crypto.randomUUID()});const e=await quizCall(db,one,'join',{session_id:ext.session_id});assert.ok(e.document.questions.every(q=>q.id.startsWith('test3_')));
 await db.query("update public.quiz_pool_membership set knowledge_reliable=false where course_id='test3'");await assert.rejects(rpc(db,one,'quiz_compose',{kind:'extension',count:3,attempt_id:d.attempt_id,question_id:q.id,request_id:crypto.randomUUID()}),/extension_unavailable/);
 await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.quiz_pool_membership');}),/permission denied/);
}finally{await db.close();}});

test('快速送答不保存，警示不能偽造時間；達60%後端只發一葉，重試與重整不重播',async()=>{const db=await setup();try{
 await db.query('update public.quiz_integrity_settings set enabled=true');const user=studentId(1),p=await compose(db,user),j=await quizCall(db,user,'join',{session_id:p.session_id}),q=j.document.questions[0];
 const fast=await quizCall(db,user,'submit',{session_id:p.session_id,question_id:q.id,response:'a',request_id:crypto.randomUUID(),elapsed_seconds:99999});assert.equal(fast.warning,'answer_too_fast');assert.equal((await db.query('select count(*)::int n from public.quiz_answers')).rows[0].n,0);
 await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('update public.quiz_question_timing set first_seen=now()');}),/permission denied/);
 const {last,lastArgs}=await answerAll(db,user,p.session_id,6);assert.equal(last.leaf.earned_now,true);assert.equal(last.leaf.earned,true);assert.equal((await quizCall(db,user,'submit',lastArgs)).leaf.earned_now,false);assert.equal((await quizCall(db,user,'resume',{session_id:p.session_id})).leaf.earned_now,false);
 const awards=await rpc(db,user,'quiz_rewards',{course_id:'grade3-115-1'});assert.equal(awards.awards.length,1);assert.equal(awards.awards[0].correct,6);assert.equal((await rpc(db,studentId(2),'quiz_rewards',{course_id:'grade6-115-1'})).awards.length,0);await assert.rejects(rpc(db,user,'quiz_rewards',{course_id:'grade6-115-1'}),/course_unavailable/);
 // Exactly the same content in another immutable paper cannot mint another leaf.
 await db.query('update public.quiz_question_pool set usable=false where question_id<>all($1::text[])',[j.document.questions.map(q=>q.id)]);
 const again=await compose(db,user);const twice=await answerAll(db,user,again.session_id,10);assert.equal(twice.last.leaf.earned_now,false);assert.equal((await rpc(db,user,'quiz_rewards')).awards.length,1);
}finally{await db.close();}});

test('5題與不足10題不計葉，50%不計葉，15／20題達60%各最多一葉，舊答案不追溯',async()=>{const db=await setup();try{
 await db.query('update public.quiz_integrity_settings set enabled=true');const user=studentId(1);
 for(const [count,right,earned] of [[5,5,false],[10,5,false],[15,9,true],[20,12,true]]){const p=await compose(db,user,count),r=await answerAll(db,user,p.session_id,right);assert.equal(r.last.leaf.earned_now===true,earned);}
 assert.equal((await rpc(db,user,'quiz_rewards')).awards.length,2);
 const p=await compose(db,user,10);await db.query('update public.quiz_integrity_settings set enabled=false');await answerAll(db,user,p.session_id,10);await db.query('update public.quiz_integrity_settings set enabled=true');const old=await quizCall(db,user,'resume',{session_id:p.session_id});assert.equal(old.leaf.earned,false);assert.equal((await rpc(db,user,'quiz_rewards')).awards.length,2);
 // Missing or nonnumeric grade metadata must not roll back a student's final answer.
 const malformed=await compose(db,user,10);await db.query("update public.quiz_versions set document=jsonb_set(document,'{catalog,volume}','\"三年級上學期\"') where id=(select version_id from public.quiz_sessions where id=$1)",[malformed.session_id]);
 const saved=await answerAll(db,user,malformed.session_id,10);assert.equal(saved.last.leaf.reason,'not_eligible');assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[saved.joined.attempt_id])).rows[0].n,10);
}finally{await db.close();}});
