import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createOpenSelfReviewDb} from '../lib/quiz-open-self-review-fixture.mjs';
import {TEACHER,studentId,quizCall} from '../lib/quiz-local-db.mjs';
import {newDocument,content,validateDocument} from '../../shared/quiz-document.mjs';
import {openResponseError} from '../../shared/quiz-open-response.mjs';
import {fieldsResponseSummary} from '../../shared/quiz-fields.mjs';
import {buildOpenSketchMigration} from '../lib/quiz-open-sketch-migration.mjs';

const sketch={version:1,strokes:[[[.1,.1],[.7,.7]],[[.2,.8],[.8,.2]]],colors:['#2459b3','#b83246']};
const large={version:1,strokes:Array.from({length:20},(_,i)=>Array.from({length:50},(_,j)=>[i/20,j/50]))};
const raw=(value=sketch)=>JSON.stringify({v:1,f:{work:value,conclusion:'5'}});
const q=()=>({id:'handwritten',type:'open',prompt:content('合成題：請寫出直式與答案。'),explanation:content('核對各位數與計算步驟，不自動判筆跡。'),fields:[{id:'work',label:'直式與計算過程',input:'sketch'},{id:'conclusion',label:'最後答案',input:'text'}],answer:{format:'self-review-v1',fields:{work:{examples:['合成參考：先對齊個位，再核對各步驟。'],criteria:['保留直式步驟','數位對齊']},conclusion:{examples:['5'],criteria:['答案與計算過程一致']}}}});
async function seed(db,question=q()){
 const document=newDocument();document.blocks[0].questions=[question];validateDocument(document);await db.query('select public.quiz_validate($1)',[document]);
 const bank=randomUUID(),version=randomUUID(),session=randomUUID();
 await db.query('insert into public.quiz_banks(id,owner_id,draft)values($1,$2,$3)',[bank,TEACHER,document]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document)values($1,$2,1,$3)',[version,bank,document]);
 await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)values($1,$2,$3,115,'[\"603\"]','immediate',false,false,'practice')",[session,TEACHER,version]);
 return {session,document};
}
const call=(db,p,action,data={},uid=studentId(1))=>quizCall(db,uid,action,{session_id:p.session,...data});
const send=(db,p,response=raw(),request=randomUUID(),uid=studentId(1))=>call(db,p,'submit',{question_id:'handwritten',response,request_id:request,compact:true},uid);
async function install(db){
 const definitions=[];for(const [proname,args]of[['quiz_open_validate','jsonb'],['quiz_open_submit','uuid,jsonb,jsonb,boolean']])definitions.push({proname,definition:(await db.query('select pg_get_functiondef($1::regprocedure) d',[`public.${proname}(${args})`])).rows[0].d});
 const helpers=await readFile('supabase/quiz-open-sketch-helpers.sql','utf8'),sql=buildOpenSketchMigration(definitions,helpers);
 assert.equal(buildOpenSketchMigration(definitions.map(d=>({...d,definition:d.definition.replaceAll('\n','\r\n')})),helpers.replaceAll('\r\n','\n').replaceAll('\n','\r\n')),sql,'LF and Windows CRLF must reproduce the same approved migration');
 assert.equal(sql,(await readFile('supabase/quiz-open-sketch.sql','utf8')).replaceAll('\r\n','\n'),'test the exact generated production candidate');await db.exec(sql);return sql;
}

test('手寫原生保存、接回、自評、冪等、隔離與舊作答保持（僅本機合成資料）',async t=>{
 const db=await createOpenSelfReviewDb();try{
  const text=q();text.fields[0].input='text';const legacy=await seed(db,text);await call(db,legacy,'join');const oldRaw=JSON.stringify({v:1,f:{work:'原文字過程',conclusion:'5'}});await send(db,legacy,oldRaw);
  const old=(await db.query('select md5(row_to_json(r)::text) hash from public.quiz_open_responses r')).rows;
  const sql=await install(db);
  await t.test('前後端接受 opt-in sketch，舊文字限制及原紀錄保持',async()=>{
   const p=await seed(db);assert.equal(openResponseError(q(),raw()),'');assert.equal(openResponseError(q(),raw(large)),'');assert.ok(raw(large).length>2000);
   assert.deepEqual((await db.query('select md5(row_to_json(r)::text) hash from public.quiz_open_responses r')).rows,old);
   assert.notEqual(openResponseError(text,raw()),'');await assert.rejects(db.query('select public.quiz_open_response($1,$2)',[text,raw()]),/invalid_response/);
   const invalid=q();invalid.type='fields';assert.throws(()=>validateDocument({...p.document,blocks:[{...p.document.blocks[0],questions:[invalid]}]}));await assert.rejects(db.query('select public.quiz_validate($1)',[{...p.document,blocks:[{...p.document.blocks[0],questions:[invalid]}]}]));
  });
  await t.test('一次送答保存原筆跡與顏色，重試不重複，未自評不冒充正確',async()=>{
   const p=await seed(db),joined=await call(db,p,'join');assert.equal(joined.document.questions[0].fields[0].input,'sketch');assert.ok(!JSON.stringify(joined).includes('合成參考'));
   const request=randomUUID(),saved=await send(db,p,raw(large),request);assert.equal(saved.complete,false);assert.equal(saved.reviews[0].correct,null);assert.equal(saved.responses.handwritten,raw(large));
   await send(db,p,raw(large),request);await assert.rejects(send(db,p,raw(),request),/submission_conflict/);
   const resumed=await call(db,p,'resume');assert.equal(resumed.responses.handwritten,raw(large));assert.equal(resumed.open_responses.handwritten.status,'saved');
   assert.equal((await db.query('select count(*)::int n from public.quiz_open_responses where attempt_id=$1',[joined.attempt_id])).rows[0].n,1);
   assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[joined.attempt_id])).rows[0].n,0);
   const rating=randomUUID();const complete=await call(db,p,'self_check',{question_id:'handwritten',request_id:rating,self_rating:'practice',self_note:'再練習數位對齊',compact:true});assert.equal(complete.complete,true);assert.equal(complete.reviews[0].correct,null);
   await call(db,p,'self_check',{question_id:'handwritten',request_id:rating,self_rating:'practice',self_note:'再練習數位對齊'});
   assert.equal((await call(db,p,'resume')).responses.handwritten,raw(large));assert.ok(!fieldsResponseSummary(q(),raw()).includes('[object Object]'));
   const colorPaper=await seed(db);await call(db,colorPaper,'join');await send(db,colorPaper);assert.deepEqual(JSON.parse((await call(db,colorPaper,'resume')).responses.handwritten).f.work,sketch);
  });
  await t.test('空白、超界、偽造顏色、重複鍵、過量筆跡與未知欄位不可保存',async()=>{
   const p=await seed(db);await call(db,p,'join');
   const bad=[{version:1,strokes:[]},{...sketch,extra:1},{...sketch,version:2},{...sketch,colors:['red','blue']},{...sketch,strokes:[[[2,0]]]},{...sketch,strokes:[[[0,'0']]]},{...sketch,strokes:Array(81).fill([[0,0]])},{...sketch,strokes:[Array(129).fill([0,0])]}];
   for(const value of bad){assert.notEqual(openResponseError(q(),raw(value)),'');await assert.rejects(send(db,p,raw(value)),/invalid_response/);}
   for(const response of ['{"v":1,"f":{"work":{"version":1,"version":1,"strokes":[[[0,0]]]},"conclusion":"5"}}','{"v":1,"f":{"work":{},"work":{},"conclusion":"5"}}',JSON.stringify({v:1,f:{work:sketch}}),raw().replace('"v":1','"v":1,"x":2'),raw().replace('"5"','"'+ 'x'.repeat(300001)+'"')])await assert.rejects(send(db,p,response),/invalid_response/);
   assert.equal((await db.query('select count(*)::int n from public.quiz_open_responses where attempt_id=(select id from public.quiz_attempts where session_id=$1)',[p.session])).rows[0].n,0);
  });
  await t.test('本人接回、跨使用者與匿名拒絕，不能直接寫表或呼叫私有 helper',async()=>{
   const p=await seed(db);await call(db,p,'join');await send(db,p);const own=await call(db,p,'resume');
   const other=await call(db,p,'join',{},studentId(2));assert.ok(!other.responses.handwritten);assert.ok(!JSON.stringify(other).includes('合成參考'));assert.notEqual(other.attempt_id,own.attempt_id);
   await assert.rejects(call(db,p,'resume',{},null),/login_required/);
   await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select public.quiz_open_submit($1,$2,$3,false)',[own.attempt_id,q(),{response:raw(),request_id:randomUUID()}]);}),/permission denied/);
   await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.quiz_open_responses');}),/permission denied/);
  });
  await t.test('重複遷移拒絕，沒有覆寫舊答案與自評',async()=>{
   const before=(await db.query('select md5(row_to_json(r)::text) hash from public.quiz_open_responses r order by attempt_id')).rows;
   await assert.rejects(db.exec(sql),/sketch_baseline_changed|sketch_response_constraint_changed|sketch_already_installed/);await db.exec('rollback');
   assert.deepEqual((await db.query('select md5(row_to_json(r)::text) hash from public.quiz_open_responses r order by attempt_id')).rows,before);
  });
 }finally{await db.close();}
});
