import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';
import {buildSavedWorkMigration} from '../lib/quiz-saved-work-migration.mjs';
import {newDocument,content,validateDocument} from '../../shared/quiz-document.mjs';
import {fieldsResponseError} from '../../shared/quiz-fields.mjs';

export const sampleWorkQuestion=input=>({id:'synthetic',type:'fields',prompt:content('合成題：填寫計算過程與最後答案。'),explanation:content('合成參考解法，揭答前不可提供。'),work:{input,label:input==='expression'?'算式':'直式作答'},fields:[{id:'q',label:'商',input:'math'},{id:'r',label:'餘數',input:'math'}],answer:{format:'fields-v1',fields:{q:['3'],r:['1']}}});
const ink={version:1,strokes:[[[.1,.2],[.8,.3]]],colors:['#2459b3']};
const largeInk={version:1,strokes:Array.from({length:30},(_,i)=>Array.from({length:100},(_,j)=>[i/30,j/100]))};
const raw=(w='25÷8＝3餘1',f={q:'3',r:'1'})=>JSON.stringify({v:1,f,w});

test('算式／直式原生一次送答、固定答案判分、保存與隔離；舊答案原封保留',async t=>{
 const {db,uid,as}=await setupProductionQuizDB({snapshot:true});
 try{
  for(let n=1;n<=3;n++){await db.query('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[uid(n),n===1?'teacher@example.invalid':`s${n}@example.invalid`]);if(n>1)await db.query("insert into public.student_enrollments values(115,$1,'603',$2,$3)",[`s${n}@example.invalid`,n,'合成學生'+n]);}
  const seed=async(q,reveal='immediate')=>{
   const d=newDocument();d.blocks[0].questions=[q];validateDocument(d);await db.query('select public.quiz_validate($1)',[d]);
   const bank=randomUUID(),version=randomUUID(),session=randomUUID();await db.query('insert into public.quiz_banks(id,owner_id,draft)values($1,$2,$3)',[bank,uid(1),d]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document)values($1,$2,1,$3)',[version,bank,d]);
   await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)values($1,$2,$3,115,'["603"]',$4,false,false,'practice')`,[session,uid(1),version,reveal]);return {session,d};
  };
  const call=async(p,action,data={},user=2)=>{await as(user);try{return(await db.query('select public.quiz_action($1,$2) data',[action,{session_id:p.session,...data}])).rows[0].data;}finally{await db.exec('reset role');}};
  const send=(p,response,request=randomUUID(),user=2)=>call(p,'submit',{question_id:'synthetic',response,request_id:request,compact:true},user);
  const legacy=sampleWorkQuestion('expression');delete legacy.work;
  const old=await seed(legacy);await call(old,'join');await send(old,JSON.stringify({v:1,f:{q:'3',r:'1'}}));
  const oldRows=(await db.query('select md5(row_to_json(a)::text) hash from public.quiz_answers a')).rows;
  const fixture=JSON.parse(await fs.readFile('automation/fixtures/quiz-saved-work-before.json','utf8'));
  // The production snapshot already contains this migration. Restore its exact
  // pre-migration functions in this synthetic database before testing the guard,
  // upgrade and preservation of the legacy response seeded above.
  for(const definition of fixture.definitions)await db.exec(definition.definition.replaceAll('\r\n','\n'));
  const migration=buildSavedWorkMigration(fixture.definitions);assert.equal(migration,(await fs.readFile('supabase/quiz-saved-work.sql','utf8')).replaceAll('\r\n','\n'));
  assert.equal(buildSavedWorkMigration(fixture.definitions.map(d=>({...d,definition:d.definition.replaceAll('\n','\r\n')}))),migration);
  await db.exec(migration);
  await t.test('新契約只 opt-in；未作答不揭參考解法，舊資料指紋不變',async()=>{
   assert.deepEqual((await db.query('select md5(row_to_json(a)::text) hash from public.quiz_answers a')).rows,oldRows);
   for(const input of ['expression','sketch']){const q=sampleWorkQuestion(input),p=await seed(q),s=await call(p,'join');assert.deepEqual(s.document.questions[0].work,q.work);assert.ok(!JSON.stringify(s).includes('合成參考解法'));}
   const bad=sampleWorkQuestion('text');assert.throws(()=>validateDocument({...newDocument(),blocks:[{...newDocument().blocks[0],questions:[bad]}]}));await assert.rejects(db.query('select public.quiz_fields_validate($1)',[bad]),/invalid_question/);
   assert.notEqual(fieldsResponseError(legacy,raw()),'');await assert.rejects(db.query('select public.quiz_fields_response($1,$2)',[legacy,raw()]),/invalid_response/);
  });
  await t.test('算式按原文字保存、直式含顏色及大筆跡；一送即完成，不新增自評',async()=>{
   for(const [input,value]of[['expression','8×3＝24；25−24＝1'],['sketch',ink],['sketch',largeInk]]){
    const q=sampleWorkQuestion(input),p=await seed(q),s=await call(p,'join'),response=raw(value),request=randomUUID();assert.equal(fieldsResponseError(q,response),'');
    const saved=await send(p,response,request);assert.equal(saved.complete,true);assert.equal(saved.reviews[0].correct,true);assert.equal(saved.responses.synthetic,response);
    await send(p,response,request);await assert.rejects(send(p,raw(value,{q:'7',r:'4'}),request),/submission_conflict/);
    const resume=await call(p,'resume');assert.equal(resume.responses.synthetic,response);assert.equal(resume.complete,true);
    assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[s.attempt_id])).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from public.quiz_open_responses where attempt_id=$1',[s.attempt_id])).rows[0].n,0);
   }
  });
  await t.test('過程不冒充自動判分：只比較數值，錯誤答案不因算式正確而通過',async()=>{
   const q=sampleWorkQuestion('expression');for(const [f,expected]of[[{q:'3',r:'1'},true],[{q:'8',r:'3'},false]]){
    const p=await seed(q);await call(p,'join');assert.equal((await send(p,raw('學生自行列式',f))).reviews[0].correct,expected);
   }
  });
  await t.test('空白、重複鍵、跨規格、超長及偽造筆跡拒絕；失敗不留下半份答案',async()=>{
   for(const input of ['expression','sketch']){
    const q=sampleWorkQuestion(input),p=await seed(q);await call(p,'join');
    const bad=[raw(null),raw(''),raw('x'.repeat(251)),raw({...ink,extra:1}),raw({...ink,strokes:[[[2,0]]]}),raw({...ink,colors:['red']}),'{"v":1,"f":{"q":"3","r":"1"}}','{"v":1,"f":{"q":"3","r":"1"},"w":"1","w":"2"}'];
    for(const response of bad)await assert.rejects(send(p,response),/invalid_response/);
    assert.equal((await db.query('select count(*)::int n from public.quiz_answers a join public.quiz_attempts t on t.id=a.attempt_id where t.session_id=$1',[p.session])).rows[0].n,0);
   }
  });
  await t.test('跨使用者與匿名不可取得本人過程；私有 helper 不開放直接呼叫',async()=>{
   const p=await seed(sampleWorkQuestion('sketch'));await call(p,'join');await send(p,raw(ink));
   assert.ok(!(await call(p,'join',{},3)).responses.synthetic);await assert.rejects(call(p,'resume',{},null),/login_required/);
   await as(2);await assert.rejects(db.query('select public.quiz_fields_response($1,$2)',[sampleWorkQuestion('expression'),raw()]),/permission denied/);await db.exec('reset role');
  });
  await t.test('夥伴同一次送答、草稿、重試、完成前隔離及完成後最新過程回顧',async()=>{
   await db.exec("insert into partner_pilot.settings(id,enabled)values(true,true)");
   for(const n of [2,3])await db.query('insert into partner_pilot.allowed_users(user_id,display_name)values($1,$2)',[uid(n),'合成夥伴'+n]);
   const room=randomUUID(),paper='saved-work-synthetic';
   await db.query(`insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,is_real,origin,owner_id,self_session)values($1,'合成題組',6,'數學','leaf',10,$1,true,'self',$2,$3)`,[paper,uid(2),old.session]);
   await db.query(`insert into partner_pilot.rooms(id,code,team,theme,paper,capacity,host,started,allocation_version)values($1,'888882','合成小隊','forest',$2,2,$3,true,1)`,[room,paper,uid(2)]);
   for(const n of [2,3])await db.query('insert into partner_pilot.members(room_id,user_id,ready)values($1,$2,true)',[room,uid(n)]);
   for(let i=1;i<=10;i++){
    const q=sampleWorkQuestion(i===2?'sketch':'expression');q.id='synthetic'+i;
    await db.query(`insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation,normal_question)values($1,'合成原題','填寫過程與答案','[]',0,'合成參考解法',$2)`,[8800+i,q]);
    await db.query('insert into partner_pilot.paper_items values($1,$2,$3)',[paper,i,8800+i]);
    await db.query("insert into partner_pilot.allocations(room_id,qid,user_id,unit_id)values($1,$2,$3,'synthetic')",[room,8800+i,uid(i===2?3:2)]);
   }
   const partner=async(n,p)=>{await as(n);try{return(await db.query('select public.quiz_partner_pilot_action($1) data',[{roomId:room,requestId:randomUUID(),...p}])).rows[0].data;}finally{await db.exec('reset role');}};
   const response=raw('25÷8＝3餘1'),requestId=randomUUID();
   await partner(2,{action:'save_draft',draftRevision:0,state:{drafts:{'answer-8801':response},attempts:{},editing:[],open:[],view:'practice'}});
   assert.equal((await partner(2,{action:'snapshot'})).exercise.privateDraft.state.drafts['answer-8801'],response);
   await partner(2,{action:'answer',qid:8801,response,expectedAttempt:0,requestId});await partner(2,{action:'answer',qid:8801,response,expectedAttempt:0,requestId});
   assert.equal((await db.query('select count(*)::int n from partner_pilot.answers where room_id=$1 and qid=8801',[room])).rows[0].n,1);
   await partner(2,{action:'mark',qid:8801,tag:'method',text:''});
   const early=await partner(3,{action:'snapshot'});assert.equal(early.exercise.reviewOpen,false);assert.ok(!early.exercise.shared.find(q=>q.id===8801)?.attempts);assert.ok(!early.exercise.shared.find(q=>q.id===8801)?.normalReference);
   await partner(3,{action:'answer',qid:8802,response:raw(largeInk),expectedAttempt:0});
   await assert.rejects(partner(2,{action:'answer',qid:8802,response:raw(ink),expectedAttempt:1}),/OWN_QUESTION_ONLY/);
   for(let i=3;i<=10;i++)await partner(2,{action:'answer',qid:8800+i,response:raw(),expectedAttempt:0});
   const complete=await partner(3,{action:'snapshot'});assert.equal(complete.exercise.reviewOpen,true);
   assert.equal(complete.exercise.shared.find(q=>q.id===8801).attempts.at(-1).value,response);
   assert.deepEqual(JSON.parse(complete.exercise.shared.find(q=>q.id===8802).attempts.at(-1).value).w,largeInk);
   await partner(2,{action:'answer',qid:8801,response:raw('8×3＝24；25−24＝1'),expectedAttempt:1});
   assert.equal((await partner(3,{action:'snapshot'})).exercise.shared.find(q=>q.id===8801).attempts.length,1);
   assert.equal(JSON.parse((await partner(3,{action:'snapshot'})).exercise.shared.find(q=>q.id===8801).attempts[0].value).w,'8×3＝24；25−24＝1');
  });
  await t.test('遷移不可重跑，既有所有作答指紋及權限不變',async()=>{
   const before=(await db.query('select md5(row_to_json(a)::text) hash from public.quiz_answers a order by attempt_id,question_id')).rows;
   await assert.rejects(db.exec(migration),/saved_work_baseline_changed/);await db.exec('rollback');
   assert.deepEqual((await db.query('select md5(row_to_json(a)::text) hash from public.quiz_answers a order by attempt_id,question_id')).rows,before);
   await as(2);await assert.rejects(db.query('select * from public.quiz_answers'),/permission denied/);await db.exec('reset role');
  });
 }finally{await db.close();}
});
