import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createQuizDb,TEACHER,studentId} from '../lib/quiz-local-db.mjs';
import {validateLearningMap} from '../lib/past-learning-map.mjs';

// Synthetic local SQL projection tests. This does not stand in for native
// PostgreSQL rollback, the public RPC grade gate, OAuth or browser acceptance.
const snapshot=fs.readFileSync('supabase/production-snapshot/functions.sql','utf8').replace(/\r\n/g,'\n');
const definition=name=>{
 const start=snapshot.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
 assert(start>=0);const end=snapshot.indexOf('\nrevoke ',start);assert(end>start);
 return snapshot.slice(start,end);
};
const fix=fs.readFileSync('supabase/quiz-past-learning-grade-route-fix-20261128.sql','utf8');
const rollback=fs.readFileSync('supabase/quiz-past-learning-grade-route-rollback-20261128.sql','utf8');
const sourceMd5='588e36cb7015d20bb4a3797de71f916b',fixedMd5='074421da5937e369d97813f418900737';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('考古卷錯題返回：依本人原卷年級、保留原作答識別、拒絕變動函式並可回復',async()=>{
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});
 try{
  await db.exec(fs.readFileSync('supabase/quiz-past-exams.sql','utf8'));
  // Bring the legacy local scaffold's grade constraint to the actual snapshot.
  const table=JSON.parse(fs.readFileSync('supabase/production-snapshot/schema.json','utf8')).tables.find(t=>t.schema==='public'&&t.name==='quiz_past_papers');
  const gradeCheck=table.constraints.find(c=>c.name==='quiz_past_papers_grade_check');assert(gradeCheck);
  await db.exec(`alter table public.quiz_past_papers drop constraint quiz_past_papers_grade_check; alter table public.quiz_past_papers add constraint quiz_past_papers_grade_check ${gradeCheck.def};`);
  await db.exec(`create table public.quiz_learning_maps(source_version uuid primary key references public.quiz_past_versions(id),paper_id text not null references public.quiz_past_papers(id),source_sha text not null,content jsonb not null,enabled boolean not null default false);
   alter table public.quiz_learning_maps enable row level security;
   revoke all on public.quiz_learning_maps from public,anon,authenticated;
   grant all on public.quiz_learning_maps to service_role;`);
  for(const name of ['quiz_past_snapshot_before_flowers','quiz_past_snapshot_before_learning','quiz_past_snapshot_before_drafts'])await db.exec(definition(name));
  await db.exec('revoke all on function public.quiz_past_snapshot_before_drafts(uuid) from public,anon,authenticated,service_role; grant execute on function public.quiz_past_snapshot_before_drafts(uuid) to service_role;');
  const fingerprint=async()=> (await db.query("select md5(pg_get_functiondef('public.quiz_past_snapshot_before_drafts(uuid)'::regprocedure)) value")).rows[0].value;
  assert.equal(await fingerprint(),sourceMd5);
  const fixtures=[];
  for(const grade of [3,4,6,9]){
   const paper=`synthetic-grade-${grade}`,version=randomUUID(),attempt=randomUUID();
   const groups=['wrong','right','unanswered'].map(id=>({id,kind:'single',title:'合成題',assets:[],codes:['A','B'],choices:[{id:'A',text:'合成甲'},{id:'B',text:'合成乙'}],fields:[{id,text:'合成題幹',label:id,points:2,answer:'A',explanation:'合成來源解析'}]}));
   groups.push({id:'manual',kind:'manual',title:'合成自核',assets:[],fields:[{id:'manual',text:'合成自核題幹',label:'自核',points:1,reference:'合成參考'}]});
   const document={schema:1,title:'合成考古卷',groups,catalog:{grade}};
   const provenance={entries:groups.map(g=>({id:g.id,source:{sha256:'a'.repeat(64)},...(g.kind==='single'?{answerSource:{sha256:'b'.repeat(64),raw:'A'}}:{})}))};
   const bundle={paperId:paper,document,sha256:hash(document),provenance};
   const map={schema:2,paperId:paper,documentSha256:bundle.sha256,concepts:[{id:'synthetic',title:'合成重點',connection:'合成關聯',points:['合成說明']}],questions:groups.map(g=>({groupId:g.id,questionId:g.id,selfCheck:g.kind==='manual',expectedAnswer:g.fields[0].answer??null,...(g.kind==='manual'?{reference:g.fields[0].reference}:{}),source:provenance.entries.find(e=>e.id===g.id),conceptIds:['synthetic'],explanation:'合成學習解析'}))};
   validateLearningMap({bundle,map});
   await db.query('insert into public.quiz_past_papers(id,owner_id,grade,school_year,semester,title) values($1,$2,$3,115,1,$4)',[paper,TEACHER,grade,document.title]);
   await db.query('insert into public.quiz_past_versions(id,paper_id,sha256,document,provenance) values($1,$2,$3,$4,$5)',[version,paper,bundle.sha256,document,provenance]);
   await db.query('update public.quiz_past_papers set active_version=$1,enabled=true where id=$2',[version,paper]);
   await db.query('insert into public.quiz_past_attempts(id,paper_id,version_id,user_id,school_year,semester,start_request,max_score) values($1,$2,$3,$4,115,1,$5,6)',[attempt,paper,version,studentId(1),randomUUID()]);
   await db.query('insert into public.quiz_learning_maps(source_version,paper_id,source_sha,content,enabled) values($1,$2,$3,$4,true)',[version,paper,bundle.sha256,map]);
   for(const [id,correct] of [['wrong',false],['right',true],['manual',null]]){
    const results=correct===null?[]:[{questionId:id,correct,points:2}];
    await db.query('insert into public.quiz_past_receipts(attempt_id,group_id,request_id,responses,results,score,status) values($1,$2,$3,$4,$5,$6,$7)',[attempt,id,randomUUID(),[],results,correct===null?null:correct?2:0,correct===null?'self_checked':'graded']);
    if(correct!==null)await db.query('insert into public.quiz_past_answers(attempt_id,group_id,question_id,response,correct,points) values($1,$2,$2,$3,$4,2)',[attempt,id,JSON.stringify(correct?'A':'B'),correct]);
   }
   fixtures.push({grade,paper,version,attempt});
  }
  const project=(attempt,uid=studentId(1))=>db.transaction(async tx=>{
   await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);
   return (await tx.query('select public.quiz_past_snapshot_before_drafts($1) result',[attempt])).rows[0].result;
  });
  const dataFingerprint=async()=> (await db.query(`select jsonb_build_object(
   'attempts',(select jsonb_agg(to_jsonb(a) order by a.id) from public.quiz_past_attempts a),
   'answers',(select jsonb_agg(to_jsonb(a) order by a.attempt_id,a.question_id) from public.quiz_past_answers a),
   'receipts',(select jsonb_agg(to_jsonb(a) order by a.attempt_id,a.group_id) from public.quiz_past_receipts a),
   'awards',(select jsonb_agg(to_jsonb(a) order by a.id) from public.quiz_past_leaves a)) value`)).rows[0].value;
  const before=await dataFingerprint();
  assert.match((await project(fixtures[3].attempt)).records.wrong.learningExplanations[0].wrongReviewHref,/^\/grade3\//,'reproduces the existing grade-nine route defect');
  await db.exec(fix);assert.equal(await fingerprint(),fixedMd5);
  await db.exec(fix);assert.equal(await fingerprint(),fixedMd5,'same candidate can be reinstalled');
  for(const f of fixtures){
   const result=await project(f.attempt),explanation=result.records.wrong.learningExplanations[0];
   const url=new URL(explanation.wrongReviewHref,'https://example.invalid');
   assert.equal(url.pathname,`/grade${f.grade}/115-1/quiz-library.html`);
   for(const [key,value] of Object.entries({wrong_source:'past_exam',wrong_attempt:f.attempt,wrong_paper:f.paper,wrong_version:f.version,wrong_group:'wrong',wrong_question:'wrong'}))assert.equal(url.searchParams.get(key),value);
   assert.equal(url.hash,'#wrong');
   assert(!result.records.right.learningExplanations[0].wrongReviewHref);
   assert(!result.records.manual.learningExplanations[0].wrongReviewHref);
   assert(!result.records.unanswered);
   await assert.rejects(project(f.attempt,studentId(2)),/attempt_unavailable/);
   await assert.rejects(project(f.attempt,null),/attempt_unavailable/);
  }
  for(const role of ['anon','authenticated'])await assert.rejects(db.transaction(async tx=>{
   await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role '+role);
   await tx.query('select public.quiz_past_snapshot_before_drafts($1)',[fixtures[3].attempt]);
  }),/permission denied/);
  const g9=fixtures[3];
  await db.query('update public.quiz_learning_maps set paper_id=$1 where source_version=$2',[fixtures[0].paper,g9.version]);
  assert(!(await project(g9.attempt)).records.wrong.learningExplanations[0].wrongReviewHref,'mismatched map paper cannot supply a route for the owned source');
  await db.query('update public.quiz_learning_maps set paper_id=$1,enabled=false where source_version=$2',[g9.paper,g9.version]);
  const disabled=await project(g9.attempt);
  assert(!disabled.records.wrong.learningExplanations[0].wrongReviewHref);
  assert.equal(disabled.records.wrong.learningExplanations[0].text,'合成來源解析');
  await db.query('update public.quiz_learning_maps set enabled=true where source_version=$1',[g9.version]);
  assert.deepEqual(await dataFingerprint(),before,'function migration and reads do not rewrite answers, attempts or awards');
  await db.exec(rollback);assert.equal(await fingerprint(),sourceMd5);
  await db.exec(rollback);assert.equal(await fingerprint(),sourceMd5);
  assert.deepEqual(await dataFingerprint(),before);
  // A concurrent unrelated edit must fail the full definition fingerprint guard.
  await db.exec(definition('quiz_past_snapshot_before_drafts').replace("href:=null;","href:=null; -- synthetic concurrent change"));
  await assert.rejects(db.exec(fix),/quiz_past_learning_route_function_changed/);await db.exec('rollback');
 }finally{await db.close();}
});
