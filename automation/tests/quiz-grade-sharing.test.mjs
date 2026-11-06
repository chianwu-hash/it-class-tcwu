import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';
import {newDocument,newQuestion,content} from '../../shared/quiz-document.mjs';
test('年級共用貫通清單、作答、媒體與回報；私人卷／課堂卷仍隔離',async t=>{
 const f=await setupProductionQuizDB(),{db,uid}=f;
 const rpc=async(n,name,args)=>{await f.as(n);try{return(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;}finally{await db.exec('reset role');}};
 const call=(n,action,data={})=>rpc(n,'quiz_action',[action,data]);let sid,doc,attempt,asset;
 try{
 for(const[n,cls]of[[1,null],[2,'301'],[3,'307'],[4,'407'],[5,'603']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),n===1?'teacher@example.invalid':`student${n}@example.invalid`]);
  if(cls)await db.query('insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values(115,$1,$2,$3,$4)',[`student${n}@example.invalid`,cls,n,'合成同學'+n]);
 }
 await db.exec('create trigger quiz_version_meta after insert or update of document on public.quiz_versions for each row execute function public.quiz_version_meta_trigger()');
 await db.exec('insert into partner_pilot.settings values(true,true)');
 asset=`https://quiz-media.invalid/${uid(1)}/${'a'.repeat(64)}`;
 await db.query('insert into public.quiz_media_assets(url,owner_id,object_path,mime,bytes) values($1,$2,$3,$4,100)',[asset,uid(1),'synthetic-image','image/png']);
 doc=newDocument();doc.title='三上合成年級卷';doc.catalog={...doc.catalog,volume:'3年級上學期',subject:'數學'};
 doc.blocks=Array.from({length:20},(_,i)=>{const q=newQuestion();q.id='q'+i;q.prompt=content('合成條件'+i,i===0?[{kind:'image',url:asset,alt:'合成圖'}]:[]);q.explanation=content('送答後才揭露的解析');return{id:'b'+i,material:content(),questions:[q]};});
 const bank=uid(101),version=uid(102);sid=uid(103);
 await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,uid(1),doc]);
 await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,doc]);
 await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'[\"301\"]','immediate',false,false,'practice')",[sid,uid(1),version]);
 await t.test('原先跨班被拒絕、套用只改函式不改session或原卷',async()=>{
  await assert.rejects(call(3,'join',{session_id:sid}),/roster_required/);
  const before=(await db.query('select to_jsonb(s) data from public.quiz_sessions s where id=$1',[sid])).rows[0].data;
  const authority=(await db.query("select oid,proowner,proacl::text from pg_proc where oid='public.quiz_action_before_learning(text,jsonb)'::regprocedure")).rows[0];
  await db.exec(await fs.readFile('supabase/quiz-grade-sharing.sql','utf8'));
  assert.deepEqual((await db.query('select to_jsonb(s) data from public.quiz_sessions s where id=$1',[sid])).rows[0].data,before);
  assert.deepEqual((await db.query("select oid,proowner,proacl::text from pg_proc where oid='public.quiz_action_before_learning(text,jsonb)'::regprocedure")).rows[0],authority);
 });
 await t.test('同年級不同班清單與進場正常，跨年級及教師拒絕且揭答前不洩答案',async()=>{
  const list=await call(3,'library_sessions');assert(list.sessions.some(s=>s.id===sid));
  attempt=await call(3,'join',{session_id:sid});assert.equal(attempt.document.questions.length,20);assert.doesNotMatch(JSON.stringify(attempt),/送答後才揭露|option_id|explanation/);
  await assert.rejects(call(4,'join',{session_id:sid}),/roster_required/);await assert.rejects(call(1,'join',{session_id:sid}),/student_required/);
  assert.equal((await call(4,'library_sessions')).sessions.length,0);
 });
 await t.test('同年級跨班媒體、entry context、送答／重整與題目回報不中斷',async()=>{
  const aid=attempt.attempt_id??attempt.attempt?.id??attempt.id;assert(aid);
  const ctx=await rpc(3,'quiz_entry_context',[{session_id:sid}]);assert.equal(ctx.version_id,version);
  const media=await rpc(3,'quiz_media_access',[asset,aid]);assert.equal(media.url,asset);
  for(const b of doc.blocks)await call(3,'submit',{session_id:sid,question_id:b.questions[0].id,response:b.questions[0].answer.option_id,request_id:crypto.randomUUID()});
  const resumed=await call(3,'resume',{session_id:sid});assert.equal(resumed.reviews.length,20);assert.equal(resumed.complete,true);
  const report=await rpc(3,'quiz_question_report',[{source:'quiz',attempt_id:aid,question_id:'q0',category:'question',description:'合成測試回報',request_id:crypto.randomUUID()}]);assert(report.id);
 });
 await t.test('新增班級自動沿用年級權限；隱藏卷不回到清單，原作答可接續',async()=>{
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(6),'student6@example.invalid']);
  await db.query("insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values(115,'student6@example.invalid','308',6,'新增班合成同學')");
  assert((await call(6,'library_sessions')).sessions.some(s=>s.id===sid));
  await db.query('update public.quiz_sessions set library_visible=false where id=$1',[sid]);assert.equal((await call(3,'library_sessions')).sessions.length,0);assert.equal((await rpc(3,'quiz_library_sessions',[{}])).sessions.length,0);assert.equal((await call(3,'resume',{session_id:sid})).reviews.length,20);
  await assert.rejects(call(6,'join',{session_id:sid}),/roster_required/);assert.equal((await db.query('select count(*)::int n from public.quiz_attempts where session_id=$1 and user_id=$2',[sid,uid(6)])).rows[0].n,0);
  const adminRows=(await db.query('select * from public.admin_learning_paper_rows($1,115,$2)',[uid(3),'307'])).rows;assert(adminRows.length>0);
 });
 await t.test('自組私人卷與課堂測驗維持原本班級與所有權，內部helper不可直接呼叫',async()=>{
  for(const[mode,n]of[['classroom',104],['self',105]])await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'[\"301\"]','immediate',false,false,$4)",[uid(n),uid(2),version,mode]);
  await assert.rejects(call(3,'join',{session_id:uid(104)}),/roster_required/);await assert.rejects(call(3,'join',{session_id:uid(105)}),/session_unavailable|roster_required/);
  await f.as(3);try{await assert.rejects(db.query('select public.quiz_session_class_allowed($1,$2)',[sid,'307']),/permission denied/);}finally{await db.exec('reset role');}
 });
 }finally{await db.close();}
});
