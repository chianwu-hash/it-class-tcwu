import test from 'node:test';import assert from 'node:assert/strict';
import {workAnswerPresentation,encodeWorkGroups,decodeWorkGroups} from '../../shared/quiz-work-answer-layout.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {workAnswerSources} from '../../shared/quiz-answer-template-sources.mjs';
import {workResponseError} from '../../shared/quiz-work-response.mjs';
const source=()=>({id:'synthetic-work-roles',type:'fields',prompt:{text:'依原題記錄兩項算式。',media:[]},fields:[{id:'n',label:'數量',input:'math'},{id:'r',label:'剩下',input:'math'}],work:{input:'expression',label:'兩項算式'}});
test('work layout opts into exact source and work roles without consulting answers',()=>{
 const q=source(),registry={[q.id]:{guard:presentationSignature(q),work:{...q.work},initialChars:4,groups:['乘法紀錄','除法算式']}};Object.defineProperty(q,'answer',{get(){throw Error('answer accessed')}});const before=JSON.stringify({prompt:q.prompt,fields:q.fields,work:q.work});assert.ok(workAnswerPresentation(q,registry));assert.equal(JSON.stringify({prompt:q.prompt,fields:q.fields,work:q.work}),before);
 for(const changed of [{...q,id:'another'},{...q,work:{input:'sketch',label:q.work.label}},{...q,work:{...q.work,label:'another work role'}},{...q,fields:[...q.fields].reverse()}])assert.equal(workAnswerPresentation(changed,registry),null);
 const p=registry[q.id];for(const patch of [{initialChars:1},{groups:['重複','重複']},{passageEnd:999}])assert.equal(workAnswerPresentation(q,{[q.id]:{...p,...patch}}),null);
});
test('separate manual work preserves arbitrary reasonable notation in one work-v1 value',()=>{
 const q=source();workAnswerSources[q.id]={guard:presentationSignature(q),work:{...q.work},initialChars:4,groups:['乘法紀錄','除法算式']};try{
  const parts=['6×5＝30；35－30＝5','35÷6＝5，餘5'],raw=encodeWorkGroups(parts);assert.deepEqual(decodeWorkGroups(raw,2),parts);assert.equal(workResponseError(q,raw),'');assert.notEqual(workResponseError(q,encodeWorkGroups([parts[0],''])),'');
  assert.equal(workResponseError(q,'35 ÷ 6 = 5 ... 5；另用乘法核對'), ''); // Existing plain work remains readable/editable.
  const long=workResponseError(q,encodeWorkGroups(['1'.repeat(120),'2'.repeat(120)]));assert.match(long,/合併後太長/);assert.ok(!long.includes('250'));
  for(const raw of ['not json','{"v":1,"parts":[1,2]}','{"v":1,"parts":["a","b"],"extra":true}'])assert.equal(decodeWorkGroups(raw,2),null);
  assert.throws(()=>encodeWorkGroups([1,2]));assert.throws(()=>encodeWorkGroups(['one']));
 }finally{delete workAnswerSources[q.id];}
});
