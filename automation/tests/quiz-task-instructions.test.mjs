import test from 'node:test';import assert from 'node:assert/strict';
import {readingSignature} from '../../shared/quiz-reading-signature.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {taskInstructionPlan,taskQuestionPresentation,taskReadingSource,taskReadingPresentation} from '../../shared/quiz-task-instructions.mjs';
const q=()=>({id:'synthetic',type:'fields',prompt:{text:'原句的多餘字仍保留。',media:[]},fields:[{id:'original-field',label:'第1格',input:'text'}],answer:{fields:{'original-field':['synthetic-key']}}});
const project=(source,code,name)=>{const plan=taskInstructionPlan(source,code,name);return taskQuestionPresentation(source,{[source.id]:[{...plan,guard:presentationSignature(source)}]});};
test('personal and partner media namespaces share a display guard only for the same asset hash',()=>{
 const source=q(),hash='a'.repeat(64);source.prompt.media=[{kind:'image',url:'https://quiz-media.invalid/00000000-0000-0000-0000-000000000000/'+hash}];
 const before=structuredClone(source),partner=structuredClone(source);partner.prompt.media[0].url='https://partner-media.invalid/'+hash;
 assert.equal(presentationSignature(source),presentationSignature(partner));assert.deepEqual(source,before);
 partner.prompt.media[0].url='https://partner-media.invalid/'+'b'.repeat(64);assert.notEqual(presentationSignature(source),presentationSignature(partner));
 partner.prompt.media[0].url='https://foreign.invalid/'+hash;assert.notEqual(presentationSignature(source),presentationSignature(partner));
 assert.equal(project(source,'41','畫掉多餘的字').prompt.media[0].url,source.prompt.media[0].url);
});
test('redundant-word task asks what to enter without changing source sentence, key, input or saved IDs',()=>{
 const source=q(),before=structuredClone(source),view=project(source,'41','畫掉多餘的字');assert.deepEqual(source,before);assert.equal(view.fields[0].label,'多餘的字');assert(view.prompt.text.endsWith(source.prompt.text));assert.match(view.prompt.text,/多餘的字，填/u);assert.deepEqual(view.answer,source.answer);assert.deepEqual(view.fields.map(({label,...f})=>f),source.fields.map(({label,...f})=>f));assert.equal(taskQuestionPresentation(view),view);assert.equal(taskReadingSource(view),source);
});
test('open-task roles stay content-only, preserving useful labels and original self-review examples',()=>{
 const source={...q(),type:'open',prompt:{text:'先寫注音，再造詞：\n甲：（　）—（　）',media:[]},fields:[{id:'p',label:'第1格',input:'text'},{id:'w',label:'第2格：詞語',input:'text'}],answer:{format:'self-review-v1',fields:{p:{examples:['音'],criteria:['核對']},w:{examples:['詞'],criteria:['核對']}}}};
 const view=project(source,'17','造詞-先寫寫看再造詞');assert.equal(view.prompt,source.prompt);assert.equal(view.fields[1].label,source.fields[1].label);assert.match(view.fields[0].label,/先填國字或注音/u);assert.equal(view.answer,source.answer);
});
test('unknown types and generic metadata do not invent what a student should do',()=>{
 const source=q();assert.equal(taskInstructionPlan(source,'31','根據提示填寫答案'),null);assert.equal(taskQuestionPresentation(source,{}),source);
 const changed={...source,prompt:{text:'另一個版本',media:[]}},plan=taskInstructionPlan(source,'41','畫掉多餘的字');assert.equal(taskQuestionPresentation(changed,{[source.id]:[{...plan,guard:readingSignature(source)}]}),changed);
});
test('existing reviewed reading positions and images parse from source and are decorated afterward',()=>{
 const source=q();source.prompt={text:'國字注音-短文式\n原文',media:[{kind:'image',url:'https://example.invalid/old.png',alt:'圖'}],layout:[{type:'paragraph',runs:[{type:'text',text:'國字注音-短文式'}]},{type:'paragraph',runs:[{type:'text',text:'原文'},{type:'image',media_index:0}]}]};const view=project(source,'03','國字注音-短文式'),questions=[{text:'原小題',media:[]}],old={passage:source.prompt,questions,fields:source.fields,reviewKind:'picture-bank'};
 const shown=taskReadingPresentation(view,old);assert.equal(shown.questions,questions);assert.equal(shown.reviewKind,old.reviewKind);assert.deepEqual(shown.passage.media,source.prompt.media);assert(!shown.passage.text.includes('國字注音-短文式'));assert.deepEqual(shown.fields.map(f=>f.id),source.fields.map(f=>f.id));
});
test('explicit source instructions avoid duplication; word-chain and component tasks remain distinct',()=>{
 const source=q();source.prompt.text='請用指定詞語造句。';assert.equal(taskInstructionPlan(source,'71','造句').instruction,null);
 source.prompt.text='詞語接龍：甲乙↓（　）';assert.match(taskInstructionPlan(source,'31','根據提示填寫答案').instruction,/最後一個字/u);
 source.prompt.text='組合成一個字：甲＋乙';assert.equal(taskInstructionPlan(source,'31','根據提示填寫答案').instruction,null);
});
