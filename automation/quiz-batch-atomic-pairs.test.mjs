import test from 'node:test';import assert from 'node:assert/strict';
import {reverseAtomicPair,atomicPairCases} from './lib/quiz-batch-atomic-pairs.mjs';
import {expectedResponse} from './lib/quiz-batch-plan.mjs';
const fixture=()=>({id:'source_pair',type:'fields',prompt:{text:'起站到迄站',media:[]},fields:[{id:'from',label:'起站',input:'text'},{id:'to',label:'迄站',input:'text'}],answer:{format:'fields-v1',fields:{from:['甲站'],to:['乙站']}}});
test('overlapping tuples test only complete valid replacements and reject conflicting defaults',()=>{
 const ids=['a','b','c'],domains=['1','3','5'],source=fixture();
 source.fields=ids.map(id=>({id,label:id,input:'math'}));
 const correct={a:'1',b:'3',c:'5'};
 source.answer.fields=Object.fromEntries(ids.map(id=>[id,domains]));
 source.answer.tuples=[['a','b'],['a','c'],['b','c']].map(([x,y])=>{
  const first={[x]:correct[x],[y]:correct[y]};
  const other=domains.flatMap(a=>domains.filter(b=>a!==b&&(a!==first[x]||b!==first[y])).map(b=>({[x]:a,[y]:b})));
  return {fields:[x,y],accepted:[first,...other]};
 });
 const response=expectedResponse(source),cases=atomicPairCases(source,response);
 assert.deepEqual(response.f,correct);
 assert.equal(cases.correct.length,3);
 assert.ok(cases.correct.every(c=>new Set(Object.values(c.f)).size===3));
 assert.ok(cases.incorrect.every(c=>new Set(Object.values(c.f)).size<3));
 source.answer.tuples[2].accepted.reverse();
 assert.throws(()=>expectedResponse(source),/Overlapping tuple defaults disagree/u);
});
test('可互換的兩空保留整組配對，不接受各取一半',()=>{const source=fixture(),q=reverseAtomicPair(source,['from','to']);assert.deepEqual(source.answer.fields,{from:['甲站'],to:['乙站']});assert.equal(q.answer.fields.from[0],'甲站');assert.equal(q.answer.fields.to[0],'乙站');assert.notEqual(q.id,source.id);const response=expectedResponse(q),cases=atomicPairCases(q,response);assert.deepEqual(response.f,{from:'甲站',to:'乙站'});assert.deepEqual(cases.correct.map(c=>c.f),[{from:'乙站',to:'甲站'}]);assert.deepEqual(new Set(cases.incorrect.map(c=>JSON.stringify(c.f))),new Set([JSON.stringify({from:'甲站',to:'甲站'}),JSON.stringify({from:'乙站',to:'乙站'})]));});
test('不能把相同值、不同輸入型別或已耦合欄位再任意互換',()=>{for(const change of [q=>q.answer.fields.to=['甲站'],q=>q.fields[1].input='math',q=>q.answer.tuples=[{fields:['from','to'],accepted:[{from:'甲站',to:'乙站'}]}]]){const q=fixture();change(q);assert.throws(()=>reverseAtomicPair(q,['from','to']));}});

test('站名單選兩空仍按完整組判分，同選項原序且禁止不同選項域',()=>{const q=fixture();for(const f of q.fields){f.input='single';f.options=[{id:'o1',content:{text:'甲站',media:[]}},{id:'o2',content:{text:'乙站',media:[]}}];}q.answer.fields={from:['o1'],to:['o2']};const built=reverseAtomicPair(q,['from','to']),cases=atomicPairCases(built,expectedResponse(built));assert.equal(cases.correct.length,1);assert.equal(cases.incorrect.length,2);q.fields[1].options.reverse();assert.throws(()=>reverseAtomicPair(q,['from','to']));});
test('可互換的兩組集合保留完整配對，集合內反序等值但不可兩人拿同一組',()=>{const q=fixture();for(const f of q.fields){f.input='set';f.options=['a','b','c','d'].map(id=>({id,content:{text:id,media:[]}}));}q.answer.fields={from:[['a','b']],to:[['c','d']]};const built=reverseAtomicPair(q,['from','to']),cases=atomicPairCases(built,expectedResponse(built));assert.deepEqual(cases.correct.map(c=>c.f),[{from:['c','d'],to:['a','b']}]);assert.equal(cases.incorrect.length,2);assert.ok(cases.incorrect.every(c=>JSON.stringify(c.f.from)===JSON.stringify(c.f.to)));const reversed=structuredClone(built);for(const t of reversed.answer.tuples)for(const a of t.accepted)for(const id of t.fields)a[id].reverse();assert.equal(atomicPairCases(reversed,expectedResponse(reversed)).incorrect.length,2);const frozen=JSON.stringify(built);cases.correct[0].f.from.reverse();cases.incorrect[0].f.from.push('c');assert.equal(JSON.stringify(built),frozen);assert.deepEqual(q.answer.fields,{from:[['a','b']],to:[['c','d']]});});
test('集合交換拒絕相同集合、重複項、未知項及不同原序選項域',()=>{const q=fixture();for(const f of q.fields){f.input='set';f.options=['a','b','c'].map(id=>({id,content:{text:id,media:[]}}));}q.answer.fields={from:[['a','b']],to:[['c']]};for(const change of [q=>q.answer.fields.to=[['b','a']],q=>q.answer.fields.to=[['c','c']],q=>q.answer.fields.to=[['z']],q=>q.fields[1].options.reverse()]){const bad=structuredClone(q);change(bad);assert.throws(()=>reverseAtomicPair(bad,['from','to']));}});
