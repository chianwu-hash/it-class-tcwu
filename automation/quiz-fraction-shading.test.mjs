import test from 'node:test';
import assert from 'node:assert/strict';
import {fractionShadingPlan,fractionShadingResponse,readFractionShading} from '../shared/quiz-fraction-shading.mjs';
import {fieldsPromptPresentation,fieldsResponseError} from '../shared/quiz-fields.mjs';

const question={
  id:'hlg3m_03c530a5_fraction_shade_2',type:'fields',work:{input:'sketch',label:'保存原圖塗色'},
  fields:[{id:'colored',input:'math',label:'塗色格數'}],
  prompt:{text:'把豆腐塗上顏色。',media:[{kind:'image',alt:'原卷豆腐',
    url:'https://quiz-media.invalid/owner/98b1fe3362435b13909ec0edaec2c8bfa6110680240cb66b1299b3b85850276e'}]},
};
const plan=fractionShadingPlan(question);

test('all 792 ways to shade five cells of twelve preserve their selected positions and score value',()=>{
  let cases=0;
  for(let bits=0;bits<2**plan.regions.length;bits++){
    const selected=new Set(plan.regions.filter((_,i)=>bits&(1<<i)).map(region=>region.id));
    if(selected.size!==5)continue;
    const answer=fractionShadingResponse(plan,selected);
    assert.equal(answer.f.colored,'5');
    assert.deepEqual(readFractionShading(plan,answer),selected);
    assert.equal(fieldsResponseError(question,JSON.stringify(answer)),'');
    cases++;
  }
  assert.equal(cases,792);
});

test('the original image is projected once and a corrupt count or position is rejected',()=>{
  assert.deepEqual(fieldsPromptPresentation(question),question.prompt);
  assert.deepEqual(fieldsPromptPresentation(question,{showGroupingBoard:true}),{text:question.prompt.text,media:[]});
  const unknown=structuredClone(question);unknown.prompt.media[0].url+='0';
  assert.equal(fractionShadingPlan(unknown),null);
  const a=fractionShadingResponse(plan,new Set(['r2','r5']));
  a.f.colored='3';
  assert.equal(readFractionShading(plan,a),null);
  assert.ok(fieldsResponseError(question,JSON.stringify(a)));
  a.f.colored='2';a.w.strokes.reverse();
  assert.equal(readFractionShading(plan,a),null);
});
