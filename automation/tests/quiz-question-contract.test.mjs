import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalizeQuestion,canonicalSingleResponse,originalSingleResponse} from '../../shared/quiz-question-contract.mjs';
const c=text=>({text,media:[]});
const fixture=()=>({id:'synthetic',type:'fields',prompt:c('選出錯誤敘述。'),fields:[{id:'answer1',input:'single',label:'答案',options:[{id:'x',content:c('甲')},{id:'y',content:c('乙')}]}],answer:{format:'fields-v1',fields:{answer1:['y']}},explanation:c('原因')});

test('legacy circled IDs map reversibly into schema-valid new option IDs',()=>{
 const q=fixture();q.fields[0].options[0].id='①';q.fields[0].options[1].id='②';q.answer.fields.answer1=['②'];
 const r=canonicalizeQuestion(q);assert.deepEqual(r.question.options.map(o=>o.id),['c1','c2']);assert.equal(r.question.answer.option_id,'c2');
 assert.equal(canonicalSingleResponse('{"v":1,"f":{"answer1":"②"}}',r.mapping),'c2');assert.equal(JSON.parse(originalSingleResponse('c2',r.mapping)).f.answer1,'②');assert.equal(q.fields[0].options[1].id,'②');
});
test('one real choice becomes single while all option IDs, media and grading mappings survive',()=>{const q=fixture(),before=structuredClone(q);q.fields[0].options[0].content.media=[{kind:'image',url:'https://example.invalid/a',alt:'圖'}];const r=canonicalizeQuestion(q);assert.equal(r.question.type,'single');assert.deepEqual(r.question.answer,{option_id:'y'});assert.deepEqual(r.question.options,q.fields[0].options);for(const v of ['x','y'])assert.equal(canonicalSingleResponse(originalSingleResponse(v,r.mapping),r.mapping),v);assert.equal(q.type,before.type);assert.deepEqual(q.answer,before.answer);assert.equal(canonicalizeQuestion(r.question).mapping,null);assert.throws(()=>canonicalSingleResponse('{"v":1,"f":{"answer1":"y","extra":"x"}}',r.mapping));});
test('keep a meaningful field question, real multi-field groups, checkboxes, sequence, math and open references',()=>{const q=fixture();q.fields[0].label='依文章選出作者的主要看法';assert.match(canonicalizeQuestion(q).question.prompt.text,/作者的主要看法/);for(const input of ['set','sequence','math','text']){const x=fixture();x.fields[0].input=input;assert.equal(canonicalizeQuestion(x).mapping,null);}const multi=fixture();multi.fields.push({...multi.fields[0],id:'second'});assert.equal(canonicalizeQuestion(multi).mapping,null);const open={...fixture(),type:'open'};assert.equal(canonicalizeQuestion(open).mapping,null);const alternatives=fixture();alternatives.answer.fields.answer1=['x','y'];assert.equal(canonicalizeQuestion(alternatives).retained_reason,'multiple_accepted_choices');});
