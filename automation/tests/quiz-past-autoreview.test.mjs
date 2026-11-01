import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {createQuizDb,TEACHER,studentId} from '../lib/quiz-local-db.mjs';
const root='automation/output/past-exams-autoreview-20261101',read=f=>JSON.parse(fs.readFileSync(root+'/'+f,'utf8')),rows=read('candidates.private.json');
const values=(g,ok)=>g.fields.map(f=>g.kind==='manual'?{text:'隔離測試',strokes:[],confirmed:true}:g.kind==='annotation'?{mediaSha256:g.assets[0].sha256,point:{x:.4,y:.3},arrow:{from:{x:.4,y:.3},to:{x:.4,y:.6}}}:g.kind==='short'?(ok?f.answer[0]:'__wrong__'):ok?f.answer:g.kind==='mark'?!f.answer:['single','code'].includes(g.kind)?g.choices.find(c=>c.id!==f.answer).id:g.kind==='sequence'?[...f.answer].reverse():[g.codes.find(c=>!f.answer.includes(c))]);
test('自主審定：四卷三恢復欄、等價答案邊界、未洩答、歷次與跨版一葉',async()=>{
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true}),reports={};
 try{await db.exec(fs.readFileSync('supabase/quiz-past-exams.sql','utf8'));
 for(const c of rows){const b=read(c.paperId+'/bundle.private.json'),old=read(c.paperId+'/before-bundle.private.json'),grade=Number(c.paperId.split('-')[3].slice(1));
  assert.equal(createHash('sha256').update(JSON.stringify(b.document)).digest('hex'),b.sha256);assert.deepEqual(b.assets,old.assets);
  for(const e of old.provenance.entries)assert.deepEqual(b.provenance.entries.find(n=>n.id===e.id).answerSource,e.answerSource);
  assert.deepEqual(b.document.blocked,old.document.blocked.filter(f=>!c.restoredIds.includes(f.id)));
  await db.query("update public.student_enrollments set class_code=$1 where email='student1@example.invalid'",[grade+'01']);
  await db.query('insert into public.quiz_past_papers(id,owner_id,grade,school_year,semester,title) values($1,$2,$3,115,1,$4)',[b.paperId,TEACHER,grade,b.document.title]);const versions=[];
  for(const x of [old,b]){await db.query('select public.quiz_past_validate($1)',[x.document]);versions.push((await db.query('insert into public.quiz_past_versions(paper_id,sha256,document,provenance) values($1,$2,$3,$4) returning id',[b.paperId,x.sha256,x.document,x.provenance])).rows[0].id);}
  await db.query('update public.quiz_past_papers set enabled=true,active_version=$1 where id=$2',[versions[0],b.paperId]);
  const call=(action,data={})=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');return(await tx.query('select public.quiz_past_action($1,$2) r',[action,{paper_id:b.paperId,...data}])).rows[0].r;});
  const submit=async(a,g,vs)=>{await call('view',{attempt_id:a.attemptId,group_id:g.id});await db.query("update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=$1 and group_id=$2",[a.attemptId,g.id]);return call('submit',{attempt_id:a.attemptId,version:a.version,group_id:g.id,request_id:randomUUID(),confirmed:true,responses:g.fields.map((f,i)=>({questionId:f.id,value:vs[i]}))});};
  const oldA=await call('restart',{request_id:randomUUID()});await db.query('update public.quiz_past_papers set active_version=$1 where id=$2',[versions[1],b.paperId]);assert.equal((await call('resume',{attempt_id:oldA.attemptId})).version,versions[0]);
  const rejected={'s2-q13':['1','2','3'],'s3-q08-1':['互生','對生','甲'],'s1-q11':['1'],'s5-q01':['crisps','potato chips','French fires'],'s5-q05':['England','Scotland','the uk'],'s8-q01-b':['im','I is'],'s8-q02-a':['were','we am'],'s3-q05':['壓力','氣壓','高度','濕度']};
  for(const g of b.document.groups){for(const f of g.fields.filter(f=>[...c.changedIds,...c.restoredIds].includes(f.id))){
   const accepted=g.kind==='short'?f.answer:[f.answer];for(const [ok,vals] of [[true,accepted],[false,rejected[f.id]||[]]])for(const v of vals){const a=await call('restart',{request_id:randomUUID()}),safe=a.groups.find(x=>x.id===g.id);assert(!('answer' in safe.fields[0]));assert(!JSON.stringify(safe).includes('editorialDecision'));const vs=values(g,true);vs[g.fields.indexOf(f)]=v;const r=await submit(a,g,vs);assert.equal(r.records[g.id].results.find(x=>x.questionId===f.id).correct,ok,`${f.id} ${v}`);}
  }}
  const chinese=b.document.groups.find(g=>g.id==='s3'&&g.fields.length===10);if(chinese){assert.match(chinese.notice,/依每段錯字在原文出現的順序/);assert.deepEqual(chinese.fields,old.document.groups.find(g=>g.id==='s3').fields);assert(!chinese.fields.some(f=>/帕|磚|尤|准|廠|始/.test(f.text)));}
  const max=b.document.groups.filter(g=>!['manual','annotation'].includes(g.kind)).flatMap(g=>g.fields).reduce((n,f)=>n+f.points,0);
  for(const ok of [false,true,true]){let a=await call('restart',{request_id:randomUUID()});for(const g of b.document.groups)a=await submit(a,g,values(g,ok));assert(a.practice.complete);assert.equal(a.summary.max,max);assert.equal(a.summary.score,ok?max:0);assert.equal(a.practice.leafCount,ok?1:0);}
  let a=oldA;for(const g of old.document.groups)a=await submit(a,g,values(g,true));assert.equal(a.version,versions[0]);assert(a.practice.complete);assert.equal(a.practice.leafCount,1);assert.equal(a.practice.history.filter(h=>h.earned_leaf).length,1);
  assert.deepEqual((await db.query('select document,provenance from public.quiz_past_versions where id=$1',[versions[0]])).rows[0],{document:old.document,provenance:old.provenance});reports[b.paperId]=b.sha256;
 }
 assert.equal(rows.flatMap(r=>r.restoredIds).length,3);fs.writeFileSync(root+'/local-qc.private.json',JSON.stringify({passed:true,papers:reports,restored:3,variantRejection:true,oldVersionPinned:true,leafOnceAcrossVersions:true,at:new Date().toISOString()},null,2));
 }finally{await db.close();}
});
