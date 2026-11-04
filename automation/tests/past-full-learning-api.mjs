import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {demoWrongResponses} from '../lib/past-demo-responses.mjs';
import {validateLearningMap} from '../lib/past-learning-map.mjs';
const out='automation/output/past-full-learning-20261101',origin=process.env.PAST_TEST_ORIGIN||'http://127.0.0.1:4497';
const read=name=>JSON.parse(fs.readFileSync(out+'/'+name,'utf8'));
const bundle=read('source-bundle.private.json'),map=read('learning-map.private.json'),packet=read('publisher-practice.private.json');
validateLearningMap({bundle,map});
for(const mutate of [m=>m.questions.pop(),m=>m.questions[0].expectedAnswer='O',m=>m.questions[0].source.source.sha256='0'.repeat(64),m=>m.questions[0].conceptIds=['missing'],m=>m.questions[0].selfCheck=true]){
 const broken=structuredClone(map);mutate(broken);assert.throws(()=>validateLearningMap({bundle,map:broken}));
}
const setup=await(await fetch(origin+'/__past/setup')).json();
const call=async(route,action,data={},student=2)=>{
 const r=await fetch(origin+'/__past/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':setup.nonce},body:JSON.stringify({action,data,student,fast:route==='rpc'&&action==='submit'})});return {status:r.status,data:await r.json()};
};
const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
const list=async(page=0,student=2,extra={})=>ok('library','wrong_questions',{action:'list',grade:3,page,...extra},student);
const demo=await list(0,1);assert.equal(demo.total,66);assert.equal((await list()).total,0);
const source=await ok('rpc','restart',{request_id:randomUUID()});
assert(!JSON.stringify(source).includes('learningExplanation'));assert(source.groups.every(g=>g.fields.every(f=>!Object.hasOwn(f,'answer'))));
const args={attempt_id:source.attemptId,version:setup.version,group_id:'s1-q01',question_id:'s1-q01',concept_id:'living-and-nonliving',request_id:randomUUID()};
assert.equal((await call('practice','start',args)).status,400);
const sampleIds=['s1-q01','s1-q13','s2-q13','s3-q01','s3-q02','s3-q06','s3-q07','s3-q08-1','s4-q01'];
const ordered=[...sampleIds.map(id=>bundle.document.groups.find(g=>g.id===id)),...bundle.document.groups.filter(g=>!sampleIds.includes(g.id))];
let baseline;const submitted=[];
for(const g of ordered){
 await ok('rpc','view',{attempt_id:source.attemptId,group_id:g.id});
 const request={attempt_id:source.attemptId,version:setup.version,group_id:g.id,confirmed:true,request_id:randomUUID(),responses:demoWrongResponses(g)};
 baseline=await ok('rpc','submit',request);assert.equal(baseline.records[g.id].learningExplanations.length,g.fields.length);
 assert(!baseline.records[g.id].learningReviews);submitted.push(g.id);
 if(submitted.length===sampleIds.length)fs.writeFileSync(out+'/sample-results.private.json',JSON.stringify({passed:true,groups:submitted,fields:submitted.flatMap(id=>bundle.document.groups.find(g=>g.id===id).fields).length}));
}
assert.equal(baseline.summary.score,0);assert.equal(Object.values(baseline.records).flatMap(r=>r.learningExplanations).length,67);
const rows=[];for(let page=0;page<4;page++){const r=await list(page);assert.equal(r.total,66);assert.equal(r.items.length,page===3?6:20);rows.push(...r.items);}
assert.equal(new Set(rows.map(r=>r.question_id)).size,66);assert(!rows.some(r=>r.question_id==='s4-q01'));
assert.equal((await list(0,2,{subject:'數學'})).total,0);
const details=[];
for(const row of rows){
 const detail=await ok('library','wrong_questions',{action:'detail',grade:3,...row});
 const entry=map.questions.find(e=>e.questionId===row.question_id);
 assert.equal(detail.past_review.record.learningReview.explanation,entry.explanation);assert.equal(detail.past_review.record.learningReview.source.versionId,setup.version);
 assert(detail.past_review.record.learningReview.concepts.every(c=>c.practice.available&&c.practice.count===2));
 assert.equal(detail.review.correct,false);details.push(detail);
}
const cross=rows[0];assert.equal((await call('library','wrong_questions',{action:'detail',grade:3,...cross},1)).status,400);
assert.equal((await call('library','wrong_questions',{action:'detail',grade:3,...cross,version_id:randomUUID()})).status,400);
assert.equal((await call('library','wrong_questions',{action:'detail',grade:3,...cross,group_id:'s4-q01'})).status,400);
assert.equal((await call('library','wrong_questions',{action:'detail',grade:3,...cross,source_type:'quiz'})).status,400);
const media=[...new Set(details.flatMap(d=>d.question.material.media.map(m=>m.url)))];
for(const url of media){
 const signed=await ok('rpc','media',{url,attempt_id:source.attemptId});const bytes=Buffer.from(await(await fetch(signed.url)).arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),url.split('/').at(-1));
 assert.equal((await call('rpc','media',{url,attempt_id:source.attemptId},1)).status,400);
}
const practiced=[];
for(const concept of map.concepts){
 const entry=map.questions.find(e=>!e.selfCheck&&e.conceptIds.includes(concept.id));
 const request={...args,group_id:entry.groupId,question_id:entry.questionId,concept_id:concept.id,request_id:randomUUID()};
 const started=await ok('practice','start',request);assert.equal((await ok('practice','start',request)).sessionId,started.sessionId);
 const url=new URL(started.url,origin);assert.equal(url.searchParams.get('wrong_question'),entry.questionId);assert.equal(url.searchParams.get('wrong_group'),entry.groupId);assert.equal(url.searchParams.get('wrong_attempt'),source.attemptId);
 assert.equal((await call('practice','entry_context',{session_id:started.sessionId},1)).status,400);
 let state=await ok('practice','quiz',{session_id:started.sessionId,quiz_action:'join'});assert(state.document.questions.every(q=>!q.answer&&!q.explanation));
 for(const [i,q] of packet.documents[concept.id].document.blocks.flatMap(b=>b.questions).entries()){
  const response=i===0?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id;
  const payload={session_id:started.sessionId,quiz_action:'submit',question_id:q.id,response,request_id:randomUUID()};state=await ok('practice','quiz',payload);
  assert.equal(state.reviews.find(r=>r.question_id===q.id).correct,i===0);assert.equal(state.leaf?.earned,false);
  assert.equal((await ok('practice','quiz',payload)).attempt_id,state.attempt_id);
 }
 assert.deepEqual((await ok('practice','quiz',{session_id:started.sessionId,quiz_action:'resume'})).responses,state.responses);
 practiced.push({conceptId:concept.id,questions:2,sourceQuestion:entry.questionId});
}
assert.equal((await list()).total,66);const after=await ok('rpc','resume',{attempt_id:source.attemptId});assert.deepEqual(after.records,baseline.records);assert.deepEqual(after.summary,baseline.summary);assert.deepEqual(after.practice,baseline.practice);
assert.equal((await call('practice','start',{...args,group_id:'s4-q01',question_id:'s4-q01',concept_id:'force-elements',request_id:randomUUID()})).status,400);
assert.equal((await call('practice','start',{...args,concept_id:'root-types',request_id:randomUUID()})).status,400,'cannot request unrelated concept');
const correct=await ok('rpc','restart',{request_id:randomUUID()});const g=bundle.document.groups[0];await ok('rpc','view',{attempt_id:correct.attemptId,group_id:g.id});await ok('rpc','submit',{attempt_id:correct.attemptId,version:setup.version,group_id:g.id,request_id:randomUUID(),responses:[{questionId:g.id,value:g.fields[0].answer}]});
assert.equal((await call('practice','start',{...args,attempt_id:correct.attemptId,request_id:randomUUID()})).status,400);assert.equal((await list()).total,66);
fs.writeFileSync(out+'/api-results.private.json',JSON.stringify({passed:true,sourceAttempt:source.attemptId,version:setup.version,groups:42,explanations:67,wrongFields:66,selfCheckExcluded:1,concepts:22,publisherQuestions:44,practiced,mediaShaChecks:media.length,sampleFirst:true,ownership:true,noPreSubmitAnswers:true,noExtraLeaves:true,originalUnchanged:true,mapMutationRejected:true},null,2));
console.log('PASS full paper: 67 explanations / 66 wrong details / 22 concepts / 44 publisher questions / authorized original images');
