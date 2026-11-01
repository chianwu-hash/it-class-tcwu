import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const origin=process.env.PAST_TEST_ORIGIN||'http://127.0.0.1:4495';
const setup=await(await fetch(origin+'/__past/setup')).json();
const call=async(route,action,data={},student=2)=>{
 const response=await fetch(origin+'/__past/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':setup.nonce},body:JSON.stringify({action,data,student,fast:route==='rpc'&&action==='submit'})});
 return {status:response.status,data:await response.json()};
};
const list=async(student=2,extra={})=>call('library','wrong_questions',{action:'list',grade:3,page:0,...extra},student);
const demo=await list(1);assert.equal(demo.status,200,JSON.stringify(demo));assert.equal(demo.data.total,1);
assert.equal((await list()).data.total,0);
assert.equal((await call('library','library_sessions',{grade:3})).status,200);
assert.equal((await call('library','pool_catalog',{})).status,200);
const started=(await call('rpc','restart',{request_id:randomUUID()})).data;
const practice={attempt_id:started.attemptId,version:setup.version,group_id:'s1-q01',question_id:'s1-q01',concept_id:'living-and-nonliving',request_id:randomUUID()};
assert.equal((await call('practice','start',practice)).status,400);
await call('rpc','view',{attempt_id:started.attemptId,group_id:'s1-q01'});
const wrong=await call('rpc','submit',{attempt_id:started.attemptId,version:setup.version,group_id:'s1-q01',request_id:randomUUID(),responses:[{questionId:'s1-q01',value:'O'}]});assert.equal(wrong.status,200);
assert(!wrong.data.records['s1-q01'].learningReview);assert(wrong.data.records['s1-q01'].wrongReviewHref.includes('fixture_student=2'));
const rows=await list();assert.equal(rows.data.total,1);const ref=rows.data.items[0];assert.equal(ref.source_type,'past_exam');
const detail=await call('library','wrong_questions',{action:'detail',grade:3,...ref});assert.equal(detail.status,200,JSON.stringify(detail));assert.equal(detail.data.review.correct,false);assert.equal(detail.data.review.answer.option_id,'X');assert.equal(detail.data.past_review.record.learningReview.concepts.length,2);
assert.equal((await call('library','wrong_questions',{action:'detail',grade:3,...ref},1)).status,400);
assert.equal((await call('library','wrong_questions',{action:'detail',grade:3,...ref,version_id:randomUUID()})).status,400);
assert.equal((await call('library','wrong_questions',{action:'detail',grade:3,...ref,source_type:'quiz'})).status,400);
assert.equal((await list(2,{subject:'自然'})).data.total,1);assert.equal((await list(2,{subject:'數學'})).data.total,0);
const session=await call('practice','start',practice);assert.equal(session.status,200,JSON.stringify(session));assert.match(session.data.url,/wrong_source=past_exam/);assert.match(session.data.url,new RegExp('wrong_attempt='+started.attemptId));assert.equal((await call('practice','start',practice)).data.sessionId,session.data.sessionId);
const joined=await call('practice','quiz',{session_id:session.data.sessionId,quiz_action:'join'});assert.equal(joined.status,200);assert(joined.data.document.questions.every(q=>!q.answer));
const packet=JSON.parse(fs.readFileSync('automation/output/past-learning-publisher-mvp-20261101/publisher-practice.private.json','utf8'));
for(const q of packet.documents[practice.concept_id].document.blocks.flatMap(b=>b.questions)){
 const result=await call('practice','quiz',{session_id:session.data.sessionId,quiz_action:'submit',question_id:q.id,response:q.options.find(o=>o.id!==q.answer.option_id).id,request_id:randomUUID()});assert.equal(result.status,200);assert.equal(result.data.leaf?.earned,false);
}
assert.equal((await list()).data.total,1,'derivative practice wrongs do not duplicate original');
const after=(await call('rpc','resume',{attempt_id:started.attemptId})).data;assert.deepEqual(after.records,wrong.data.records);assert.deepEqual(after.summary,wrong.data.summary);
const correct=(await call('rpc','restart',{request_id:randomUUID()})).data;await call('rpc','view',{attempt_id:correct.attemptId,group_id:'s1-q01'});
await call('rpc','submit',{attempt_id:correct.attemptId,version:setup.version,group_id:'s1-q01',request_id:randomUUID(),responses:[{questionId:'s1-q01',value:'X'}]});
assert.equal((await list()).data.total,1);assert.equal((await call('practice','start',{...practice,attempt_id:correct.attemptId,request_id:randomUUID()})).status,400);
fs.writeFileSync('automation/output/past-wrong-entry-mvp-20261101/api-results.private.json',JSON.stringify({passed:true,sourceRef:ref,realLocalSql:true,crossStudentDenied:true,versionMismatchDenied:true,correctAndUnansweredExcluded:true,sourceUnchanged:true,noLeaves:true},null,2));
console.log('PASS local wrong-entry API, ownership, pinned source, correct/unanswered exclusion, source preservation');
