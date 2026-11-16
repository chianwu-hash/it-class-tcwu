import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {TEACHER,studentId,quizCall} from '../lib/quiz-local-db.mjs';
import {createOpenSelfReviewDb} from '../lib/quiz-open-self-review-fixture.mjs';
import {newDocument,content,validateDocument} from '../../shared/quiz-document.mjs';
import {openResponseError} from '../../shared/quiz-open-response.mjs';
import {buildOpenSelfReviewMigration} from '../lib/quiz-open-self-review-migration.mjs';
const {definitions}=JSON.parse(await readFile('automation/fixtures/quiz-open-self-review-before.json','utf8'));
const helpers=(await readFile('supabase/quiz-open-self-review-helpers.sql','utf8')).replace(/\r\n/g,'\n');
const migration=buildOpenSelfReviewMigration(definitions,helpers);
const raw=f=>JSON.stringify({v:1,f});
const open=(id='open')=>({id,type:'open',prompt:content('合成原開放題：用「努力」造句，並寫一句自己的想法。'),explanation:content('例句只供參考，其他合理答案也可以。'),fields:[{id:'sentence',label:'原第1空：造句',input:'text'},{id:'idea',label:'原第2空：自己的想法',input:'text'}],answer:{format:'self-review-v1',fields:{sentence:{examples:['秘密參考例句42：我努力完成今天的練習。'],criteria:['句子使用努力且語意通順']},idea:{examples:['我會分段練習。'],criteria:['自己的想法清楚完整']}}}});
const automatic=(id='automatic')=>({id,type:'short',prompt:content('合成自動題'),explanation:content('秘密自動解析99'),answer:{accepted:['甲']}});
async function database(){
 return createOpenSelfReviewDb();
}
async function seed(db,questions=[open()],{sameBlock=false,reveal='immediate',mode='practice'}={}){
 const document=newDocument();document.catalog.volume='6年級上學期';document.catalog.subject='國語';document.blocks=sameBlock?[{id:'group',material:content(),questions}]:questions.map((q,i)=>({id:'b'+i,material:content(),questions:[q]}));validateDocument(document);
 await db.query('select public.quiz_validate($1)',[document]);const bank=randomUUID(),version=randomUUID(),session=randomUUID();
 await db.query('insert into public.quiz_banks(id,owner_id,draft)values($1,$2,$3)',[bank,TEACHER,document]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document)values($1,$2,1,$3)',[version,bank,document]);
 await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)values($1,$2,$3,115,'[\"603\"]',$4,false,false,$5)",[session,TEACHER,version,reveal,mode]);return {document,bank,version,session,questions};
}
async function seen(db,p,qid,uid=studentId(1)){
 const state=await quizCall(db,uid,'join',{session_id:p.session});await quizCall(db,uid,'view_question',{session_id:p.session,question_id:qid});await db.query("update public.quiz_question_timing set first_seen=clock_timestamp()-interval '1 hour' where attempt_id=$1",[state.attempt_id]);return state;
}
const send=(db,p,qid,response,request=randomUUID(),uid=studentId(1))=>quizCall(db,uid,'submit',{session_id:p.session,question_id:qid,response,request_id:request,compact:true});
const check=(db,p,qid,rating='understood',request=randomUUID(),uid=studentId(1),note='')=>quizCall(db,uid,'self_check',{session_id:p.session,question_id:qid,self_rating:rating,self_note:note,request_id:request,compact:true});
const response=()=>raw({sentence:'今天我努力把事情做完。',idea:'我願意先練習比較難的部分。'});

test('開放作答原生自評：儲存、揭參考、冪等、接回、權限與舊判分',async t=>{
 const db=await database();try{
  await t.test('只有正確的原生開放格式可匯入，非空及未知欄位前後端一致拒絕',async()=>{
   const doc=newDocument();doc.blocks[0].questions=[open()];assert.equal(validateDocument(doc),doc);assert.equal(openResponseError(open(),response()),'');assert.notEqual(openResponseError(open(),raw({sentence:'',idea:'想法'})),'');
   for(const modify of [q=>q.answer.fields.sentence.examples=[],q=>q.answer.fields.sentence.hidden='secret',q=>q.fields[0].input='single',q=>q.fields.push({...q.fields[0]}),q=>q.answer.accepted=['假標準答案']]){
    const q=open();modify(q);const invalid=newDocument();invalid.blocks[0].questions=[q];assert.throws(()=>validateDocument(invalid));await assert.rejects(db.query('select public.quiz_validate($1)',[invalid]));
   }
  });
  await t.test('先儲存全原目標才揭參考；自評前不完成且不產生自動對錯',async()=>{
   const p=await seed(db),first=await seen(db,p,'open');assert.ok(!JSON.stringify(first).includes('秘密參考例句42'));assert.equal(first.document.questions[0].type,'open');assert.equal(first.document.questions[0].fields.length,2);
   await assert.rejects(check(db,p,'open'),/open_answer_required/);
   for(const invalid of [raw({sentence:'',idea:'x'}),raw({sentence:'x'}),raw({sentence:'x',idea:'y',extra:'z'}),'false','{"v":1,"f":{"sentence":"x","sentence":"y","idea":"z"}}'])await assert.rejects(send(db,p,'open',invalid),/invalid_response/);
   const saved=await send(db,p,'open',response());assert.equal(saved.complete,false);assert.equal(saved.reviews[0].correct,null);assert.equal(saved.open_responses.open.status,'saved');assert.ok(JSON.stringify(saved).includes('秘密參考例句42'));assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[first.attempt_id])).rows[0].n,0);
   const done=await check(db,p,'open','practice');assert.equal(done.complete,true);assert.equal(done.reviews[0].assessment.rating,'practice');assert.equal(done.reviews[0].correct,null);
   const resumed=await quizCall(db,studentId(1),'resume',{session_id:p.session});assert.equal(resumed.complete,true);assert.equal(resumed.responses.open,response());assert.equal(resumed.open_responses.open.rating,'practice');
  });
  await t.test('同 request_id 重送及送達後回應遺失可接回；不同內容衝突且跨題 UUID 不可混用',async()=>{
   const p=await seed(db,[open(),automatic()]),first=await seen(db,p,'open'),request=randomUUID(),ratingRequest=randomUUID();
   await send(db,p,'open',response(),request);await send(db,p,'open',response(),request);await assert.rejects(send(db,p,'open',raw({sentence:'另一個句子',idea:'x'}),request),/submission_conflict/);
   await check(db,p,'open','understood',ratingRequest);await check(db,p,'open','understood',ratingRequest);await assert.rejects(check(db,p,'open','practice',ratingRequest),/submission_conflict/);
   await seen(db,p,'automatic');await assert.rejects(send(db,p,'automatic','甲',request),/submission_conflict/);await assert.rejects(send(db,p,'automatic','甲',ratingRequest),/submission_conflict/);
   const done=await send(db,p,'automatic','甲');assert.equal(done.complete,true);assert.equal(done.reviews.find(r=>r.question_id==='automatic').correct,true);assert.equal((await db.query('select count(*)::int n from public.quiz_open_responses where attempt_id=$1',[first.attempt_id])).rows[0].n,1);
  });
  await t.test('自評未完成不可跳題；延後揭答不提前揭露同組自動答案',async()=>{
   const p=await seed(db,[automatic(),open()],{sameBlock:true,reveal:'complete'});await seen(db,p,'automatic');const a=await send(db,p,'automatic','甲');assert.equal(a.reviews.length,0);await seen(db,p,'open');const b=await send(db,p,'open',response());assert.equal(b.reviews.length,1);assert.equal(b.reviews[0].question_id,'open');assert.ok(!JSON.stringify(b).includes('秘密自動解析99'));const c=await check(db,p,'open');assert.equal(c.complete,true);assert.equal(c.reviews.length,2);
   const second=await seed(db,[open(),automatic()]);await seen(db,second,'open');await send(db,second,'open',response());await assert.rejects(send(db,second,'automatic','甲'),/question_order/);
  });
  await t.test('匿名、教師、非名冊及跨本人狀態不能讀參考或寫自評',async()=>{
   const p=await seed(db);await seen(db,p,'open');await send(db,p,'open',response());
   await assert.rejects(quizCall(db,null,'join',{session_id:p.session},'anon'),/permission denied|login_required/);await assert.rejects(quizCall(db,TEACHER,'self_check',{session_id:p.session,question_id:'open'}),/student_required/);
   const other=await quizCall(db,studentId(2),'join',{session_id:p.session});assert.ok(!JSON.stringify(other).includes('秘密參考例句42'));await assert.rejects(check(db,p,'open','understood',randomUUID(),studentId(2)),/open_answer_required/);
   await db.query('delete from public.student_enrollments where email=$1',['student31@example.invalid']);await assert.rejects(quizCall(db,studentId(31),'join',{session_id:p.session}),/roster_required/);
   await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.quiz_open_responses');}),/permission denied/);
   await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.quiz_response_rows($1)',[other.attempt_id]);}),/permission denied/);
  });
  await t.test('關場後拒絕新的自評，但已送達的相同保存可重試且舊自動題不受影響',async()=>{
   const p=await seed(db),request=randomUUID();await seen(db,p,'open');await send(db,p,'open',response(),request);await db.query("update public.quiz_sessions set status='closed' where id=$1",[p.session]);await assert.rejects(check(db,p,'open'),/session_closed/);assert.equal((await send(db,p,'open',response(),request)).open_responses.open.status,'saved');
   const old=await seed(db,[automatic()]);await seen(db,old,'automatic');const wrong=await send(db,old,'automatic','乙');assert.equal(wrong.reviews[0].correct,false);assert.equal(wrong.complete,true);assert.equal(Object.hasOwn(wrong,'open_responses'),false);
  });
  await t.test('自評不算錯題；可自動判分題才計正確率與葉片門檻',async()=>{
   await db.exec('update public.quiz_integrity_settings set enabled=true,min_seconds=1 where id;');
   const questions=[...Array.from({length:10},(_,i)=>automatic('auto'+i)),open()];const p=await seed(db,questions);let state;
   for(const q of questions.slice(0,10)){await seen(db,p,q.id);state=await send(db,p,q.id,'甲');}
   await seen(db,p,'open');state=await send(db,p,'open',response());assert.equal(state.complete,false);assert.equal(state.leaf.earned,false);
   state=await check(db,p,'open','practice');assert.equal(state.complete,true);assert.equal(state.leaf.earned,true,JSON.stringify(state.leaf));assert.equal((await db.query('select total,correct from public.quiz_leaf_awards where attempt_id=$1',[state.attempt_id])).rows[0].total,10);assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1 and not correct',[state.attempt_id])).rows[0].n,0);
   const monitor=await quizCall(db,TEACHER,'monitor',{session_id:p.session});assert.equal(monitor.students[0].answered,11);
  });
  await t.test('自組卷保留完整原開放欄位、教材授權及固定參考；強制 hash join 仍依序自評',async()=>{
   const course='synthetic-open-g6',book=randomUUID();
   await db.query('insert into public.quiz_courses values($1,6,$2,true)',[course,{subject:'國語',publisher:'合成',volume:'6年級上學期',units:{7:'開放作答'}}]);
   await db.query("insert into public.quiz_textbooks values($1,6,115,1,'合成課本',$2,false)",[book,'a'.repeat(64)]);
   await db.query("insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes)values($1,'p81','{81}','same-unit',$2,100)",[book,'b'.repeat(64)]);await db.query('update public.quiz_textbooks set enabled=true where id=$1',[book]);
   for(let i=0;i<5;i++){
    const q=open('open-parent'+i);q.prompt.text+='第'+i+'組';
    await db.query("insert into public.quiz_question_pool values($1,$1,$1,'[7]','unmapped','待配題',0,'open-test',false,$2,'{}',true)",[q.id,q]);await db.query('insert into public.quiz_pool_membership values($1,$2,false)',[q.id,course]);
    await db.query("insert into public.quiz_pool_study_sources values($1,$2,$3,$4,81,'{81}','合成開放解析','{\"teacher_secret\":true}','{\"synthetic\":true}',true)",[q.id,course,q,book]);
   }
   const as=(uid,sql,args=[])=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');return(await tx.query(sql,args)).rows[0].r});
   const made=await as(studentId(1),'select public.quiz_compose($1)r',[{kind:'self',course_id:course,count:5,units:[7],difficulty:'medium',request_id:randomUUID()}]);const p={session:made.session_id},s=await quizCall(db,studentId(1),'join',{session_id:p.session});
   assert.equal(s.document.questions.length,5);assert.ok(s.document.questions.every(q=>q.type==='open'&&q.fields.length===2));assert.equal(s.study.pages.length,1);assert.equal(Object.keys(s.study.references).length,5);assert.doesNotMatch(JSON.stringify(s),/teacher_secret|秘密參考例句42|合成開放解析/);
   const grant=['normal',s.attempt_id,s.version_id,s.study.pages[0].url];assert.equal((await as(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4)r',grant)).backend,'drive');await assert.rejects(as(studentId(2),'select public.quiz_textbook_media_access($1,$2,$3,$4)r',grant),/attempt_unavailable/);await assert.rejects(quizCall(db,studentId(2),'join',{session_id:p.session}),/session_unavailable|roster_required/);
   await db.exec('set enable_nestloop=off;set enable_mergejoin=off;set enable_indexscan=off;set enable_bitmapscan=off;set enable_indexonlyscan=off');
   let state;for(const [i,q]of s.document.questions.entries()){
    await seen(db,p,q.id);state=await send(db,p,q.id,response());assert.equal(state.study.explanations[q.id].text,'合成開放解析');assert.equal(state.complete,false);
    if(i<4)await assert.rejects(send(db,p,s.document.questions[i+1].id,response()),/question_order/);
    state=await check(db,p,q.id,i%2?'practice':'understood');assert.equal(state.open_responses[q.id].status,'self_checked');
   }
   assert.equal(state.complete,true);assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[s.attempt_id])).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.quiz_open_responses where attempt_id=$1',[s.attempt_id])).rows[0].n,5);
   await db.exec('reset enable_nestloop;reset enable_mergejoin;reset enable_indexscan;reset enable_bitmapscan;reset enable_indexonlyscan');
  });
  await t.test('重複套用保護及未知 baseline／helper 拒絕，固定版本原文保持',async()=>{
   assert.equal((await readFile('supabase/quiz-open-self-review.sql','utf8')).replace(/\r\n/g,'\n'),migration.replace(/\r\n/g,'\n'));
   const p=await seed(db);const before=(await db.query('select md5(document::text)h from public.quiz_versions where id=$1',[p.version])).rows[0].h;await db.exec(migration);assert.equal((await db.query('select md5(document::text)h from public.quiz_versions where id=$1',[p.version])).rows[0].h,before);
   await db.exec("create or replace function public.quiz_open_validate(q jsonb) returns void language plpgsql immutable set search_path='' as $$begin raise exception 'tampered';end$$;");await assert.rejects(db.exec(migration),/open_review_helper_changed/);await db.exec('rollback;');await db.exec(helpers);
  });
 }finally{await db.close();}
});
