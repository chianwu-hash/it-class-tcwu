import test from 'node:test';
import assert from 'node:assert/strict';
import {groupingDrawingPlan} from '../shared/quiz-grouping-drawing.mjs';
import {fieldsPromptPresentation} from '../shared/quiz-fields-presentation.mjs';

test('only the reviewed grouping item projects its original into the work area', () => {
  const image = {
    kind: 'image', alt: '原卷分組圖',
    url: 'https://quiz-media.invalid/owner/ef26594fe0d9766a77fc6a983dc6cc93d5676154b2008dfb05246c9c28e03364',
  };
  const q = {
    id: 'hlg3m_00ce7fd0_grouping_v1', type: 'fields', work: {input:'sketch',label:'在原圖圈一圈'},
    prompt: {text:'依題意圈畫，再填兩格。',media:[image]},
    fields: [{input:'math',id:'first'},{input:'math',id:'second'}],
  };
  const plan = groupingDrawingPlan(q);
  assert.deepEqual([plan.width,plan.height],[343,344]);
  assert.deepEqual(plan.image,image);
  assert.deepEqual(fieldsPromptPresentation(q),q.prompt);
  assert.deepEqual(fieldsPromptPresentation(q,{showGroupingBoard:true}),{text:q.prompt.text,media:[]});

  const mismatch = {...q,prompt:{...q.prompt,media:[{...image,url:image.url.slice(0,-1)+'0'}]}};
  assert.equal(groupingDrawingPlan(mismatch),null);
  assert.deepEqual(fieldsPromptPresentation(mismatch,{showGroupingBoard:true}),mismatch.prompt);
  assert.equal(groupingDrawingPlan({...q,work:{input:'expression'}}),null);
  assert.equal(groupingDrawingPlan({...q,id:'hlg3m_01220388_grouping_v1'}),null);
});
