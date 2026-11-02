import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {extensionQuestionKey} from '../lib/past-extension-rewards.mjs';
const origin=process.env.PAST_TEST_ORIGIN||'http://127.0.0.1:4497',out='automation/output/past-full-learning-20261101';
const packet=JSON.parse(fs.readFileSync(out+'/publisher-practice.private.json','utf8'));
const setup=await(await fetch(origin+'/__past/setup')).json();
const call=async(route,action,data={},student=2)=>{const r=await fetch(origin+'/__past/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':setup.nonce},body:JSON.stringify({action,data,student})});return {status:r.status,data:await r.json()};};
const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
const list=await ok('extension','review'),attempt=list.attempts[0];assert.equal(Number(attempt.score),Number(attempt.max_score));
const before=await ok('rpc','resume',{attempt_id:attempt.id});
assert.equal((await ok('library','wrong_questions',{action:'list',grade:3})).total,0);
const review=await ok('extension','review',{attempt_id:attempt.id});assert.equal(review.concepts.length,22);
assert(!JSON.stringify(review).includes('normalizedAnswer'));
assert.equal((await call('extension','review',{attempt_id:attempt.id},1)).status,400);
assert.equal((await call('extension','review',{attempt_id:randomUUID()})).status,400);
const interrupted=await ok('rpc','restart',{request_id:randomUUID()});
assert.equal((await call('extension','review',{attempt_id:interrupted.attemptId})).status,400);
const req={...review.concepts[0].source,request_id:randomUUID(),retake:true};
assert.equal((await call('practice','start',{...req,entry_mode:undefined})).status,400,'correct source is not a wrong question');
assert.equal((await call('practice','start',{...req,concept_id:'unrelated'})).status,400);
assert.equal((await call('practice','start',{...req,version:randomUUID()})).status,400);
const unique=new Set(),trials=[];let last;
for(const [ci,c] of review.concepts.slice(0,5).entries()){
 const request={...c.source,request_id:randomUUID(),retake:true};const started=await ok('practice','start',request);
 assert.equal((await ok('practice','start',request)).sessionId,started.sessionId);
 const url=new URL(started.url,origin);assert.equal(url.searchParams.get('learning_attempt'),attempt.id);assert.equal(url.searchParams.get('learning_concept'),c.id);assert(!url.searchParams.has('wrong_question'));
 assert.equal((await call('practice','quiz',{session_id:started.sessionId,quiz_action:'join'},1)).status,400);
 const joined=await ok('practice','quiz',{session_id:started.sessionId,quiz_action:'join'});assert(joined.document.questions.every(q=>!q.answer));
 for(const q of packet.documents[c.id].document.blocks.flatMap(b=>b.questions)){
  const key=extensionQuestionKey(packet.publisher,q);assert(!unique.has(key),'test requires ten unique questions');
  const payload={session_id:started.sessionId,quiz_action:'submit',question_id:q.id,response:ci%2?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id,request_id:randomUUID()};
  const tooFast=await ok('practice','quiz',payload);assert.equal(tooFast.warning,'answer_too_fast');
  assert.equal((await ok('extension','summary')).count,unique.size,'unaccepted answer gives no credit');
  await ok('practice','quiz',{session_id:started.sessionId,quiz_action:'view_question',question_id:q.id});
  await new Promise(r=>setTimeout(r,2050));
  last=await ok('practice','quiz',payload);unique.add(key);
  assert.equal(last.extension.count,unique.size);assert.equal(last.extension.leaves,Math.floor(unique.size/10));
  assert.equal(last.leaf?.earned,false,'ordinary quiz reward remains separate');
  const resend=await ok('practice','quiz',payload);assert.equal(resend.extension.count,unique.size);assert.equal(resend.extension.earnedNow,0);
  if(unique.size===9)assert.equal(last.extension.leaves,0);
 }
 trials.push({concept:c.id,session:started.sessionId});
}
assert.equal(last.extension.count,10);assert.equal((await ok('extension','summary')).leaves,1);
const redo=await ok('practice','start',{...review.concepts[0].source,request_id:randomUUID(),retake:true});assert.notEqual(redo.sessionId,trials[0].session);
await ok('practice','quiz',{session_id:redo.sessionId,quiz_action:'join'});
for(const q of packet.documents[review.concepts[0].id].document.blocks.flatMap(b=>b.questions)){
 await ok('practice','quiz',{session_id:redo.sessionId,quiz_action:'view_question',question_id:q.id});await new Promise(r=>setTimeout(r,2050));
 const r=await ok('practice','quiz',{session_id:redo.sessionId,quiz_action:'submit',question_id:q.id,response:q.answer.option_id,request_id:randomUUID()});assert.equal(r.extension.count,10);assert.equal(r.extension.added,0);
}
assert.equal((await ok('extension','summary',{},1)).count,0);
const after=await ok('rpc','resume',{attempt_id:attempt.id});assert.deepEqual(after.records,before.records);assert.deepEqual(after.summary,before.summary);
// A restart creates a separate original attempt, but must not change original-leaf eligibility.
assert.equal(after.practice.leafCount,before.practice.leafCount);assert.equal(after.practice.earnedByThisAttempt,before.practice.earnedByThisAttempt);
assert.equal((await ok('library','wrong_questions',{action:'list',grade:3})).total,0);
const wrong=await ok('library','wrong_questions',{action:'list',grade:3},1),first=wrong.items[0];
const detail=await ok('library','wrong_questions',{action:'detail',grade:3,...first},1),lr=detail.past_review.record.learningReview;
const wrongStart=await ok('practice','start',{attempt_id:first.attempt_id,version:lr.source.versionId,group_id:lr.source.groupId,question_id:lr.source.questionId,concept_id:lr.concepts[0].id,request_id:randomUUID(),retake:true},1);
assert.equal(new URL(wrongStart.url,origin).searchParams.get('wrong_question'),first.question_id);
const result={passed:true,fullScoreActiveReview:true,tenUniqueOneLeaf:true,nineNoLeaf:true,wrongAnswersCount:true,retakeAndReplayDeduplicated:true,partialAnswersCount:true,crossOwnerDenied:true,incompleteDenied:true,originalUnchanged:true,wrongEntryReturnPreserved:true,trials};
fs.writeFileSync(out+'/extension-api-results.private.json',JSON.stringify(result,null,2));console.log('PASS extension API: 9/10 boundary, wrong answers, retry, full-score review, ownership and original records');
