import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,studentId,TEACHER,OTHER_TEACHER} from '../lib/quiz-local-db.mjs';
import {newDocument,newQuestion,content} from '../../shared/quiz-document.mjs';
const sql=f=>readFile(new URL('../../supabase/'+f,import.meta.url),'utf8');
const rpc=(db,uid,name,data={},role='authenticated')=>db.transaction(async tx=>{
 await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec('set local role '+role);
 return (await tx.query(`select public.${name}($1) result`,[JSON.stringify(data)])).rows[0].result;
});
const outcome=async fn=>{try{return {value:await fn()};}catch(e){return {error:e.message};}};
async function setup(){const db=await createQuizDb(undefined,{batch2:false,batch3:false});for(const f of ['quiz-wrong-questions.sql','quiz-pool.sql','quiz-rewards.sql','quiz-load-batch1.sql'])await db.exec(await sql(f));return db;}
async function paper(db,{reveal='immediate',count=4,group=true}={}){
 const doc=newDocument();doc.catalog={...doc.catalog,volume:'6年級上學期',subject:'數學',unit:'第一單元'};
 const qs=Array.from({length:count},(_,i)=>{const q=newQuestion(i===count-1?'short':'single');q.prompt=content('第'+i+'題');q.explanation=content('解析'+i);return q;});
 doc.blocks=group?[{id:'group',material:content('材料'),questions:qs.slice(0,2)},...qs.slice(2).map((q,i)=>({id:'solo'+i,material:content(),questions:[q]}))]:qs.map((q,i)=>({id:'b'+i,material:content(),questions:[q]}));
 const bank_id=crypto.randomUUID();await quizCall(db,TEACHER,'save',{bank_id,expected_revision:0,document:doc});
 const version=await quizCall(db,TEACHER,'publish',{bank_id,expected_revision:1});
 const session={session_id:crypto.randomUUID(),version_id:version.id,school_year:115,class_codes:['603'],reveal,access_mode:'practice',shuffle_questions:false,shuffle_options:true};
 await quizCall(db,TEACHER,'open',session);return {doc,qs,bank_id,version,session};
}
async function aliases(db){for(const name of ['quiz_wrong_questions','quiz_compose']){let s=(await db.query("select pg_get_functiondef(oid) s from pg_proc where pronamespace='public'::regnamespace and proname=$1",[name])).rows[0].s;
 s=s.replace('public.'+name+'(', 'public.'+name+'_before2(');if(name==='quiz_compose')s=s.replaceAll('public.quiz_wrong_questions(', 'public.quiz_wrong_questions_before2(');await db.exec(s);}}
const unchanged=async db=>(await db.query("select proname,md5(pg_get_functiondef(oid)) hash from pg_proc where pronamespace='public'::regnamespace and proname in('quiz_action','quiz_answer_guard','quiz_leaf_result','quiz_media_access','quiz_media_visible') order by proname")).rows;
test('第二批：錯題全量JSON等價、題組／整卷、亂序、移除、名冊、私有索引、教師版本按需',async()=>{
 const db=await setup();try{
  const before=await paper(db);await aliases(db);const core=await unchanged(db);await db.exec(await sql('quiz-load-batch2.sql'));assert.deepEqual(await unchanged(db),core);
  assert.equal((await db.query('select total from public.quiz_version_meta where version_id=$1',[before.version.id])).rows[0].total,4);
  const compare=async(uid,data={})=>{const current=await outcome(()=>rpc(db,uid,'quiz_wrong_questions',data));const old=await outcome(()=>rpc(db,uid,'quiz_wrong_questions_before2',data));
   if(current.value&&data.action==='detail'){const {version_id,can_extend,...rest}=current.value;assert.ok(version_id);assert.equal(typeof can_extend,'boolean');assert.deepEqual({value:rest},old);}else assert.deepEqual(current,old);return current.value;};
  for(const reveal of ['immediate','complete']){
   const p=await paper(db,{reveal}),joined=await quizCall(db,studentId(1),'join',p.session);
   for(const [i,q] of p.qs.entries()){
    await compare(studentId(1));await compare(studentId(1),{action:'detail',attempt_id:joined.attempt_id,question_id:q.id});
    await quizCall(db,studentId(1),'submit',{session_id:p.session.session_id,question_id:q.id,response:q.type==='short'?'錯誤答案':i===1?'a':'b',request_id:crypto.randomUUID(),compact:true});
    await compare(studentId(1));
    for(const tested of p.qs)await compare(studentId(1),{action:'detail',attempt_id:joined.attempt_id,question_id:tested.id});
   }
   for(const args of [{grade:3},{page:1},{subject:'數學',unit:'第一單元'},{subject:'自然'},{action:'bad'},{page:-1},{page:'abc'},{grade:4},{action:'detail',attempt_id:'bad',question_id:'bad'}])await compare(studentId(1),args);
   if(reveal==='complete'){
    await db.query("insert into public.quiz_answers(attempt_id,question_id,request_id,response,correct) values($1,'stray-answer',$2,'\"bad\"',false)",[joined.attempt_id,crypto.randomUUID()]);
    await compare(studentId(1));await compare(studentId(1),{action:'detail',attempt_id:joined.attempt_id,question_id:p.qs[0].id});
    await db.query("delete from public.quiz_answers where attempt_id=$1 and question_id='stray-answer'",[joined.attempt_id]);
   }
   await compare(studentId(2),{action:'detail',attempt_id:joined.attempt_id,question_id:p.qs[0].id});
   await quizCall(db,TEACHER,'close',p.session);await compare(studentId(1),{action:'detail',attempt_id:joined.attempt_id,question_id:p.qs[0].id});
   await db.query("update public.student_enrollments set class_code='301' where email='student1@example.invalid'");await compare(studentId(1));
   await db.query("update public.student_enrollments set class_code='603'");
  }
  for(const uid of [TEACHER,OTHER_TEACHER,null])await compare(uid);
  assert.deepEqual(await rpc(db,studentId(1),'quiz_library_sessions'),await quizCall(db,studentId(1),'library_sessions'));
  const versionList=await rpc(db,TEACHER,'quiz_version_browser',{bank_id:before.bank_id});assert.equal(versionList.versions.length,1);assert.equal(versionList.versions[0].document,undefined);assert.equal(versionList.versions[0].total,4);
  assert.deepEqual(await rpc(db,TEACHER,'quiz_version_browser',{action:'get',bank_id:before.bank_id,version_id:before.version.id}),before.version);
  await assert.rejects(rpc(db,OTHER_TEACHER,'quiz_version_browser',{bank_id:before.bank_id}),/bank_unavailable/);await assert.rejects(rpc(db,studentId(1),'quiz_version_browser',{bank_id:before.bank_id}),/teacher_required/);
  for(const table of ['quiz_version_meta'])await db.transaction(async tx=>{await tx.exec('set local role authenticated');await assert.rejects(tx.query('select * from public.'+table),/permission denied/);});
  for(const args of ["quiz_wrong_refs(6,null,null)","quiz_cache_version(null,'{}')","quiz_extension_source(null,'x','{}',6)"] )await db.transaction(async tx=>{await tx.exec('set local role authenticated');await assert.rejects(tx.query('select public.'+args),/permission denied/);});
  const indexed=(await db.query('select count(*) n from public.quiz_version_meta')).rows[0].n;await db.exec(await sql('quiz-load-batch2.sql'));assert.equal((await db.query('select count(*) n from public.quiz_version_meta')).rows[0].n,indexed);
 }finally{await db.close();}
});

test('第二批：可靠來源、跨科別名、延伸選題／重送與新卷metadata原子一致',async()=>{
 const db=await setup();try{
  await aliases(db);await db.exec(await sql('quiz-load-batch2.sql'));
  const p=await paper(db,{count:2,group:false}),joined=await quizCall(db,studentId(1),'join',p.session);
  await db.query("insert into public.quiz_courses values('six-math',6,'{\"subject\":\"數學\",\"volume\":\"6年級上學期\",\"units\":{\"1\":\"一\"}}',true)");
  for(let i=0;i<8;i++){const q=i===0?p.qs[0]:newQuestion();await db.query("insert into public.quiz_question_pool values($1,$1,$1,'[1]','point','重點',0,'fixture',true,$2,'{}',true)",[q.id,q]);await db.query("insert into public.quiz_pool_membership values($1,'six-math',true)",[q.id]);}
  const pending={session_id:p.session.session_id,question_id:p.qs[0].id,response:'b',request_id:crypto.randomUUID(),compact:true};await quizCall(db,studentId(1),'submit',pending);
  const args={action:'detail',attempt_id:joined.attempt_id,question_id:p.qs[0].id};assert.equal((await rpc(db,studentId(1),'quiz_wrong_questions',args)).can_extend,true);
  const conf={kind:'extension',count:3,attempt_id:joined.attempt_id,question_id:p.qs[0].id,request_id:crypto.randomUUID()};
  const snapshots=[];for(const name of ['quiz_compose_before2','quiz_compose']){try{await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');await tx.query('select setseed(0.42)');const out=(await tx.query(`select public.${name}($1) r`,[conf])).rows[0].r;await tx.exec('reset role');const v=(await tx.query('select document from public.quiz_versions v join public.quiz_sessions s on s.version_id=v.id where s.id=$1',[out.session_id])).rows[0].document;snapshots.push({distribution:out.distribution,name:out.display_name,document:v});throw Error('ROLLBACK_FIXTURE');});}catch(e){if(e.message!=='ROLLBACK_FIXTURE')throw e;}}
  assert.deepEqual(snapshots[0],snapshots[1]);
  const composed=await rpc(db,studentId(1),'quiz_compose',conf),repeated=await rpc(db,studentId(1),'quiz_compose',conf);assert.equal(repeated.session_id,composed.session_id);
  assert.equal((await db.query('select total from public.quiz_version_meta m join public.quiz_sessions s on s.version_id=m.version_id where s.id=$1',[composed.session_id])).rows[0].total,3);
  await rpc(db,studentId(1),'quiz_delete_paper',{session_id:composed.session_id});assert.deepEqual(await rpc(db,studentId(1),'quiz_library_sessions'),await quizCall(db,studentId(1),'library_sessions'));
  await db.query('update public.quiz_pool_membership set knowledge_reliable=false where question_id=$1',[p.qs[0].id]);assert.equal((await rpc(db,studentId(1),'quiz_wrong_questions',args)).can_extend,false);await assert.rejects(rpc(db,studentId(1),'quiz_compose',{...conf,request_id:crypto.randomUUID()}),/extension_unavailable/);
  const originalCount=(await db.query('select count(*) n from public.quiz_version_meta')).rows[0].n;
  const id=crypto.randomUUID();await assert.rejects(db.transaction(async tx=>{await tx.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,99,$3)',[id,p.bank_id,p.doc]);throw Error('ROLLBACK_FIXTURE');}),/ROLLBACK_FIXTURE/);
  assert.equal((await db.query('select count(*) n from public.quiz_version_meta')).rows[0].n,originalCount);
 }finally{await db.close();}
});
