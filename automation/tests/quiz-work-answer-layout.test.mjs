import test from 'node:test';import assert from 'node:assert/strict';
import {workAnswerPresentation,encodeWorkGroups,decodeWorkGroups} from '../../shared/quiz-work-answer-layout.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {workAnswerSources,answerTemplateSources} from '../../shared/quiz-answer-template-sources.mjs';
import {workResponseError} from '../../shared/quiz-work-response.mjs';
import {deriveAnswerTemplate} from '../../shared/quiz-answer-templates.mjs';
import {fieldsPromptPresentation} from '../../shared/quiz-fields-presentation.mjs';
const source=()=>({id:'synthetic-work-roles',type:'fields',prompt:{text:'依原題記錄兩項算式。',media:[]},fields:[{id:'n',label:'數量',input:'math'},{id:'r',label:'剩下',input:'math'}],work:{input:'expression',label:'兩項算式'}});
test('work layout opts into exact source and work roles without consulting answers',()=>{
 const q=source(),registry={[q.id]:{guard:presentationSignature(q),work:{...q.work},initialChars:4,groups:['乘法紀錄','除法算式']}};Object.defineProperty(q,'answer',{get(){throw Error('answer accessed')}});const before=JSON.stringify({prompt:q.prompt,fields:q.fields,work:q.work});assert.ok(workAnswerPresentation(q,registry));assert.equal(JSON.stringify({prompt:q.prompt,fields:q.fields,work:q.work}),before);
 for(const changed of [{...q,id:'another'},{...q,work:{input:'sketch',label:q.work.label}},{...q,work:{...q.work,label:'another work role'}},{...q,fields:[...q.fields].reverse()}])assert.equal(workAnswerPresentation(changed,registry),null);
 const p=registry[q.id];for(const patch of [{initialChars:1},{groups:['重複','重複']},{passageEnd:999}])assert.equal(workAnswerPresentation(q,{[q.id]:{...p,...patch}}),null);
});
test('work preceding original blanks requires both reviewed registries and original heading',()=>{
 const q=source();q.prompt.text='完整情境。\n兩項算式：\n除法算式：（ ）÷（ ）';const p={guard:presentationSignature(q),work:{...q.work},initialChars:2,passageEnd:q.prompt.text.indexOf('兩項算式：'),workPosition:'before-template'},registry={[q.id]:p};
 assert.equal(workAnswerPresentation(q,registry),null);
 answerTemplateSources[q.id]={guard:presentationSignature(q),model:deriveAnswerTemplate(q)};
 try{
  assert.equal(workAnswerPresentation(q,registry),p);
  for(const patch of [{workPosition:'after-prompt'},{passageEnd:p.passageEnd+1},{groups:['第一步','第二步']}])assert.equal(workAnswerPresentation(q,{[q.id]:{...p,...patch}}),null);
  const model=answerTemplateSources[q.id].model;answerTemplateSources[q.id].model={mode:'blanks'};assert.equal(workAnswerPresentation(q,registry),null);answerTemplateSources[q.id].model=model;
  const gap={...q,prompt:{text:q.prompt.text.replace('\n除法算式','\n不可省略的情境。\n除法算式'),media:[]}},gapGuard=presentationSignature(gap);answerTemplateSources[q.id]={guard:gapGuard,model:deriveAnswerTemplate(gap)};assert.equal(workAnswerPresentation(gap,{[q.id]:{...p,guard:gapGuard}}),null);answerTemplateSources[q.id]={guard:presentationSignature(q),model};
  answerTemplateSources[q.id].guard='changed';assert.equal(workAnswerPresentation(q,registry),null);
 }finally{delete answerTemplateSources[q.id];}
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
test('an unrenderable work-first template keeps the complete original prompt',()=>{
 const q=source();q.prompt.text='完整情境。\n兩項算式：\n除法算式：（ ）÷（ ）';const guard=presentationSignature(q);workAnswerSources[q.id]={guard,work:{...q.work},initialChars:2,passageEnd:q.prompt.text.indexOf('兩項算式：'),workPosition:'before-template'};answerTemplateSources[q.id]={guard,model:{mode:'blanks'}};
 try{assert.equal(workAnswerPresentation(q),null);assert.equal(fieldsPromptPresentation(q).text,q.prompt.text);}finally{delete workAnswerSources[q.id];delete answerTemplateSources[q.id];}
});
test('source subquestions require contiguous complete text and unique field ownership without reading answers',()=>{
 const q=source();q.prompt={text:'共同情境。\n(1)第一個完整問題。\n(2)第二個完整問題。',media:[]};const start=q.prompt.text.indexOf('(1)'),second=q.prompt.text.indexOf('(2)'),plan={guard:presentationSignature(q),work:{...q.work},initialChars:2,groups:['第一題算式','第二題算式'],passageEnd:start,responseGroups:[{start,end:second,fields:['n']},{start:second,end:q.prompt.text.length,fields:['r']}]};Object.defineProperty(q,'answer',{get(){throw Error('hidden answer read')}});workAnswerSources[q.id]=plan;
 try{assert.equal(workAnswerPresentation(q),plan);assert.equal(fieldsPromptPresentation(q).text,'共同情境。');for(const groups of [[null,plan.responseGroups[1]],[{...plan.responseGroups[0],end:second-1},plan.responseGroups[1]],[plan.responseGroups[0],{...plan.responseGroups[1],fields:['n']}],[plan.responseGroups[0],{...plan.responseGroups[1],end:q.prompt.text.length-1}]]){workAnswerSources[q.id]={...plan,responseGroups:groups};assert.equal(workAnswerPresentation(q),null);assert.equal(fieldsPromptPresentation(q).text,q.prompt.text);}workAnswerSources[q.id]=plan;const altered={...q,prompt:{...q.prompt,text:q.prompt.text+'遺漏的末句。'}};assert.equal(workAnswerPresentation(altered),null);}finally{delete workAnswerSources[q.id];}
});
test('native table prefixes remain complete when subquestions use whole layout blocks',()=>{
 const q=source(),p=text=>({type:'paragraph',runs:[{type:'text',text}]});q.prompt={text:'共同表格。\n重量100公克\n(1)第一題。\n(2)第二題。',media:[],layout:[p('共同表格。'),{type:'table',rows:[[[{type:'text',text:'重量'}],[{type:'text',text:'100公克'}]]]},p('(1)第一題。'),p('(2)第二題。')]};const plan={guard:presentationSignature(q),work:{...q.work},initialChars:2,groups:['第一題算式','第二題算式'],groupUnit:'layout',passageEnd:2,responseGroups:[{start:2,end:3,fields:['n']},{start:3,end:4,fields:['r']}]};workAnswerSources[q.id]=plan;
 try{assert.equal(workAnswerPresentation(q),plan);assert.deepEqual(fieldsPromptPresentation(q).layout,q.prompt.layout.slice(0,2));for(const patch of [{groupUnit:'unknown'},{responseGroups:[plan.responseGroups[0],{start:3,end:5,fields:['r']}]},{responseGroups:[{start:1,end:3,fields:['n']},plan.responseGroups[1]]},{responseGroups:[{start:2,end:2,fields:['n']},plan.responseGroups[1]]},{responseGroups:[{start:2,end:3,fields:['n']},{start:3,end:4,fields:['n']}]},{responseGroups:[{start:2,end:3,fields:[]},plan.responseGroups[1]]}]){workAnswerSources[q.id]={...plan,...patch};assert.equal(workAnswerPresentation(q),null);assert.deepEqual(fieldsPromptPresentation(q),q.prompt);}
  const media={kind:'image',url:'https://example.invalid/a.png',alt:'圖'},variants=[{...q,prompt:{...q.prompt,media:[media]}},{...q,prompt:{...q.prompt,layout:[...q.prompt.layout.slice(0,3),{type:'paragraph',runs:[{type:'image',media_index:0}]}]}},{...q,prompt:{...q.prompt,layout:[q.prompt.layout[0],{type:'table',rows:[[[{type:'image',media_index:0}]]]},...q.prompt.layout.slice(2)]}},{...q,prompt:{...q.prompt,layout:[q.prompt.layout[0],{type:'unsupported'},...q.prompt.layout.slice(2)]}}];
  for(const changed of variants){workAnswerSources[q.id]={...plan,guard:presentationSignature(changed)};assert.equal(workAnswerPresentation(changed),null);assert.deepEqual(fieldsPromptPresentation(changed),changed.prompt);}
 }finally{delete workAnswerSources[q.id];}
});
test('work within printed equation groups requires exact template, source rows and work format',()=>{
 const q=source();q.prompt={text:'先列式，再寫兩小題直式。\n(1)第一題：（ ）÷（ ）\n(2)第二題：（ ）÷（ ）',media:[]};q.fields=Array.from({length:4},(_,i)=>({id:'f'+i,label:'('+ (i<2?1:2)+')原數字'+i,input:'math'}));q.work={input:'sketch',label:'兩小題直式'};const guard=presentationSignature(q),model=deriveAnswerTemplate(q,{grouped:true});assert.ok(model);
 const p={guard,work:q.work,initialChars:2,workPosition:'within-template',passageEnd:model.start,templateRows:[0,1],sketchGroups:['第一題直式','第二題直式']};workAnswerSources[q.id]=p;answerTemplateSources[q.id]={guard,model};
 try{Object.defineProperty(q,'answer',{get(){throw Error('answer read')}});assert.equal(workAnswerPresentation(q),p);for(const patch of [{templateRows:[0,0]},{templateRows:[0,2]},{sketchGroups:['重複','重複']},{sketchGroups:['一題']},{groups:['a','b']},{passageEnd:model.start+1},{workPosition:'unknown'}]){workAnswerSources[q.id]={...p,...patch};assert.equal(workAnswerPresentation(q),null);}workAnswerSources[q.id]=p;answerTemplateSources[q.id]={guard,model:{...model,start:model.start+1}};assert.equal(workAnswerPresentation(q),null);}finally{delete workAnswerSources[q.id];delete answerTemplateSources[q.id];}
});
test('a manual sheet precedes only its reviewed answer prefix in the same printed subquestion',()=>{
 const q=source();q.prompt={text:'先列式，再寫直式。\n(1)（ ）÷（ ）＝（ ）…（ ）\n答：（ ）段，剩（ ）公分\n(2)（ ）÷（ ）＝（ ）…（ ）\n答：（ ）段，剩（ ）公分',media:[]};q.fields=Array.from({length:12},(_,i)=>({id:'f'+i,label:'('+(i<6?1:2)+')數字'+i,input:'math'}));q.work={input:'sketch',label:'兩小題直式'};const guard=presentationSignature(q),model=deriveAnswerTemplate(q,{grouped:true}),p={guard,work:q.work,initialChars:2,workPosition:'within-template',passageEnd:model.start,templateRows:[0,1],sketchGroups:['第一題直式','第二題直式'],workBeforeFields:['f4','f10']};workAnswerSources[q.id]=p;answerTemplateSources[q.id]={guard,model};
 try{Object.defineProperty(q,'answer',{get(){throw Error('answer read')}});assert.equal(workAnswerPresentation(q),p);for(const fields of [['f0','f10'],['f10','f4'],['f4','f4'],['missing','f10'],['f4']]){workAnswerSources[q.id]={...p,workBeforeFields:fields};assert.equal(workAnswerPresentation(q),null);}}finally{delete workAnswerSources[q.id];delete answerTemplateSources[q.id];}
});
