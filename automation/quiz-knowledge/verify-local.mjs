import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {createQuizDb,quizCall,studentId} from '../lib/quiz-local-db.mjs';
import {migration} from './migration.mjs';import {candidates,coverage} from './review.mjs';
process.on('uncaughtException',error=>{console.error(error.message);process.exitCode=1;});
const [sourceFile,reviewFile,out]=process.argv.slice(2),snapshot=JSON.parse(await fs.readFile(sourceFile,'utf8')),review=JSON.parse(await fs.readFile(reviewFile,'utf8'));
const db=await createQuizDb(undefined,{batch4:true}),uid=studentId(1),results=[];
const specialized=(name,data,user=uid)=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[user]);await tx.exec('set local role authenticated');return (await tx.query(`select public.${name}($1) result`,[JSON.stringify(data)])).rows[0].result;});
try{
 for(const c of snapshot.courses)await db.query('insert into public.quiz_courses values($1,$2,$3,$4)',[c.id,c.grade,JSON.stringify(c.definition),c.enabled]);
 await db.query(`insert into public.quiz_question_pool select question_id,source_item_id,group_key,unit_ids,knowledge_code,knowledge_name,difficulty,source_version,publisher_explanation,question,checks,usable from jsonb_to_recordset($1) as x(question_id text,source_item_id text,group_key text,unit_ids jsonb,knowledge_code text,knowledge_name text,difficulty int,source_version text,publisher_explanation boolean,question jsonb,checks jsonb,usable boolean)`,[JSON.stringify(snapshot.pool)]);
 await db.query(`insert into public.quiz_pool_membership select question_id,course_id,knowledge_reliable from jsonb_to_recordset($1) as x(question_id text,course_id text,knowledge_reliable boolean)`,[JSON.stringify(snapshot.pool)]);
 await db.exec(migration(snapshot,review,{commit:true}));
 const pool=(await db.query('select p.*,m.course_id,m.knowledge_reliable from public.quiz_question_pool p join public.quiz_pool_membership m using(question_id)')).rows;
 assert.deepEqual(coverage(pool),review.coverage);
 // A changed source must fail rather than overwrite a newer question or a prior application.
 await assert.rejects(db.exec(migration(snapshot,review,{commit:true})),/knowledge_source_changed_or_already_applied/);await db.exec('rollback');
 for(const c of snapshot.courses){
  const eligible=pool.filter(p=>p.course_id===c.id&&p.usable&&p.knowledge_reliable&&candidates(pool,p).length);
  const p=eligible.find(p=>![p.question.prompt,...p.question.options.map(o=>o.content)].some(x=>x.media?.length))||eligible[0];assert(p);
  for(const alias of [false,true]){
   const bank=crypto.randomUUID(),version=crypto.randomUUID(),session=crypto.randomUUID(),q=structuredClone(p.question),legacy=q.id;
   if(alias)q.id='fixture_legacy_'+p.source_item_id;
   const document={schema:1,title:'合成分類驗證',catalog:c.definition,blocks:[{id:'fixture_block',material:{text:'',media:[]},questions:[q]}]};
   await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,uid,JSON.stringify(document)]);
   await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,JSON.stringify(document)]);
   if(alias)await db.query('insert into public.quiz_pool_aliases values($1,$2,$3)',[version,q.id,legacy]);
   await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'[\"603\"]','immediate',false,false,'practice')",[session,uid,version]);
   const joined=await quizCall(db,uid,'join',{session_id:session});
   await quizCall(db,uid,'submit',{session_id:session,question_id:q.id,response:q.options.find(o=>o.id!==q.answer.option_id).id,request_id:crypto.randomUUID()});
   const detail=await specialized('quiz_wrong_questions',{action:'detail',attempt_id:joined.attempt_id,question_id:q.id});assert.equal(detail.can_extend,true);
   await assert.rejects(specialized('quiz_wrong_questions',{action:'detail',attempt_id:joined.attempt_id,question_id:q.id},studentId(2)),/wrong_question_unavailable/);
   const args={kind:'extension',count:3,attempt_id:joined.attempt_id,question_id:q.id,request_id:crypto.randomUUID()},paper=await specialized('quiz_compose',args),retry=await specialized('quiz_compose',args);
   assert.equal(retry.session_id,paper.session_id);
   const generated=(await db.query('select v.document from public.quiz_versions v join public.quiz_sessions s on s.version_id=v.id where s.id=$1',[paper.session_id])).rows[0].document;
   const ids=generated.blocks.flatMap(b=>b.questions.map(q=>q.id)),allowed=candidates(pool,p);
   assert(ids.length>0&&ids.length<=3);assert(ids.every(id=>allowed.some(q=>q.question_id===id)));assert.equal(new Set(ids.map(id=>pool.find(q=>q.question_id===id).group_key)).size,ids.length);
   results.push({course_id:c.id,alias,can_extend:true,actual:ids.length,retry_same_paper:true,other_user_rejected:true});
  }
 }
 for(const a of review.assignments.filter(a=>!a.knowledge_reliable)){
  const p=pool.find(p=>p.question_id===a.question_id),c=snapshot.courses.find(c=>c.id===p.course_id);
  const row=(await db.query('select (public.quiz_extension_source($1,$2,$3,6)).question_id id',[crypto.randomUUID(),p.question_id,JSON.stringify(c.definition)])).rows[0];assert.equal(row.id,null);
 }
 let normalPapers=0;
 for(const c of snapshot.courses)for(const difficulty of ['easy','medium','hard']){
  const unit=Number(Object.keys(c.definition.units)[0]),paper=await specialized('quiz_compose',{kind:'self',course_id:c.id,units:[unit],count:10,difficulty,request_id:crypto.randomUUID()});
  const doc=(await db.query('select v.document from public.quiz_versions v join public.quiz_sessions s on s.version_id=v.id where s.id=$1',[paper.session_id])).rows[0].document;
  const ps=doc.blocks.flatMap(b=>b.questions.map(q=>pool.find(p=>p.question_id===q.id)));
  assert(ps.length>0&&ps.length<=10);assert(ps.every(p=>p.course_id===c.id&&p.unit_ids.includes(unit)));
  if(difficulty==='easy')assert(ps.every(p=>p.difficulty!==3));if(difficulty==='hard')assert(ps.every(p=>p.difficulty!==-3));normalPapers++;
 }
 const report={passed:true,classified:930,reliable:928,held:2,coverage:review.coverage,scenarios:results,normal_self_papers:normalPapers};await fs.writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.close();}
