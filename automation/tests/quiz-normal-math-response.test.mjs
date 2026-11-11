import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQuizDb,PGlite,TEACHER,studentId,quizCall} from '../lib/quiz-local-db.mjs';
import {newDocument,content} from '../../shared/quiz-document.mjs';
import {buildNormalMathMigration} from '../lib/quiz-normal-math-migration.mjs';

async function fixture(){
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});
 db.exec=PGlite.prototype.exec.bind(db);
 for(const file of ['quiz-past-exams.sql','quiz-learning.sql','quiz-study.sql','quiz-pool-study.sql','quiz-math-response.sql']){
  await db.exec(await readFile('supabase/'+file,'utf8'));
 }
 return db;
}
const definitions=async db=>(await db.query("select proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in('quiz_validate','quiz_action_before_learning','quiz_math_answer_normalize')")).rows;
async function seed(db,answer){
 const document=newDocument();document.catalog.volume='6年級上學期';
 document.blocks[0].questions=[{id:'math',type:'short',prompt:content('合成單一答案格，請填最後答案。'),explanation:content('合成解析，答後才提供。'),answer}];
 await db.query('select public.quiz_validate($1)',[document]);
 const bank=randomUUID(),version=randomUUID(),session=randomUUID();
 await db.query('insert into public.quiz_banks(id,owner_id,draft)values($1,$2,$3)',[bank,TEACHER,document]);
 await db.query('insert into public.quiz_versions(id,bank_id,revision,document)values($1,$2,1,$3)',[version,bank,document]);
 await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options)values($1,$2,$3,115,'[\"603\"]','immediate',false,true)",[session,TEACHER,version]);
 return {bank,version,session,document};
}
async function ready(db,session,user=studentId(1)){
 const snapshot=await quizCall(db,user,'join',{session_id:session});
 assert.doesNotMatch(JSON.stringify(snapshot),/normalizer|accepted|合成解析/);
 await quizCall(db,user,'view_question',{session_id:session,question_id:'math'});
 await db.query("update public.quiz_question_timing set first_seen=clock_timestamp()-interval '1 hour' where attempt_id=$1 and question_id='math'",[snapshot.attempt_id]);
 return snapshot;
}
const submit=(db,session,response,user=studentId(1),request=randomUUID())=>quizCall(db,user,'submit',{session_id:session,question_id:'math',response,request_id:request,compact:true});

test('新數學簡答核對等值分數與全形，舊簡答、固定版本及已存答案維持原規則',async()=>{
 const db=await fixture();try{
  const legacy=await seed(db,{accepted:['1/2']});
  const before=await ready(db,legacy.session);
  assert.equal((await submit(db,legacy.session,'2/4')).reviews[0].correct,false);
  const digest=(await db.query("select md5(document::text) h from public.quiz_versions where id=$1",[legacy.version])).rows[0].h;
  const migration=buildNormalMathMigration(await definitions(db));await db.exec(migration);
  await ready(db,legacy.session,studentId(2));
  assert.equal((await submit(db,legacy.session,'2/4',studentId(2))).reviews[0].correct,false);
  for(const [accepted,response,correct]of [['1/2','２／４',true],['1/2','1 / 2',true],['1/2','0.5',true],['1/2','2/3',false],['6','００６',true],['>','＞',true],['4','2+2',false]]){
   const {session}=await seed(db,{accepted:[accepted],normalizer:'math-v1'});
   const started=await ready(db,session),request=randomUUID();
   const result=await submit(db,session,response,studentId(1),request);
   assert.equal(result.reviews[0].correct,correct);
   const saved=(await db.query('select response,correct from public.quiz_answers where attempt_id=$1',[started.attempt_id])).rows[0];
   assert.deepEqual(saved,{response,correct});
   assert.equal((await submit(db,session,response,studentId(1),request)).reviews[0].correct,correct);
   await assert.rejects(submit(db,session,response,studentId(1),randomUUID()),/submission_conflict/);
  }
  // Exact after hashes make reinstallation safe even after opted-in versions exist.
  await db.exec(migration);
  assert.equal((await db.query('select md5(document::text) h from public.quiz_versions where id=$1',[legacy.version])).rows[0].h,digest);
  assert.deepEqual((await db.query('select response,correct from public.quiz_answers where attempt_id=$1',[before.attempt_id])).rows,[{response:'2/4',correct:false}]);
 }finally{await db.close()}
});

test('數學格式嚴格選用；無效分母、指令字串與非字串不能留下答案',async()=>{
 const db=await fixture();try{
  await db.exec(buildNormalMathMigration(await definitions(db)));
  for(const normalizer of [null,false,'unknown'])await assert.rejects(seed(db,{accepted:['1/2'],normalizer}),/invalid_answer/);
  for(const mixed of ['1 1/4','1　1/4','１ １／４'])await assert.rejects(seed(db,{accepted:[mixed],normalizer:'math-v1'}),/invalid_answer/);
  await assert.rejects(seed(db,{accepted:['1/0'],normalizer:'math-v1'}),/invalid_response/);
  const {session}=await seed(db,{accepted:['1/2'],normalizer:'math-v1'}),started=await ready(db,session);
  for(const response of ['1/0','1;drop table quiz_answers','x'.repeat(251),{},'','1 1/4','1　1/4','１ １／４','1\t1/4']){
   await assert.rejects(submit(db,session,response),/invalid_response/);
   assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1',[started.attempt_id])).rows[0].n,0);
  }
  assert.equal((await submit(db,session,'2/4')).reviews[0].correct,true);
  await assert.rejects(quizCall(db,null,'join',{session_id:session},'anon'),/permission denied|login_required/);
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select public.quiz_math_answer_normalize('1/2')");}),/permission denied/);
 }finally{await db.close()}
});

test('待部署SQL由主線快照定義產生，與已測的遷移生成器完全一致',async()=>{
 // Function bodies intentionally preserve mixed line endings from pg_get_functiondef.
 const snapshot=await readFile('supabase/production-snapshot/functions.sql','utf8');
 const defs=['quiz_validate','quiz_action_before_learning','quiz_math_answer_normalize'].map(proname=>{
  const start=snapshot.indexOf('CREATE OR REPLACE FUNCTION public.'+proname+'(');
  assert(start>=0);
  const end=snapshot.indexOf('\nrevoke all on function public.'+proname+'(',start);
  assert(end>start);
  return {proname,definition:snapshot.slice(start,end).trimEnd().replace(/;$/,'')+'\n'};
 });
 const deployed=await readFile('supabase/quiz-normal-math-response.sql','utf8');
 assert.equal(deployed,buildNormalMathMigration(defs));
});

test('舊文件已帶新標記或函式基準不同時，整個升級拒絕且不改判分',async()=>{
 for(const place of ['version','pool','function','normalizer']){
  const db=await fixture();try{
   const defs=await definitions(db),migration=buildNormalMathMigration(defs);
   if(place==='version')await seed(db,{accepted:['1/2'],normalizer:'math-v1'});
   if(place==='pool'){
    const q={id:'legacy-marker',type:'short',prompt:content('合成題'),explanation:content('合成解析'),answer:{accepted:['1/2'],normalizer:'math-v1'}};
    await db.query("insert into public.quiz_question_pool values('legacy-marker','legacy-marker','legacy-marker','[1]','unmapped','合成',0,'old',false,$1,'{}',false)",[q]);
   }
   if(place==='function')await db.exec(defs.find(d=>d.proname==='quiz_validate').definition.replace('declare b jsonb;','-- different reviewed baseline\ndeclare b jsonb;'));
   if(place==='normalizer')await db.exec(defs.find(d=>d.proname==='quiz_math_answer_normalize').definition.replace('declare s text;','-- different math dependency\ndeclare s text;'));
   const before=await definitions(db);
   await assert.rejects(db.exec(migration),place==='function'?/normal_math_baseline_changed/:place==='normalizer'?/normal_math_normalizer_changed/:/normal_math_historical_marker_present/);
   await db.exec('rollback');
   assert.deepEqual(await definitions(db),before);
  }finally{await db.close()}
 }
});
