import assert from 'node:assert/strict';
import test from 'node:test';
import {fieldsPromptPresentation} from '../../shared/quiz-fields-presentation.mjs';
import {openResponseError} from '../../shared/quiz-open-response.mjs';
import {readWindArrow,windDrawingPlan} from '../../shared/quiz-wind-drawing.mjs';

const compass='04eb9a1a74bd0d125b4beb9eabec4757fe36f682e85fd51a64f8142af1be737e';
const tree='86a9c801fbb1191e61b9d5e71d83db4770b44e77aaca0d4a2edfca3f08e697d5';
const image=sha=>({kind:'image',url:`https://quiz-media.invalid/test/${sha}`,alt:'測試圖'});
const question={id:'hlg3n_01234567_wind_1_v0123456789ab',type:'open',
  prompt:{text:'請畫出風向。',media:[image(compass)]},fields:[{id:'drawing',input:'sketch',label:'畫風向'}]};

test('Only reviewed wind drawings use a board and the original prompt keeps any observation image',()=>{
  assert.equal(windDrawingPlan(question).points.length,9);
  assert.equal(windDrawingPlan({...question,prompt:{...question.prompt,media:[image(tree)]}}).points.length,4);
  const observation={...question,prompt:{...question.prompt,media:[image('observation'),image(compass)]},
    fields:[...question.fields,{id:'direction',input:'text',label:'寫風向'}]};
  assert.deepEqual(fieldsPromptPresentation(observation),{text:question.prompt.text,media:[image('observation')]});
  assert.equal(windDrawingPlan({...question,id:'ordinary-open'}),null);
  assert.equal(windDrawingPlan({...question,prompt:{...question.prompt,media:[image('__proto__')]}}),null);
  assert.equal(windDrawingPlan({...question,fields:[null]}),null);
});

test('A single directional stroke round-trips through the existing open response with written direction',()=>{
  const start=windDrawingPlan(question).points.find(p=>p.label==='東北');
  const end=windDrawingPlan(question).points.find(p=>p.label==='中央');
  const plan=windDrawingPlan(question);
  const drawing={version:1,strokes:[[start.value,end.value]]};
  const reverse={version:1,strokes:[[end.value,start.value]]};
  assert.deepEqual(readWindArrow(drawing,plan).map(p=>p.label),['東北','中央']);
  assert.deepEqual(readWindArrow(reverse,plan).map(p=>p.label),['中央','東北']);
  assert.equal(readWindArrow({version:1,strokes:[[start.value,start.value]]},plan),null);
  assert.equal(readWindArrow({version:1,strokes:[[start.value,[0.1,0.1]]]},plan),null);
  assert.equal(readWindArrow({version:1,strokes:{0:'x',length:1}},plan),null);
  const mixed={...question,fields:[...question.fields,{id:'direction',input:'text',label:'寫風向'}]};
  assert.equal(openResponseError(mixed,JSON.stringify({v:1,f:{drawing,direction:'東北'}})),'');
  assert.notEqual(openResponseError(mixed,JSON.stringify({v:1,f:{drawing}})),'');
});
