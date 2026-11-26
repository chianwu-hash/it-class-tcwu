import test from 'node:test';
import assert from 'node:assert/strict';
import {fractionBarPlan,fractionShadingPlan,fractionShadingResponse,readFractionShading}
  from '../shared/quiz-fraction-shading.mjs';
import {fieldsResponseError} from '../shared/quiz-fields.mjs';

const question={
  id:'hlg3m_019d47a1_fraction_bar_shade_1',type:'fields',
  work:{input:'sketch',label:'保存原圖塗色'},
  fields:[
    {id:'colored',input:'math',label:'塗色格數'},
    {id:'amount',input:'math',label:'已塗幾份'},
    {id:'rest',input:'math',label:'未塗幾條'},
  ],
  prompt:{text:'依原圖作答。',media:[{kind:'image',alt:'原圖',
    url:'https://quiz-media.invalid/owner/bf2cf3cc67f94045c5d2fd9f6e8eaa7639f311e19b39ee8ab37e4c473689fd78'}]},
};

test('the reviewed bar keeps a separate math field for the fraction and its count',()=>{
  const plan=fractionBarPlan(question);
  assert.equal(fractionShadingPlan(question),null);
  assert.equal(plan.regions.length,9);
  assert.deepEqual([...plan.integerIds],['amount']);
  const selection=new Set(['r1','r3','r4','r6','r9']);
  const base=fractionShadingResponse(plan,selection);
  const response={...base,f:{...base.f,amount:'5',rest:'8/18'}};
  assert.deepEqual(readFractionShading(plan,response),selection);
  assert.equal(fieldsResponseError(question,JSON.stringify(response)),'');
  assert.ok(fieldsResponseError(question,JSON.stringify({...response,f:{...response.f,rest:''}})));
  assert.ok(fieldsResponseError(question,JSON.stringify({...response,f:{...response.f,colored:'4'}})));
  assert.equal(fractionBarPlan({...question,fields:question.fields.slice(0,2)}),null);
});
