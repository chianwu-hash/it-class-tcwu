import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,TEACHER,OTHER_TEACHER,studentId} from '../lib/quiz-local-db.mjs';
import {newDocument,newQuestion,content} from '../../shared/quiz-document.mjs';
import {createMediaScope} from '../../shared/quiz-media.mjs';
const sql=path=>readFile(new URL('../../supabase/'+path,import.meta.url),'utf8');

test('媒體情境：合併、短效、失敗重試、併發上限與換人隔離',async()=>{
 let calls=0,clock=0,concurrent=0,max=0,valid=true,fail=false;
 const url=n=>'https://quiz-media.invalid/'+TEACHER+'/'+String(n).padStart(64,'0');
 const scope=createMediaScope({context:{user_id:'one',attempt_id:'a',version_id:'v',generation:1},now:()=>clock,valid:()=>valid,concurrency:2,
  read:async(u,c)=>{calls++;concurrent++;max=Math.max(max,concurrent);await new Promise(r=>setTimeout(r,10));concurrent--;assert.equal(c.user_id,'one');if(fail)throw Error('network');return {url:u+'?ticket'};}});
 assert.deepEqual(await Promise.all([scope.resolve(url(1)),scope.resolve(url(1))]),[url(1)+'?ticket',url(1)+'?ticket']);assert.equal(calls,1);
 await scope.resolve(url(1));assert.equal(calls,1);clock=45001;await scope.resolve(url(1));assert.equal(calls,2);
 await Promise.all([2,3,4,5,6].map(n=>scope.resolve(url(n))));assert.equal(max,2);
 fail=true;await assert.rejects(scope.resolve(url(7)));fail=false;await scope.resolve(url(7));assert.equal(calls,9);
 const old=scope.resolve(url(8));valid=false;await assert.rejects(old,/變更/);await assert.rejects(scope.resolve(url(1)),/變更/);scope.dispose();
});

test('SQL等價：目錄、單卷入口、題組／整卷媒體、關場、移除、名冊、舊重送',async()=>{
 const db=await createQuizDb();
 const call=(uid,fn,args=[])=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec('set local role authenticated');return (await tx.query(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;});
 try{
  for(const f of ['quiz-wrong-questions.sql','quiz-pool.sql','quiz-rewards.sql'])await db.exec(await sql(f));
  for(const fn of ['quiz_pool_catalog','quiz_media_access']){
   const source=(await db.query("select pg_get_functiondef(oid) source from pg_proc where pronamespace='public'::regnamespace and proname=$1",[fn])).rows[0].source;
   await db.exec(source.replace('public.'+fn+'(', 'public.'+fn+'_before('));
  }
  const actionBefore=(await db.query("select md5(pg_get_functiondef('public.quiz_action(text,jsonb)'::regprocedure)) h")).rows[0].h;
  await db.exec(await sql('quiz-load-batch1.sql'));
  assert.equal((await db.query("select md5(pg_get_functiondef('public.quiz_action(text,jsonb)'::regprocedure)) h")).rows[0].h,actionBefore);
  const q=newQuestion();
  for(const [n,units] of [[1,[1,2]],[2,[]],[3,[10,2]],[4,[1]]])await db.query("insert into public.quiz_question_pool values($1,$1,$1,$2,'k','name',0,'test',false,$3,'{}',true)",['test'+n,JSON.stringify(units),q]);
  await db.exec("insert into public.quiz_courses values('disabled',6,'{}',false),('empty',6,'{}',true),('six',6,'{\"subject\":\"自然\",\"volume\":\"6年級上學期\",\"units\":{\"2\":\"二\",\"10\":\"十\"}}',true);insert into public.quiz_pool_membership values('test3','six',true),('test4','disabled',false)");
  for(const grade of [3,6]){
   await db.query('update public.student_enrollments set class_code=$1',[grade+'03']);
   assert.deepEqual(await call(studentId(1),'quiz_pool_catalog'),await call(studentId(1),'quiz_pool_catalog_before'));
  }
  await db.query("update public.quiz_name_characters set enabled=false where id like 'pokemon%'");
  assert.deepEqual(await call(studentId(1),'quiz_pool_catalog'),await call(studentId(1),'quiz_pool_catalog_before'));
  const doc=newDocument();doc.catalog={...doc.catalog,subject:'數學',volume:'6年級上學期'};
  const media=n=>({kind:'image',alt:'測試圖片',url:`https://quiz-media.invalid/${TEACHER}/${String(n).padStart(64,'0')}`});
  const questions=[newQuestion(),newQuestion(),newQuestion()];
  questions.forEach((q,i)=>{q.prompt.media=[media(i+1)];q.explanation.media=[media(i+4)];q.options[0].content.media=[media(i+7)];});
  doc.blocks=[{id:'group',material:content('共用材料',[media(10)]),questions:questions.slice(0,2)},{id:'solo',material:content(),questions:questions.slice(2)}];
  const bank=crypto.randomUUID(),vid=crypto.randomUUID();
  await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,TEACHER,doc]);
  await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[vid,bank,doc]);
  for(let n=1;n<=10;n++)await db.query('insert into public.quiz_media_assets values($1,$2,$3,$4,1)',[media(n).url,TEACHER,'object'+n,'image/png']);
  const equivalent=async(uid,attempt)=>{for(let n=1;n<=10;n++){
   const outcome=async fn=>{try{return {value:await call(uid,fn,[media(n).url,attempt])};}catch(e){return {error:e.message};}};
   assert.deepEqual(await outcome('quiz_media_access'),await outcome('quiz_media_access_before'),`media ${n} uid ${uid}`);
  }};
  for(const reveal of ['immediate','complete']){
   const sid=crypto.randomUUID(),data={session_id:sid,version_id:vid,school_year:115,class_codes:['603'],reveal,shuffle_questions:false,shuffle_options:false};
   await quizCall(db,TEACHER,'open',data);
   const before=(await db.query('select count(*) n from public.quiz_attempts')).rows[0].n;
   // Batch4 adds the caller's own roster label (identity) for the navbar; other fields unchanged.
   const {identity:_label,...entry}=await call(studentId(1),'quiz_entry_context',[{session_id:sid}]);assert.deepEqual(entry,{role:'student',grade:6,subject:'數學',version_id:vid});
   assert.equal((await db.query('select count(*) n from public.quiz_attempts')).rows[0].n,before);
   const joined=await quizCall(db,studentId(1),'join',data);await equivalent(studentId(1),joined.attempt_id);await equivalent(studentId(2),joined.attempt_id);await equivalent(OTHER_TEACHER,joined.attempt_id);await equivalent(TEACHER,null);
   let last;
   for(const q of questions){last={session_id:sid,question_id:q.id,response:'a',request_id:crypto.randomUUID(),compact:true};await quizCall(db,studentId(1),'submit',last);await equivalent(studentId(1),joined.attempt_id);}
   await quizCall(db,TEACHER,'close',data);await equivalent(studentId(1),joined.attempt_id);
   assert.equal((await quizCall(db,studentId(1),'submit',last)).responses[questions[2].id],'a');
   await db.query("update public.student_enrollments set class_code='301' where email='student1@example.invalid'");await equivalent(studentId(1),joined.attempt_id);
   assert.equal((await call(studentId(1),'quiz_entry_context',[{session_id:sid}])).subject,null);
   await db.query("update public.student_enrollments set class_code='603'");
   // Classroom omitted from library is still accessible through the single-session entry.
   assert.equal((await call(studentId(1),'quiz_entry_context',[{session_id:sid}])).subject,'數學');
  }
  const removed=crypto.randomUUID();
  await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,access_mode,shuffle_questions,shuffle_options) values($1,$2,$3,115,'[\"603\"]','immediate','self',false,false)",[removed,studentId(1),vid]);
  await db.query("insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution) values($1,$2,$3,'{}','{}')",[removed,studentId(1),crypto.randomUUID()]);
  const own=await quizCall(db,studentId(1),'join',{session_id:removed});
  await db.query('update public.quiz_generated_papers set deleted_at=now() where session_id=$1',[removed]);
  assert.equal((await call(studentId(1),'quiz_entry_context',[{session_id:removed}])).version_id,vid);
  assert.equal((await call(studentId(2),'quiz_entry_context',[{session_id:removed}])).version_id,null);
  assert.equal((await quizCall(db,studentId(1),'library_sessions')).sessions.some(s=>s.id===removed),false);
  assert.equal((await quizCall(db,studentId(1),'resume',{session_id:removed})).attempt_id,own.attempt_id);await equivalent(studentId(1),own.attempt_id);
  await db.query('update auth.users set email_confirmed_at=null where id=$1',[studentId(1)]);await equivalent(studentId(1),own.attempt_id);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[studentId(1)]);
  await db.query("update public.quiz_sessions set access_mode='personal' where id=$1",[removed]);await equivalent(studentId(1),own.attempt_id);
  await equivalent(null,null);
  await assert.rejects(call(TEACHER,'quiz_entry_context',[{session_id:crypto.randomUUID()}]),/student_required/);
  await assert.rejects(call(studentId(1),'quiz_media_visible',[media(1).url,crypto.randomUUID()]),/permission denied/);
  assert.equal((await call(studentId(1),'quiz_entry_context',[{session_id:crypto.randomUUID()}])).version_id,null);
 }finally{await db.close();}
});
