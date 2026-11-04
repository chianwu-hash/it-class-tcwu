import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const origin=process.env.PAST_TEST_ORIGIN||'http://127.0.0.1:4493';
const setup=await(await fetch(origin+'/__past/setup')).json();
const packet=JSON.parse(fs.readFileSync(process.env.PAST_PUBLISHER_PRACTICE_PATH,'utf8'));
const call=async(route,action,data={},student=2)=>{const r=await fetch(origin+'/__past/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':setup.nonce},body:JSON.stringify({action,data,student,fast:route==='rpc'&&action==='submit'})});return {status:r.status,data:await r.json()};};
const source=(await call('rpc','restart',{request_id:randomUUID()})).data;
const conceptIds=Object.keys(packet.documents),data={attempt_id:source.attemptId,version:setup.version,group_id:'s1-q01',question_id:'s1-q01',concept_id:conceptIds[0],request_id:randomUUID()};
assert.equal((await call('practice','start',data)).status,400,'no practice before source answer');
await call('rpc','view',{attempt_id:source.attemptId,group_id:'s1-q01'});
const baseline=(await call('rpc','submit',{attempt_id:source.attemptId,version:setup.version,group_id:'s1-q01',request_id:randomUUID(),responses:[{questionId:'s1-q01',value:'O'}]})).data;
assert(baseline.records['s1-q01'].learningReview.concepts.every(c=>c.practice.available&&c.practice.count===2));
assert.equal((await call('practice','start',{...data,version:randomUUID()})).status,400);
assert.equal((await call('practice','start',{...data,concept_id:'unknown'})).status,400);
assert.equal((await call('practice','start',data,1)).status,400);
const completed=[];
for(const [index,conceptId] of conceptIds.entries()){
 const request={...data,concept_id:conceptId,request_id:randomUUID()};
 const started=await call('practice','start',request);assert.equal(started.status,200,JSON.stringify(started.data));
 const sessionId=started.data.sessionId;assert.equal(started.data.awardEligible,false);
 assert.equal((await call('practice','start',request)).data.sessionId,sessionId);
 assert.equal((await call('practice','start',{...request,request_id:randomUUID()})).data.sessionId,sessionId);
 assert.equal((await call('practice','start',{...request,concept_id:conceptIds[1-index]})).status,400);
 assert.equal((await call('practice','entry_context',{session_id:sessionId},1)).status,400);
 const context=await call('practice','entry_context',{session_id:sessionId});assert.equal(context.status,200);
 const joined=await call('practice','quiz',{session_id:sessionId,quiz_action:'join'});assert.equal(joined.status,200,JSON.stringify(joined.data));
 assert.equal(joined.data.document.questions.length,2);assert.equal(joined.data.reviews.length,0);
 assert(joined.data.document.questions.every(q=>!('answer' in q)&&!('explanation' in q)));
 let state=joined.data;
 for(const [i,q] of packet.documents[conceptId].document.blocks.flatMap(b=>b.questions).entries()){
  const response=index===0?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id;
  const responsePacket={session_id:sessionId,quiz_action:'submit',question_id:q.id,response,request_id:randomUUID()};
  const saved=await call('practice','quiz',responsePacket);assert.equal(saved.status,200,JSON.stringify(saved.data));state=saved.data;
  assert.equal(state.reviews.find(r=>r.question_id===q.id).correct,index===0);
  assert.equal(state.reviews.find(r=>r.question_id===q.id).answer.option_id,q.answer.option_id);
  const again=await call('practice','quiz',responsePacket);assert.equal(again.status,200);assert.equal(again.data.attempt_id,state.attempt_id);
 }
 assert.equal(state.reviews.length,2);assert.equal(state.leaf?.earned,false);
 const resumed=await call('practice','quiz',{session_id:sessionId,quiz_action:'resume'});assert.equal(resumed.data.attempt_id,state.attempt_id);assert.deepEqual(resumed.data.responses,state.responses);
 assert.equal((await call('practice','quiz',{session_id:sessionId,quiz_action:'resume'},1)).status,400);
 completed.push({conceptId,sessionId,attemptId:state.attempt_id,correct:index===0?2:0});
}
const after=(await call('rpc','resume',{attempt_id:source.attemptId})).data;
assert.deepEqual(after.summary,baseline.summary);assert.deepEqual(after.practice,baseline.practice);assert.deepEqual(after.records,baseline.records);
fs.writeFileSync('automation/output/past-learning-publisher-mvp-20261101/api-results.private.json',JSON.stringify({passed:true,completed,realLocalSql:true,noPreSubmitAnswers:true,idempotent:true,crossStudentDenied:true,noLeaves:true,sourceUnchanged:true,publisher:'康軒',questions:4},null,2));
console.log('PASS publisher practice: four source questions, two concepts, real local SQL and permissions');
