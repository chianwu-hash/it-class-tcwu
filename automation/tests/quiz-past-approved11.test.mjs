import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {createQuizDb,TEACHER,studentId} from '../lib/quiz-local-db.mjs';
const root='automation/output/past-exams-approved11-20261031',read=f=>JSON.parse(fs.readFileSync(root+'/'+f,'utf8')),candidates=read('candidates.private.json');
export function values(g,correct){return g.fields.map(f=>g.kind==='manual'?{text:'本機合成核對，非正式作答',strokes:[],confirmed:true}:g.kind==='annotation'?{mediaSha256:g.assets[0].sha256,point:{x:.4,y:.3},arrow:{from:{x:.4,y:.3},to:{x:.4,y:.6}}}:g.kind==='short'?(correct?f.answer[0]:'__wrong__'):correct?f.answer:g.kind==='mark'?!f.answer:['single','code'].includes(g.kind)?g.choices.find(c=>c.id!==f.answer).id:g.kind==='sequence'?[...f.answer].reverse():[g.codes.find(c=>!f.answer.includes(c))]);}
test('11項教師核准：七卷新舊版、逐欄判分、原記號與配分、跨版本歷次及一葉',async()=>{
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});const reports={};
 try{await db.exec(fs.readFileSync('supabase/quiz-past-exams.sql','utf8'));
 for(const c of candidates){
  const b=read(c.paperId+'/bundle.private.json'),old=read(c.paperId+'/before-bundle.private.json'),grade=Number(c.paperId.split('-')[3].slice(1));
  assert.equal(createHash('sha256').update(JSON.stringify(b.document)).digest('hex'),b.sha256);
  const ids=new Set(c.restoredIds);assert.deepEqual(b.document.blocked,old.document.blocked.filter(f=>!ids.has(f.id)));
  const fields=b.document.groups.flatMap(g=>g.fields),prior=old.document.groups.flatMap(g=>g.fields);assert.equal(fields.length,prior.length+ids.size);
  for(const f of prior)assert.deepEqual(fields.find(n=>n.id===f.id),f);
  for(const e of old.provenance.entries)assert.deepEqual(b.provenance.entries.find(n=>n.id===e.id).answerSource,e.answerSource);
  for(const id of ids){assert.equal(fields.find(f=>f.id===id).points,old.document.blocked.find(f=>f.id===id).points);assert(b.provenance.entries.find(e=>e.id===id).teacherDecision.confirmed);}
  await db.query("update public.student_enrollments set class_code=$1 where email='student1@example.invalid'",[grade+'01']);
  await db.query('insert into public.quiz_past_papers(id,owner_id,grade,school_year,semester,title) values($1,$2,$3,115,1,$4)',[b.paperId,TEACHER,grade,b.document.title]);const versions=[];
  for(const x of [old,b]){await db.query('select public.quiz_past_validate($1)',[x.document]);versions.push((await db.query('insert into public.quiz_past_versions(paper_id,sha256,document,provenance) values($1,$2,$3,$4) returning id',[b.paperId,x.sha256,x.document,x.provenance])).rows[0].id);}
  await db.query('update public.quiz_past_papers set enabled=true,active_version=$1 where id=$2',[versions[0],b.paperId]);
  const call=(action,data={})=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');return(await tx.query('select public.quiz_past_action($1,$2) r',[action,{paper_id:b.paperId,...data}])).rows[0].r;});
  const submit=async(a,g,vs)=>{await call('view',{attempt_id:a.attemptId,group_id:g.id});await db.query("update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=$1 and group_id=$2",[a.attemptId,g.id]);return call('submit',{attempt_id:a.attemptId,version:a.version,group_id:g.id,request_id:randomUUID(),confirmed:true,responses:g.fields.map((f,i)=>({questionId:f.id,value:vs[i]}))});};
  const oldA=await call('restart',{request_id:randomUUID()});await db.query('update public.quiz_past_papers set active_version=$1 where id=$2',[versions[1],b.paperId]);assert.deepEqual((await call('resume',{attempt_id:oldA.attemptId})).groups,oldA.groups);
  for(const g of b.document.groups.filter(g=>g.fields.some(f=>ids.has(f.id)))){
   const a=await call('restart',{request_id:randomUUID()}),safe=a.groups.find(x=>x.id===g.id);assert(safe);assert(!JSON.stringify(safe).includes('teacherDecision'));for(const f of safe.fields){assert(!('answer' in f));assert(!('reference' in f));}
   const r=await submit(a,g,values(g,true));for(const f of g.fields.filter(f=>ids.has(f.id))){const result=r.records[g.id].results.find(x=>x.questionId===f.id);assert(result);if(g.kind==='manual'){assert.equal(r.records[g.id].score,null);assert.equal(r.records[g.id].reference,f.reference);}else{assert.equal(result.correct,true);}}
   if(g.kind!=='manual'){
    const wrongById={'s1-f06':'ㄌㄨㄢˊ','s1-f17':'ㄌㄨˋ','d2-q04':'120','s6-q03-2':'9046','s3-q04-4':false};
    const wrong=values(g,true).map((v,i)=>ids.has(g.fields[i].id)?(wrongById[g.fields[i].id]??(g.kind==='single'?(g.fields[i].answer==='2'?'1':'3'):'__wrong__')):v);
    const attempt=await call('restart',{request_id:randomUUID()}),bad=await submit(attempt,g,wrong);for(const f of g.fields.filter(f=>ids.has(f.id)))assert.equal(bad.records[g.id].results.find(x=>x.questionId===f.id).correct,false);
   }
  }
  const max=fields.filter(f=>!b.document.groups.some(g=>['manual','annotation'].includes(g.kind)&&g.fields.includes(f))).reduce((n,f)=>n+f.points,0);
  for(const correct of [false,true,true]){let a=await call('restart',{request_id:randomUUID()});for(const g of b.document.groups)a=await submit(a,g,values(g,correct));assert(a.practice.complete);assert.equal(a.summary.max,max);assert.equal(a.summary.score,correct?max:0);assert.equal(a.practice.leafCount,correct?1:0);}
  let a=oldA;for(const g of old.document.groups)a=await submit(a,g,values(g,true));assert.equal(a.version,versions[0]);assert(a.practice.complete);assert.equal(a.practice.leafCount,1);assert.equal(a.practice.history.filter(h=>h.earned_leaf).length,1);
  assert.deepEqual((await db.query('select document,provenance from public.quiz_past_versions where id=$1',[versions[0]])).rows[0],{document:old.document,provenance:old.provenance});reports[b.paperId]=b.sha256;
 }
 assert.equal(candidates.reduce((n,c)=>n+c.restoredIds.length,0),11);fs.writeFileSync(root+'/local-qc.private.json',JSON.stringify({passed:true,papers:reports,restored:11,manualWholeQuestions:true,oldVersionPinned:true,leafOnceAcrossVersions:true,at:new Date().toISOString()},null,2));
 }finally{await db.close();}
});
