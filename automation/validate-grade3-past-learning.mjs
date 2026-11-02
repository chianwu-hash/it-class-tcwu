import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {createQuizDb,quizCall,TEACHER,studentId} from './lib/quiz-local-db.mjs';
import {validateLearningMap} from './lib/past-learning-map.mjs';import {createPastLearningProjection} from './lib/past-learning-fixture.mjs';
import {createPastPublisherPractice} from './lib/past-publisher-practice.mjs';import {createPastWrongReview} from './lib/past-wrong-review.mjs';import {demoWrongResponses} from './lib/past-demo-responses.mjs';
const out=path.resolve(process.env.PAST_G3_LEARNING_ROOT||'automation/output/past-grade3-learning-20261102'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const hash=v=>createHash('sha256').update(v).digest('hex');
const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true}),proof=[];const uid=studentId(1),other=studentId(2);
const rpc=async(user,action,data)=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[user]);await tx.exec('set local role authenticated');return (await tx.query('select public.quiz_past_action($1,$2) r',[action,data])).rows[0].r;});
try{
 await db.exec(fs.readFileSync('supabase/quiz-past-exams.sql','utf8'));await db.query("update public.student_enrollments set class_code='301' where email like 'student%@example.invalid'");
 for(const name of fs.readdirSync(out).filter(s=>s.startsWith('dingxi-')).sort()){
  const dir=path.join(out,name),bundle=read(path.join(dir,'source-bundle.private.json')),map=read(path.join(dir,'learning-map.private.json')),packet=read(path.join(dir,'publisher-practice.private.json'));
  validateLearningMap({bundle,map});await db.query('select public.quiz_past_validate($1)',[bundle.document]);
  for(const change of [m=>m.questions.pop(),m=>m.questions[0].expectedAnswer='corrupt',m=>m.questions[0].source.source.sha256='0'.repeat(64),m=>m.questions[0].conceptIds=['missing']]){const bad=structuredClone(map);change(bad);assert.throws(()=>validateLearningMap({bundle,map:bad}));}
  const manual=map.questions.find(e=>e.expectedAnswer===null);if(manual){const bad=structuredClone(map);bad.questions.find(e=>e.questionId===manual.questionId).reference='corrupt';assert.throws(()=>validateLearningMap({bundle,map:bad}));}
  await db.query('insert into public.quiz_past_papers values($1,$2,3,115,1,$3,null,true)',[name,TEACHER,bundle.document.title]);
  const version=bundle.activeVersion;await db.query('insert into public.quiz_past_versions(id,paper_id,sha256,document,provenance) values($1,$2,$3,$4,$5)',[version,name,bundle.sha256,bundle.document,bundle.provenance]);await db.query('update public.quiz_past_papers set active_version=$1 where id=$2',[version,name]);
  for(const asset of bundle.assets||[])await db.query('insert into public.quiz_media_assets values($1,$2,$3,$4,$5) on conflict do nothing',[asset.url,TEACHER,asset.object_path,asset.mime,asset.bytes]);
  const projection=createPastLearningProjection({bundle,map,version});const practice=await createPastPublisherPractice({db,teacher:TEACHER,bundle,map,version,packet,wrongEntryOnly:true});const project=s=>practice.project(projection(s));
  const wrong=createPastWrongReview({db,bundle,map,version,grade:3,project,isPracticeSession:practice.isPracticeSession});
  let state=await rpc(uid,'start',{paper_id:name,request_id:randomUUID()});const attempt=state.attemptId;
  assert(!Object.values(project(state).records).some(r=>r.learningReviews));assert(state.groups.every(g=>g.fields.every(f=>!('answer' in f))));
  for(const g of bundle.document.groups){await rpc(uid,'view',{paper_id:name,attempt_id:attempt,group_id:g.id});await db.query("update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=$1",[attempt]);state=await rpc(uid,'submit',{paper_id:name,attempt_id:attempt,version,group_id:g.id,confirmed:true,request_id:randomUUID(),responses:demoWrongResponses(g)});}
  const baseline=project(state),before=JSON.stringify({records:state.records,summary:state.summary,practice:state.practice});
  assert.equal(Object.values(baseline.records).reduce((n,r)=>n+Object.keys(r.learningReviews||{}).length,0),map.questions.length);
  const wrongEntries=map.questions.filter(e=>!e.selfCheck);
  for(const e of wrongEntries){
   const ref={source_type:'past_exam',attempt_id:attempt,paper_id:name,version_id:version,group_id:e.groupId,question_id:e.questionId};
   const detail=await wrong.read({uid,data:{action:'detail',grade:3,...ref}});assert.equal(detail.review.explanation.text,e.explanation);
   for(const c of detail.past_review.record.learningReview.concepts){if(packet.documents[c.id])assert(c.practice.available&&c.practice.count===2);else assert(!c.practice?.available);}
  }
  const entry=wrongEntries[0];const ref={source_type:'past_exam',attempt_id:attempt,paper_id:name,version_id:version,group_id:entry.groupId,question_id:entry.questionId};await assert.rejects(()=>wrong.read({uid:other,data:{action:'detail',grade:3,...ref}}));
  let checked=0,teacherOnly=0;
  for(const [cid,doc] of Object.entries(packet.documents)){
   const entry=wrongEntries.find(e=>e.conceptIds.includes(cid));if(!entry){
    // Self-check source fields have no student wrong-question entry. Verify these
    // content-only pairs separately; do not advertise them as a working wrong route.
    const bank=randomUUID();await quizCall(db,TEACHER,'save',{bank_id:bank,expected_revision:0,document:doc.document});
    const frozen=await quizCall(db,TEACHER,'publish',{bank_id:bank,expected_revision:1}),sid=randomUUID();
    await quizCall(db,TEACHER,'open',{session_id:sid,version_id:frozen.id,school_year:115,class_codes:['301'],reveal:'immediate',shuffle_questions:false,shuffle_options:false,access_mode:'classroom'});
    const joined=await quizCall(db,uid,'join',{session_id:sid});assert(joined.document.questions.every(q=>!q.answer));
    for(const q of doc.document.blocks.flatMap(b=>b.questions)){const r=await quizCall(db,uid,'submit',{session_id:sid,question_id:q.id,response:q.answer.option_id,request_id:randomUUID()});assert.equal(r.reviews.find(r=>r.question_id===q.id).correct,true);teacherOnly++;}
    continue;
   }
   const data={attempt_id:attempt,version,group_id:entry.groupId,question_id:entry.questionId,concept_id:cid,request_id:randomUUID()};
   const started=await practice.call({uid,student:1,action:'start',data});assert.equal((await practice.call({uid,student:1,action:'start',data})).sessionId,started.sessionId);
   const url=new URL(started.url,'http://127.0.0.1');assert.equal(url.searchParams.get('wrong_attempt'),attempt);assert.equal(url.searchParams.get('wrong_version'),version);assert.equal(url.searchParams.get('wrong_question'),entry.questionId);
   await assert.rejects(()=>practice.call({uid:other,student:2,action:'quiz',data:{session_id:started.sessionId,quiz_action:'join'}}));
   let result=await practice.call({uid,student:1,action:'quiz',data:{session_id:started.sessionId,quiz_action:'join'}});assert(result.document.questions.every(q=>!q.answer&&!q.explanation));
   const qs=doc.document.blocks.flatMap(b=>b.questions);
   for(const [i,q] of qs.entries()){
    const payload={session_id:started.sessionId,quiz_action:'submit',question_id:q.id,response:i===0?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id,request_id:randomUUID()};
    result=await practice.call({uid,student:1,action:'quiz',data:payload});assert.equal(result.reviews.find(r=>r.question_id===q.id).correct,i===0);assert(!result.leaf?.earned);checked++;
    assert.equal((await practice.call({uid,student:1,action:'quiz',data:payload})).attempt_id,result.attempt_id);
   }
  }
  const after=await rpc(uid,'resume',{paper_id:name,attempt_id:attempt});assert.equal(JSON.stringify({records:after.records,summary:after.summary,practice:after.practice}),before);
  const row={paper:name,version,fields:map.questions.length,wrongFields:wrongEntries.length,concepts:map.concepts.length,pairedConcepts:Object.keys(packet.documents).length,practicedFields:checked,teacherOnlyFields:teacherOnly,unavailable:map.concepts.filter(c=>!packet.documents[c.id]).map(c=>c.id),sourceUnchanged:true,ownership:true,noEarlyAnswers:true,returnsSameSource:true,mutationRejected:true};proof.push(row);console.log('PASS',name,row.fields,'explanations',checked,'practice answers');
 }
 assert.equal(proof.length,10,'Expected the ten enabled grade-3 midterm papers');
 fs.writeFileSync(path.join(out,'validation.private.json'),JSON.stringify({passed:true,at:new Date().toISOString(),dataScope:'synthetic local PGlite only',papers:proof,totalFields:proof.reduce((n,r)=>n+r.fields,0),totalPracticed:proof.reduce((n,r)=>n+r.practicedFields,0),totalTeacherOnly:proof.reduce((n,r)=>n+r.teacherOnlyFields,0)},null,2));
}catch(e){fs.writeFileSync(path.join(out,'validation-error.private.json'),JSON.stringify({message:e.message,stack:e.stack,where:e.where,code:e.code,completed:proof.map(p=>p.paper)},null,2));console.error(e.message,e.where||'');process.exitCode=1;}finally{await db.close();}
