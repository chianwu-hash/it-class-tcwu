import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,studentId,TEACHER} from '../lib/quiz-local-db.mjs';
import {newQuestion,content} from '../../shared/quiz-document.mjs';
async function rpc(db,uid,name,data={}){return db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec('set local role authenticated');return (await tx.query(`select public.${name}($1) result`,[JSON.stringify(data)])).rows[0].result;});}
async function setup(){const db=await createQuizDb();await db.exec(await readFile('supabase/quiz-wrong-questions.sql','utf8'));await db.exec(await readFile('supabase/quiz-pool.sql','utf8'));await db.query("update public.student_enrollments set class_code='301' where email in ('student1@example.invalid','student2@example.invalid')");
 for(let i=0;i<24;i++){const q=newQuestion();q.id='pool_'+i;q.prompt=content('合成獨立題 '+i);q.explanation=content('合成解析');await db.query('insert into public.quiz_question_pool values($1,$2,$2,$3,$4,$4,$5,$6,true,$7,$8,true)',[q.id,'source_'+i,JSON.stringify([i<12?1:2]),'knowledge_1',[-3,0,3][i%3],'version1',JSON.stringify(q),'{}']);}return db;}

test('自組卷5／10／15／20題依比例抽選且不重複，超過20或非法題數拒絕',async()=>{const db=await setup();try{
 for(let i=24;i<36;i++){const q=newQuestion();q.id='pool_'+i;q.prompt=content('新增中等題 '+i);await db.query('insert into public.quiz_question_pool values($1,$2,$2,$3,$4,$4,0,$5,true,$6,$7,true)',[q.id,'source_'+i,'[1,2]','knowledge_1','version1',JSON.stringify(q),'{}']);}
 for(const count of [5,10,15,20]){
  const r=await rpc(db,studentId(1),'quiz_compose',{kind:'self',count,units:[1,2],request_id:crypto.randomUUID()});assert.deepEqual([r.distribution.easy,r.distribution.medium,r.distribution.hard],[count/5,count*3/5,count/5]);
  const joined=await quizCall(db,studentId(1),'join',{session_id:r.session_id});assert.equal(joined.document.questions.length,count);assert.equal(new Set(joined.document.questions.map(q=>q.id)).size,count);
  if(count===20){for(const q of joined.document.questions)await quizCall(db,studentId(1),'submit',{session_id:r.session_id,question_id:q.id,response:'a',request_id:crypto.randomUUID()});const resumed=await quizCall(db,studentId(1),'resume',{session_id:r.session_id});assert.equal(resumed.complete,true);assert.equal(Object.keys(resumed.responses).length,20);assert.equal(resumed.reviews.length,20);}
 }
 for(const count of [0,1,19,21,25,100])await assert.rejects(rpc(db,studentId(1),'quiz_compose',{kind:'self',count,units:[1],request_id:crypto.randomUUID()}),/invalid_request/);
 await assert.rejects(rpc(db,studentId(1),'quiz_compose',{kind:'extension',count:20,request_id:crypto.randomUUID()}),/invalid_request/);
}finally{await db.close();}});

test('刪除僅移除本人清單、可安全重試，保留原卷答案與錯題',async()=>{const db=await setup();try{
 const config={request_id:crypto.randomUUID(),kind:'self',count:5,units:[1],name:'待整理卷'},made=await rpc(db,studentId(1),'quiz_compose',config),args={session_id:made.session_id};
 const joined=await quizCall(db,studentId(1),'join',args),q=joined.document.questions[0];await quizCall(db,studentId(1),'submit',{...args,question_id:q.id,response:'b',request_id:crypto.randomUUID()});
 const before=JSON.stringify((await db.query('select * from public.quiz_versions order by id')).rows),answers=JSON.stringify((await db.query('select * from public.quiz_answers')).rows);
 await assert.rejects(rpc(db,studentId(2),'quiz_delete_paper',args),/session_unavailable/);
 await assert.rejects(rpc(db,null,'quiz_delete_paper',args),/login_required/);await assert.rejects(rpc(db,TEACHER,'quiz_delete_paper',args),/student_required/);
 await assert.rejects(rpc(db,studentId(1),'quiz_delete_paper',{...args,user_id:studentId(2)}),/invalid_request/);
 assert.equal((await rpc(db,studentId(1),'quiz_delete_paper',args)).removed,true);assert.equal((await rpc(db,studentId(1),'quiz_delete_paper',args)).removed,true);
 assert.equal((await quizCall(db,studentId(1),'library_sessions')).sessions.length,0);
 assert.equal(JSON.stringify((await db.query('select * from public.quiz_versions order by id')).rows),before);assert.equal(JSON.stringify((await db.query('select * from public.quiz_answers')).rows),answers);
 assert.equal((await rpc(db,studentId(1),'quiz_wrong_questions')).total,1);
 const detail=await rpc(db,studentId(1),'quiz_wrong_questions',{action:'detail',attempt_id:joined.attempt_id,question_id:q.id});assert.equal(detail.review.correct,false);
 await assert.rejects(rpc(db,studentId(1),'quiz_compose',config),/paper_removed/);await assert.rejects(rpc(db,studentId(1),'quiz_rename_paper',{...args,name:'不復原'}),/session_unavailable/);
 const empty=await rpc(db,studentId(1),'quiz_compose',{...config,request_id:crypto.randomUUID()});await rpc(db,studentId(1),'quiz_delete_paper',{session_id:empty.session_id});assert.equal((await quizCall(db,studentId(1),'library_sessions')).sessions.length,0);
}finally{await db.close();}});

test('命名自組卷立即入清單；本人改名保留未答卷、原版本、選項與已存答案',async()=>{const db=await setup();try{
 const config={request_id:crypto.randomUUID(),kind:'self',count:5,units:[1],name:'  分數複習 <我的卷>  '};
 const made=await rpc(db,studentId(1),'quiz_compose',config);
 let paper=(await quizCall(db,studentId(1),'library_sessions')).sessions.find(x=>x.id===made.session_id);assert.equal(paper.generated,true);assert.equal(paper.display_name,'分數複習 <我的卷>');assert.equal(paper.answered,0);assert.ok(paper.saved_at);
 assert.equal(paper.generated_kind,'self');assert.deepEqual(paper.unit_ids,[1]);assert.deepEqual(paper.distribution,made.distribution);assert.equal(paper.learning_point,null);
 const args={session_id:made.session_id},joined=await quizCall(db,studentId(1),'join',args),q=joined.document.questions[0];assert.equal(joined.document.title,paper.display_name);
 const saved=await quizCall(db,studentId(1),'submit',{...args,question_id:q.id,response:'b',request_id:crypto.randomUUID()});
 const original=JSON.stringify((await db.query('select * from public.quiz_versions order by id')).rows);
 await assert.rejects(rpc(db,studentId(2),'quiz_rename_paper',{...args,name:'他人改名'}),/session_unavailable/);
 for(const name of ['', '  ', 'a'.repeat(61), '兩行\n名稱'])await assert.rejects(rpc(db,studentId(1),'quiz_rename_paper',{...args,name}),/invalid_request/);
 await assert.rejects(rpc(db,null,'quiz_rename_paper',{...args,name:'匿名'}),/login_required/);
 await rpc(db,studentId(1),'quiz_rename_paper',{...args,name:'期中再練一次'});
 assert.equal(JSON.stringify((await db.query('select * from public.quiz_versions order by id')).rows),original);
 const resumed=await quizCall(db,studentId(1),'resume',args);assert.equal(resumed.document.title,'期中再練一次');assert.deepEqual(resumed.responses,saved.responses);assert.deepEqual(resumed.document.questions,joined.document.questions);
 assert.equal((await rpc(db,studentId(1),'quiz_compose',config)).session_id,made.session_id);
 paper=(await quizCall(db,studentId(1),'library_sessions')).sessions.find(x=>x.id===made.session_id);assert.equal(paper.display_name,'期中再練一次');assert.equal(paper.answered,1);
}finally{await db.close();}});
test('學生自組：私有卷、固定版本、冪等、亂序、來源池與他人紀錄隔離',async()=>{const db=await setup();try{
 const data={request_id:crypto.randomUUID(),kind:'self',count:10,units:[1,2]};const made=await rpc(db,studentId(1),'quiz_compose',data);assert.equal(made.distribution.actual,10);assert.deepEqual([made.distribution.easy,made.distribution.medium,made.distribution.hard],[2,6,2]);
 const again=await rpc(db,studentId(1),'quiz_compose',data);assert.equal(again.session_id,made.session_id);assert.equal(again.reused,true);
 await assert.rejects(rpc(db,studentId(1),'quiz_compose',{...data,count:5}),/submission_conflict/);
 const args={session_id:made.session_id};const joined=await quizCall(db,studentId(1),'join',args);assert.doesNotMatch(JSON.stringify(joined),/option_id|合成解析/);assert.equal(joined.document.questions.length,10);
 assert.equal((await quizCall(db,studentId(1),'library_sessions')).sessions.length,1);assert.equal((await quizCall(db,studentId(2),'library_sessions')).sessions.length,0);
 await assert.rejects(quizCall(db,studentId(2),'join',args),/session_unavailable/);
 await assert.rejects(quizCall(db,studentId(2),'resume',args),/session_unavailable/);
 await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.quiz_question_pool');}),/permission denied/);
 const q=joined.document.questions[0];const saved=await quizCall(db,studentId(1),'submit',{...args,question_id:q.id,response:'b',request_id:crypto.randomUUID()});assert.equal(saved.reviews[0].correct,false);
 const wrong=await rpc(db,studentId(1),'quiz_wrong_questions');assert.equal(wrong.total,1);assert.equal((await rpc(db,studentId(2),'quiz_wrong_questions')).total,0);
 const ext=await rpc(db,studentId(1),'quiz_compose',{kind:'extension',count:3,request_id:crypto.randomUUID(),attempt_id:joined.attempt_id,question_id:q.id});
 const extended=await quizCall(db,studentId(1),'join',{session_id:ext.session_id});assert.ok(!extended.document.questions.some(x=>x.id===q.id));assert.ok(extended.document.questions.length>0);
 const listed=(await quizCall(db,studentId(1),'library_sessions')).sessions.find(x=>x.id===ext.session_id);
 assert.equal(listed.generated_kind,'extension');assert.equal(listed.learning_point,'knowledge_1');assert.equal(listed.display_name,'同重點再練：knowledge_1');assert.equal(extended.document.title,listed.display_name);
 await rpc(db,studentId(1),'quiz_rename_paper',{session_id:ext.session_id,name:'我想再練一次'});assert.equal((await quizCall(db,studentId(1),'resume',{session_id:ext.session_id})).document.title,'我想再練一次');
 const frozen=JSON.stringify((await quizCall(db,studentId(1),'resume',args)).document);await db.query("update public.quiz_question_pool set question=jsonb_set(question,'{prompt,text}','\"新版來源\"')");assert.equal(JSON.stringify((await quizCall(db,studentId(1),'resume',args)).document),frozen);
}finally{await db.close();}});
test('組卷拒絕偽造與未揭答錯題、名冊及教師越權，難度不足如實記錄',async()=>{const db=await setup();try{
 const good={request_id:crypto.randomUUID(),kind:'self',count:5,units:[1]};
 for(const change of [{question_id:'pool_1'},{user_id:studentId(2)},{units:[10]},{count:100},{units:[]},{units:['1']}])await assert.rejects(rpc(db,studentId(1),'quiz_compose',{...good,...change}),/invalid_request/);
 await assert.rejects(rpc(db,null,'quiz_compose',good),/login_required/);await assert.rejects(rpc(db,TEACHER,'quiz_compose',good),/student_required/);await assert.rejects(rpc(db,studentId(3),'quiz_compose',good),/roster_required/);
 await assert.rejects(rpc(db,studentId(1),'quiz_compose',{kind:'extension',count:3,request_id:crypto.randomUUID(),attempt_id:crypto.randomUUID(),question_id:'pool_1'}),/wrong_question_unavailable/);
 await db.query('delete from public.quiz_question_pool where difficulty<>0');const small=await rpc(db,studentId(1),'quiz_compose',good);assert.equal(small.distribution.actual,4);assert.equal(small.distribution.medium,4);assert.equal(small.distribution.hard,0);
 const privateSession=await quizCall(db,studentId(1),'join',{session_id:small.session_id});const a=privateSession.attempt_id;const q=privateSession.document.questions[0];
 await db.query("update public.quiz_sessions set reveal='complete' where id=$1",[small.session_id]);await quizCall(db,studentId(1),'submit',{session_id:small.session_id,question_id:q.id,response:'b',request_id:crypto.randomUUID()});
 await assert.rejects(rpc(db,studentId(1),'quiz_compose',{kind:'extension',count:3,request_id:crypto.randomUUID(),attempt_id:a,question_id:q.id}),/wrong_question_unavailable/);
}finally{await db.close();}});
test('完全相同內容不湊題，延伸不加入沒有解析的候選',async()=>{const db=await setup();try{
 await db.query("update public.quiz_question_pool set group_key='same-content'");
 const made=await rpc(db,studentId(1),'quiz_compose',{kind:'self',count:10,units:[1,2],request_id:crypto.randomUUID()});assert.equal(made.distribution.actual,1);
 const joined=await quizCall(db,studentId(1),'join',{session_id:made.session_id}),q=joined.document.questions[0];
 await quizCall(db,studentId(1),'submit',{session_id:made.session_id,question_id:q.id,response:'b',request_id:crypto.randomUUID()});
 await db.query('update public.quiz_question_pool set group_key=question_id,publisher_explanation=false');
 await assert.rejects(rpc(db,studentId(1),'quiz_compose',{kind:'extension',count:3,request_id:crypto.randomUUID(),attempt_id:joined.attempt_id,question_id:q.id}),/pool_empty/);
 const catalog=await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');return (await tx.query('select public.quiz_pool_catalog() result')).rows[0].result;});assert.equal(catalog.total,24);assert.equal(catalog.available,true);
}finally{await db.close();}});
