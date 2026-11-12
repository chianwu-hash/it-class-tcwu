import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQuizDb,PGlite,TEACHER,studentId,quizCall} from '../lib/quiz-local-db.mjs';
import {newDocument,content,validateDocument} from '../../shared/quiz-document.mjs';
import {fieldsResponseError,fieldsResponseSummary,fieldsAnswerSummary} from '../../shared/quiz-fields.mjs';
import {buildNormalFieldsMigration} from '../lib/quiz-normal-fields-migration.mjs';
const fixture=JSON.parse(await readFile('automation/fixtures/quiz-normal-fields-before.json','utf8'));
const helpers=await readFile('supabase/quiz-normal-fields-helpers.sql','utf8');
const migration=buildNormalFieldsMigration(fixture.definitions,helpers);
const snapshot=await readFile('supabase/production-snapshot/functions.sql','utf8');
const classHelper=snapshot.match(/CREATE OR REPLACE FUNCTION public\.quiz_session_class_allowed\([\s\S]*?(?=\r?\n-- )/)[0];
async function database(install=true){
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});db.exec=PGlite.prototype.exec.bind(db);
 for(const f of ['quiz-past-exams.sql','quiz-learning.sql','quiz-study.sql','quiz-pool-study.sql','quiz-math-response.sql'])await db.exec(await readFile('supabase/'+f,'utf8'));
 for(const d of fixture.definitions)await db.exec(d.definition);
 // Exact production prerequisite; the older shared local scaffold predates it.
 await db.exec("alter table public.quiz_sessions add column if not exists library_visible boolean not null default true;");
 await db.exec(classHelper);
 if(install)await db.exec(migration);return db;
}
const option=(id,text=id)=>({id,content:content(text)});
function question(){return {id:'fields',type:'fields',prompt:content('合成完整題組：依序填入分數、文字並選擇、勾選與排列。'),explanation:content('合成解析，答後才提供。'),fields:[
 {id:'fraction',label:'第1格',input:'math'}, {id:'word',label:'第2格',input:'text'},
 {id:'choice',label:'第3格',input:'single',options:[option('a'),option('b')]},
 {id:'set',label:'第4格',input:'set',options:[option('a'),option('b'),option('c')]},
 {id:'order',label:'第5格',input:'sequence',options:[option('a'),option('b'),option('c')]}
 ],answer:{format:'fields-v1',fields:{fraction:['1/2'],word:['甲'],choice:['b'],set:[['a','c']],order:[['b','a','c']]}}};}
const values=()=>({fraction:'２／４',word:'甲',choice:'b',set:['c','a'],order:['b','a','c']});
const response=f=>JSON.stringify({v:1,f});
async function seed(db,q=question(),reveal='immediate'){
 const document=newDocument();document.catalog.volume='6年級上學期';document.catalog.subject='數學';document.blocks[0].questions=[q];validateDocument(document);
 await db.query('select public.quiz_validate($1)',[document]);const bank=randomUUID(),version=randomUUID(),session=randomUUID();
 await db.query('insert into public.quiz_banks(id,owner_id,draft)values($1,$2,$3)',[bank,TEACHER,document]);
 await db.query('insert into public.quiz_versions(id,bank_id,revision,document)values($1,$2,1,$3)',[version,bank,document]);
 await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options)values($1,$2,$3,115,'[\"603\"]',$4,false,true)",[session,TEACHER,version,reveal]);
 return {document,bank,version,session,q};
}
async function join(db,p,uid=studentId(1)){
 const s=await quizCall(db,uid,'join',{session_id:p.session});
 await quizCall(db,uid,'view_question',{session_id:p.session,question_id:p.q.id});
 await db.query("update public.quiz_question_timing set first_seen=clock_timestamp()-interval '1 hour' where attempt_id=$1",[s.attempt_id]);return s;
}
const submit=(db,p,raw,uid=studentId(1),request=randomUUID())=>quizCall(db,uid,'submit',{session_id:p.session,question_id:p.q.id,response:raw,request_id:request,compact:true});

test('完整父題一次送答，五種欄位、重送、公開投影與舊簡答行為保持',async()=>{
 const db=await database(false);try{
  const old=await seed(db,{id:'old',type:'short',prompt:content('合成舊簡答'),explanation:content('舊解析'),answer:{accepted:['1/2']}});
  const first=await join(db,old);assert.equal((await submit(db,old,'2/4')).reviews[0].correct,false);
  const before=(await db.query('select md5(document::text)h from public.quiz_versions where id=$1',[old.version])).rows[0].h;
  await db.exec(migration);await join(db,old,studentId(2));assert.equal((await submit(db,old,'2/4',studentId(2))).reviews[0].correct,false);
  const opted=await seed(db,{id:'opted',type:'short',prompt:content('合成既有數學選用題'),explanation:content('數學解析'),answer:{accepted:['1/2'],normalizer:'math-v1'}});await join(db,opted);assert.equal((await submit(db,opted,'2/4')).reviews[0].correct,true);
  const p=await seed(db),s=await join(db,p);assert.equal(s.document.questions[0].fields.length,5);
  assert.doesNotMatch(JSON.stringify(s),/accepted|fields-v1|合成解析|option_id|tuples/);
  const raw=response(values()),id=randomUUID();assert.equal(fieldsResponseError(p.q,raw),'');
  const done=await submit(db,p,raw,studentId(1),id);assert.equal(done.reviews[0].correct,true);
  assert.deepEqual((await db.query('select response,correct from public.quiz_answers where attempt_id=$1',[s.attempt_id])).rows,[{response:raw,correct:true}]);
  assert.equal((await submit(db,p,raw,studentId(1),id)).reviews[0].correct,true);
  await assert.rejects(submit(db,p,response({...values(),fraction:'2/3'}),studentId(1),id),/submission_conflict/);
  await assert.rejects(submit(db,p,raw,studentId(1),randomUUID()),/submission_conflict/);
  await db.exec(migration);assert.equal((await db.query('select md5(document::text)h from public.quiz_versions where id=$1',[old.version])).rows[0].h,before);
  assert.deepEqual((await db.query('select response,correct from public.quiz_answers where attempt_id=$1',[first.attempt_id])).rows,[{response:'2/4',correct:false}]);
  assert.match(fieldsResponseSummary(p.q,raw),/第1格：２／４/);assert.doesNotMatch(fieldsResponseSummary(p.q,raw),/"v"|"f"/);assert.match(fieldsAnswerSummary(p.q,p.q.answer),/第1格：1\/2/);
 }finally{await db.close()}
});

test('缺欄、多欄、重複JSON鍵、零分母、錯誤型別及超長皆拒絕且不留答案',async()=>{
 const db=await database();try{
  const p=await seed(db),s=await join(db,p),base=values(),invalid=[response({...base,fraction:'1/0'}),response({...base,fraction:'1 1/2'}),response({...base,fraction:'1　1/2'}),response({...base,fraction:1}),response({...base,word:null}),response({...base,word:'x'.repeat(251)}),response({...base,extra:'x'}),response({...base,choice:'z'}),response({...base,set:['a','a']}),response({...base,order:['a','b']}),response({...base,order:['a','a','c']}),'[]','null','{"v":1,"f":[]}','{"v":1,"v":1,"f":{}}',response(base).replace('"fraction":','"fraction":"1/2","fraction":'),JSON.stringify({v:1,f:base,working:'secret'}),'x'.repeat(2001)];
  const missing={...base};delete missing.word;invalid.push(response(missing),response({...base,word:'\u0000'}));
  for(const raw of invalid)await assert.rejects(submit(db,p,raw),/invalid_response/);
  assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[s.attempt_id])).rows[0].n,0);
  assert.equal((await submit(db,p,response({...base,fraction:'0.5'}))).reviews[0].correct,true);
 }finally{await db.close()}
});

test('有序配對不能由獨立可接受值拼湊；任一格答錯整題不判對',async()=>{
 const db=await database();try{
  const q=question();q.fields=[{id:'from',label:'起站',input:'text'},{id:'to',label:'終站',input:'text'}];q.answer={format:'fields-v1',fields:{from:['甲','乙'],to:['甲','乙']},tuples:[{fields:['from','to'],accepted:[{from:'甲',to:'乙'},{from:'乙',to:'甲'}]}]};
  for(const [v,correct]of [[{from:'甲',to:'乙'},true],[{from:'乙',to:'甲'},true],[{from:'甲',to:'甲'},false],[{from:'乙',to:'乙'},false]]){const p=await seed(db,q);await join(db,p);assert.equal((await submit(db,p,response(v))).reviews[0].correct,correct)}
  const p=await seed(db);await join(db,p);assert.equal((await submit(db,p,response({...values(),fraction:'2/3'}))).reviews[0].correct,false);
  const saved=await quizCall(db,studentId(1),'resume',{session_id:p.session});
  const wrong=await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');return(await tx.query('select public.quiz_wrong_questions($1)r',[{action:'detail',grade:6,attempt_id:saved.attempt_id,question_id:p.q.id}])).rows[0].r});
  assert.equal(wrong.question.fields.length,5);assert.equal(wrong.review.correct,false);
 }finally{await db.close()}
});

test('巢狀欄位／答案白名單、投影與本人授權，不能以教師資料替代答案',async()=>{
 const db=await database();try{
  for(const mutate of [q=>q.fields[0].source_part_locator='正解位置',q=>q.answer.teacher_notes='秘密',q=>q.answer.fields.extra=['1'],q=>q.fields[0].id='__proto__',q=>q.fields[1].id=q.fields[0].id,q=>q.answer.fields.fraction=['1/0'],q=>q.answer.tuples=[{fields:['fraction','missing'],accepted:[{}]}]]){
   const q=question();mutate(q);const d=newDocument();d.blocks[0].questions=[q];await assert.rejects(db.query('select public.quiz_validate($1)',[d]));
  }
  const p=await seed(db),s=await join(db,p);await join(db,p,studentId(2));
  for(const role of ['anon','authenticated'])await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role '+role);await tx.query('select public.quiz_fields_grade($1,$2)',[p.q,response(values())])}),/permission denied/);
  await assert.rejects(quizCall(db,null,'join',{session_id:p.session},'anon'),/login_required|permission denied/);
  await assert.rejects(quizCall(db,TEACHER,'join',{session_id:p.session}),/student_required|class_not_allowed/);
  assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[s.attempt_id])).rows[0].n,0);
  const dirty=structuredClone(p.document);dirty.blocks[0].questions[0].fields[0].secret='no_leak';dirty.blocks[0].questions[0].fields[2].options[0].secret='option_secret';
  const projected=(await db.query("select public.quiz_student_document($1,'[\"fields\"]','{}')r",[dirty])).rows[0].r;assert.doesNotMatch(JSON.stringify(projected),/no_leak|option_secret|accepted/);
 }finally{await db.close()}
});

test('保護式安裝遇歷史新型別或函式變動即原子拒絕，SQL與凍結前像一致',async()=>{
 assert.equal(await readFile('supabase/quiz-normal-fields-response.sql','utf8'),migration);
 for(const mode of ['historical','function']){
  const db=await database(false);try{
   if(mode==='historical'){const d=newDocument();d.blocks[0].questions=[question()];await db.query('insert into public.quiz_banks(id,owner_id,draft)values($1,$2,$3)',[randomUUID(),TEACHER,d])}
   else await db.exec("create or replace function public.quiz_validate(d jsonb) returns void language plpgsql immutable as $$begin return;end$$;");
   const before=(await db.query("select md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))h")).rows[0].h;
   await assert.rejects(db.exec(migration),mode==='historical'?/fields_historical_type_present/:/fields_baseline_changed/);
   await db.exec('rollback');assert.equal((await db.query("select md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))h")).rows[0].h,before);
   assert.equal((await db.query("select to_regprocedure('public.quiz_fields_grade(jsonb,text)') is null absent")).rows[0].absent,true);
  }finally{await db.close()}
 }
});

test('自組卷原子抽完整父題，答前課本多頁與答後解析沿既有授權及固定來源',async()=>{
 const db=await database();try{
  const book=randomUUID(),course='synthetic-fields-g6';
  await db.query("insert into public.quiz_courses values($1,6,$2,true)",[course,{subject:'數學',publisher:'合成',volume:'6年級上學期',units:{6:'完整題組'}}]);
  await db.query("insert into public.quiz_textbooks values($1,6,115,1,'合成課本',$2,false)",[book,'a'.repeat(64)]);
  for(const[n,h]of[[75,'b'],[79,'c']])await db.query("insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes)values($1,$2,$3,'same-unit',$4,100)",[book,'p'+n,n===79?[79,80]:[75],h.repeat(64)]);
  await db.query('update public.quiz_textbooks set enabled=true where id=$1',[book]);
  for(let i=0;i<5;i++){
   const q=question();q.id='parent'+i;q.prompt.text+='第'+i+'組';
   await db.query("insert into public.quiz_question_pool values($1,$1,$1,'[6]','unmapped','待配題',0,'fields-test',false,$2,'{}',true)",[q.id,q]);
   await db.query('insert into public.quiz_pool_membership values($1,$2,false)',[q.id,course]);
   await db.query("insert into public.quiz_pool_study_sources values($1,$2,$3,$4,75,'{75,79,80}','合成學生版解析','{\"teacher_secret\":true}','{\"synthetic\":true}',true)",[q.id,course,q,book]);
  }
  const as=(uid,sql,args=[])=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');return(await tx.query(sql,args)).rows[0].r});
  const made=await as(studentId(1),'select public.quiz_compose($1)r',[{kind:'self',course_id:course,count:5,units:[6],difficulty:'medium',request_id:randomUUID()}]);
  const s=await quizCall(db,studentId(1),'join',{session_id:made.session_id});
  assert.equal(s.document.questions.length,5);assert(s.document.questions.every(q=>q.type==='fields'&&q.fields.length===5));assert.equal(Object.keys(s.study.references).length,5);assert.equal(s.study.pages.length,2);assert.deepEqual(s.study.explanations,{});assert.doesNotMatch(JSON.stringify(s),/teacher_secret|accepted|合成學生版解析/);
  await assert.rejects(quizCall(db,studentId(2),'join',{session_id:made.session_id}),/session_unavailable|roster_required/);
  const grant=['normal',s.attempt_id,s.version_id,s.study.pages[0].url];assert.equal((await as(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4)r',grant)).backend,'drive');await assert.rejects(as(studentId(2),'select public.quiz_textbook_media_access($1,$2,$3,$4)r',grant),/attempt_unavailable/);
  for(const q of s.document.questions){await quizCall(db,studentId(1),'view_question',{session_id:made.session_id,question_id:q.id});await db.query("update public.quiz_question_timing set first_seen=clock_timestamp()-interval '1 hour'where attempt_id=$1",[s.attempt_id]);const done=await quizCall(db,studentId(1),'submit',{session_id:made.session_id,question_id:q.id,response:response(values()),request_id:randomUUID(),compact:true});assert.equal(done.study.explanations[q.id].text,'合成學生版解析')}
  assert.deepEqual((await db.query('select count(*)::int n,bool_and(correct)all_correct from public.quiz_answers where attempt_id=$1',[s.attempt_id])).rows,[{n:5,all_correct:true}]);
 }finally{await db.close()}
});
