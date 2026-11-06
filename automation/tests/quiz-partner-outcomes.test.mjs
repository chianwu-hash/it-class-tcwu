import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAnswerDraft,unsentQuestions,taskOutcome,createAwardTracker} from '../../shared/partner-pilot/outcome-model.mjs';
const normal={id:1,options:['甲','乙'],attempts:[]};
const past=(kind,extra={})=>({...normal,past:{kind,...extra}});
test('未送出判斷：選項0、否、考古各題型與空白初始化',()=>{
 assert(hasAnswerDraft(normal,'0'));assert(!hasAnswerDraft(normal,''));assert(!hasAnswerDraft(normal,'2'));
 for(const [q,empty,filled] of [[past('short'),'""','"文字"'],[past('short',{answerFormat:'math-v1'}),'{"answer":"","working":""}','{"answer":"0","working":""}'],[past('sequence'),'[]','["A"]'],[past('set'),'[]','["甲"]'],[past('mark'),'null','false'],[past('manual'),'{"text":"","strokes":[],"confirmed":false}','{"text":"","strokes":[[[0,0],[1,1]]],"confirmed":false}']]){
  assert(!hasAnswerDraft(q,empty));assert(hasAnswerDraft(q,filled));
 }
 assert(!hasAnswerDraft(past('manual'),'{"text":"","strokes":[],"confirmed":true}'));
 assert(!hasAnswerDraft(past('single'),'broken'));
});
test('草稿只提醒本人有效版本；已送出不算未送，訂正另計且不更動資料',()=>{
 const mine=[normal,{...normal,id:2,attempts:[{correct:false}]}],drafts=new Map([['answer-1','0'],['answer-2','1']]),versions=new Map([[1,0],[2,1]]),editing=new Set();
 assert.deepEqual(unsentQuestions(mine,drafts,versions,editing).map(q=>q.id),[1]);editing.add(2);assert.equal(unsentQuestions(mine,drafts,versions,editing).length,2);
 versions.set(2,0);assert.equal(unsentQuestions(mine,drafts,versions,editing).length,1);assert.equal(drafts.get('answer-2'),'1');assert.equal(mine[1].attempts.length,1);
});
const room=()=>({id:'r',capacity:2,exercise:{mine:[{id:1,attempts:[{correct:false}]},{id:2,attempts:[{correct:true}]},{id:3,attempts:[{correct:null}]}],total:10,correct:5,reviewOpen:true,reviewers:[{},{}],finished:false,award:null}});
test('60%門檻、本人可訂正與自我核對題排除',()=>{
 const r=room();let o=taskOutcome(r);assert.equal(o.needed,1);assert.equal(o.eligible,false);assert.deepEqual(o.correctable.map(q=>q.id),[1]);assert(o.allReviewed);
 r.exercise.correct=6;assert(taskOutcome(r).eligible);r.exercise.gradedTotal=0;r.exercise.correct=0;assert(!taskOutcome(r).eligible);assert.equal(taskOutcome(r).needed,0);
 r.exercise.gradedTotal=55;r.exercise.correct=32;assert.equal(taskOutcome(r).needed,1);
});
test('只有同人同房無獎→server新獎才慶祝，舊紀念、去重、換房換人均不誤播',()=>{
 const t=createAwardTracker(),r=room(),me={id:'me'};assert.equal(t.update(r,me),null);
 const a={id:'award',earnedHere:true,leaves:2,flowers:0};r.exercise.finished=true;r.exercise.award=a;assert.equal(t.update(r,me),a);t.dismiss();assert.equal(t.update(r,me),null);
 t.clear();assert.equal(t.update(r,me),null);r.exercise.award=null;t.update(r,me);r.exercise.award=a;assert.equal(t.update(r,me),null);
 const second={...a,id:'flower',leaves:0,flowers:1};r.id='r2';r.exercise.award=null;t.update(r,me);r.exercise.award=second;assert.equal(t.update(r,me),second);
 assert.equal(t.update(r,{id:'peer'}),null);r.id='r3';r.exercise.award={...second,id:'old',earnedHere:false};assert.equal(t.update(r,me),null);
});
