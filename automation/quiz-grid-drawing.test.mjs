import assert from 'node:assert/strict';
import test from 'node:test';
import {gridDrawingPlan} from '../shared/quiz-grid-drawing.mjs';
import {openSketchResponseError} from '../shared/quiz-open-sketch.mjs';
import {setupProductionQuizDB} from './fixtures/production-quiz-db.mjs';

const prompt = {text:'畫出下一個圖形。',media:[
  {kind:'image',url:'https://fixture.invalid/pattern.png',alt:'前幾個圖形'},
  {kind:'image',url:'https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/11f2179f2505423b1d1e6323e649f1ecd8465787d95c375dafbb837a3afaa5ca',alt:'原卷方格'},
]};
const question = {id:'hlg3m_00a1b6ad_grid_1',type:'open',fields:[{id:'drawing',input:'sketch',label:'畫下一個圖形'}],prompt};

test('the grid presentation requires a reviewed original and retains the pattern in the prompt', () => {
  const plan = gridDrawingPlan(question);
  assert.ok(plan);
  assert.deepEqual(plan.passage.media,[prompt.media[0]]);
  assert.equal(plan.xs.length,7);
  assert.equal(plan.ys.length,5);
  assert.equal(gridDrawingPlan({...question,id:'unrelated'}),null);
  assert.equal(gridDrawingPlan({...question,prompt:{...prompt,media:[...prompt.media.slice(0,1),{...prompt.media[1],url:prompt.media[0].url}]}}),null);
});

test('grid line segments persist as the existing sketch payload in the production snapshot', async () => {
  const plan = gridDrawingPlan(question);
  const point = (col,row)=>[plan.xs[col]/plan.width,plan.ys[row]/plan.height];
  const drawing = {version:1,strokes:[[point(1,1),point(2,2)],[point(2,2),point(3,2)]]};
  const raw = JSON.stringify({v:1,f:{drawing}});
  assert.equal(openSketchResponseError(question,raw),'');
  const {db} = await setupProductionQuizDB({snapshot:true});
  try {
    const {rows} = await db.query('select public.quiz_open_response($1::jsonb,$2::text) as value',[question,raw]);
    assert.deepEqual(rows[0].value,{drawing});
    const empty = JSON.stringify({v:1,f:{drawing:{version:1,strokes:[]}}});
    assert.ok(openSketchResponseError(question,empty));
    await assert.rejects(db.query('select public.quiz_open_response($1::jsonb,$2::text)',[question,empty]));
  } finally { await db.close(); }
});
