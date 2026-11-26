import test from 'node:test';
import assert from 'node:assert/strict';
import {fractionRectangles} from '../shared/quiz-fraction-rectangles.mjs';
import {fractionRectPlan,fractionShadingResponse,readFractionShading} from '../shared/quiz-fraction-shading.mjs';
import {expectedResponse} from './lib/quiz-batch-plan.mjs';

const fixture=(key,sha)=>{
  const [source,n]=key.split('_');
  return {
    id:`hlg3m_${source}_fraction_rect_shade_${n}`,type:'fields',work:{input:'sketch',label:'保存原圖塗色'},
    prompt:{text:'依圖塗色。',media:[{kind:'image',alt:'原卷方格',url:'https://quiz-media.invalid/example/'+sha}]},
    fields:[{id:'colored',label:'塗色格數',input:'math'},
      ...(source==='001a16d8'?[]:[{id:'answer',label:'填分數',input:'math'}])],
  };
};

test('each measured rectangle binds its image and covers only its original cells',()=>{
  for(const [key,[sha,width,height,xs,ys]] of Object.entries(fractionRectangles)){
    const question=fixture(key,sha),plan=fractionRectPlan(question);
    assert.ok(plan,key);
    assert.equal(plan.regions.length,(xs.length-1)*(ys.length-1),key);
    assert.ok(xs.every((x,i)=>x>=0&&x<width&&(!i||x>xs[i-1])));
    assert.ok(ys.every((y,i)=>y>=0&&y<height&&(!i||y>ys[i-1])));
    assert.equal(fractionRectPlan(fixture(key,sha.slice(0,-1)+'z')),null);
  }
});

test('the fourth subquestion cannot bypass plan and exact shading checks',()=>{
  const key='0056748e_4', [sha]=fractionRectangles[key],question=fixture(key,sha),plan=fractionRectPlan(question);
  question.answer={format:'fields-v1',fields:{colored:['6'],answer:['6/12']}};
  const ids=new Set(plan.regions.slice(-6).map(region=>region.id));
  const reference=fractionShadingResponse(plan,ids);
  const response=expectedResponse(question,reference.w);
  assert.deepEqual(readFractionShading(plan,response),ids);
  assert.deepEqual(response.f,{colored:'6',answer:'6/12'});
  assert.throws(()=>expectedResponse({...fixture(key,sha+'z'),answer:question.answer},reference.w),/match the image/);
  const altered={version:1,strokes:[...reference.w.strokes].reverse()};
  assert.throws(()=>expectedResponse(question,altered),/match the image/);
});
