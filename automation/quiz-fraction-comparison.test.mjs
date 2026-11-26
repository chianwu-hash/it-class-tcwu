import test from 'node:test';
import assert from 'node:assert/strict';
import {fractionComparisonPlan,fractionComparisonResponse,readFractionComparison}
  from '../shared/quiz-fraction-comparison.mjs';
import {fieldsResponseError,fieldsPromptPresentation} from '../shared/quiz-fields.mjs';
import {validateSketch} from '../shared/sketch/contract.mjs';

const q = {
  id:'hlg3m_02ce3c4c_fraction_compare_v1',
  type:'fields',
  prompt:{text:'先塗色，再比較分數。',media:[{kind:'image',alt:'原卷分數板',
    url:'https://quiz-media.invalid/owner/90b15937716b01d6a79d25c2c59a502993f70fb0a4d33aac3241d9c16de7c43f'}]},
  fields:[{id:'left',label:'左圖塗色格數',input:'math'},{id:'right',label:'右圖塗色格數',input:'math'},
    {id:'comparison',label:'比較符號',input:'single',options:[
      {id:'less',content:{text:'＜',media:[]}},{id:'greater',content:{text:'＞',media:[]}},
    ]}],
  work:{input:'sketch',label:'保存原圖塗色'},
};
const plan = fractionComparisonPlan(q);
const masks = (size,count) => Array.from({length:2**size},(_,bits)=>
  Array.from({length:size},(_,i)=>bits&(1<<i)?i+1:0).filter(Boolean)).filter(ids=>ids.length===count);

test('all 5,400 correct selections in the ten-part source use the same native counts',()=>{
  assert.equal(plan.parts,10);
  const encoding=new Set();
  for(const left of masks(10,7))for(const right of masks(10,8)){
    const ids=new Set([...left.map(n=>'l'+n),...right.map(n=>'r'+n)]);
    const response=fractionComparisonResponse(plan,ids,'less');
    assert.deepEqual(response.f,{left:'7',right:'8',comparison:'less'});
    assert.deepEqual(readFractionComparison(plan,response),ids);
    assert.equal(fieldsResponseError(q,JSON.stringify(response)),'');
    encoding.add(JSON.stringify(response.w));
  }
  assert.equal(encoding.size,5400);
  const all=fractionComparisonResponse(plan,new Set(plan.regions.map(region=>region.id)),'greater');
  assert.equal(validateSketch(all.w).strokes.length,20);
  assert.equal(fieldsResponseError(q,JSON.stringify(all)),'');
});

test('missing, changed, duplicate, or inconsistent sector data cannot pass browser validation',()=>{
  const correct=fractionComparisonResponse(plan,new Set(['l2','r10']),'less');
  for(const alter of [
    value=>{value.w.strokes[0][0][0]+=.001;},
    value=>{value.w.strokes.push(value.w.strokes[0]);},
    value=>{value.w.strokes.reverse();},
    value=>{value.w.colors=['#185e60','#185e60'];},
    value=>{value.f.left='7';},
  ]){
    const bad=structuredClone(correct); alter(bad);
    assert.equal(readFractionComparison(plan,bad),null);
    assert.ok(fieldsResponseError(q,JSON.stringify(bad)));
  }
  const half=fractionComparisonResponse(plan,new Set(['r10']),'less');
  assert.ok(fieldsResponseError(q,JSON.stringify(half)));
  const absent=fractionComparisonResponse(plan,new Set(['l1','r10']),'');
  assert.ok(fieldsResponseError(q,JSON.stringify(absent)));
});

test('only the original image and comparison controls receive the board presentation',()=>{
  assert.deepEqual(fieldsPromptPresentation(q),q.prompt);
  assert.deepEqual(fieldsPromptPresentation(q,{showGroupingBoard:true}),{text:q.prompt.text,media:[]});
  assert.equal(fractionComparisonPlan({...q,id:'unrelated'}),null);
  const altered=structuredClone(q);
  altered.prompt.media[0].url+='0';
  assert.equal(fractionComparisonPlan(altered),null);
});
