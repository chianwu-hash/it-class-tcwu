import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveImageBlankTemplate} from '../../shared/quiz-image-blanks.mjs';
import {answerTemplatePresentation} from '../../shared/quiz-answer-templates.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';

const fixture=()=>({id:'image-blank',type:'fields',prompt:{text:'填代號：ㄅ、ㄆ。',media:[{kind:'image',url:'https://example.invalid/balance.png'},{kind:'image',url:'https://example.invalid/blanks.png'}],layout:[{type:'paragraph',runs:[{type:'text',text:'填代號：ㄅ、ㄆ。'}]},{type:'paragraph',runs:[{type:'image',media_index:0}]},{type:'paragraph',runs:[{type:'image',media_index:1}]}]},fields:['左','右'].map((label,i)=>({id:'f'+i,label,input:'text'}))});
const options=()=>({media_index:1,sourceSize:[1000,500],width:800,blanks:[{field:'f0',rect:[100,100,100,60]},{field:'f1',rect:[600,100,100,60]}],bank:['ㄅ','ㄆ']});
test('image input projection keeps complete reference image, native IDs and private answers unread',()=>{
 const q=fixture(),before=JSON.stringify(q),model=deriveImageBlankTemplate(q,options());assert.ok(model);assert.equal(JSON.stringify(q),before);
 Object.defineProperty(q,'answer',{get(){throw Error('private answer read');}});
 const registry={[q.id]:{guard:presentationSignature(q),model}},plan=answerTemplatePresentation(q,registry);
 assert.ok(plan);assert.equal(plan.passage.media.length,1);assert.equal(plan.passage.media[0].url,q.prompt.media[0].url);assert.equal(plan.passage.text,q.prompt.text);
 q.fields[0].label='changed';assert.equal(answerTemplatePresentation(q,registry),null);
});
test('unreviewed choices, overlapping/out-of-image geometry, tiny targets and incomplete field maps fail closed',()=>{
 for(const mutate of [o=>o.bank.push('invented'),o=>o.bank.push('ㄅ'),o=>o.blanks[1].rect=[110,100,100,60],o=>o.blanks[0].rect[2]=1100,o=>o.blanks[0].rect[3]=20,o=>o.blanks.reverse(),o=>o.blanks.pop(),o=>o.media_index=7,o=>o.width=0]){
  const o=options();mutate(o);assert.equal(deriveImageBlankTemplate(fixture(),o),null);
 }
 const q=fixture();q.fields[0].input='single';assert.equal(deriveImageBlankTemplate(q,options()),null);
 const duplicate=fixture();duplicate.fields[1].id=duplicate.fields[0].id;assert.equal(deriveImageBlankTemplate(duplicate,options()),null);
});

test('numeric image blanks keep native math fields and use no text bank',()=>{
 const q=fixture();q.fields.forEach(f=>{f.input='math';});
 const spec=options();delete spec.bank;spec.numeric=true;
 const model=deriveImageBlankTemplate(q,spec);
 assert.equal(model.numeric,true);
 assert.equal(Object.hasOwn(model,'bank'),false);
 assert.ok(answerTemplatePresentation(q,{[q.id]:{guard:presentationSignature(q),model}}));
 assert.equal(deriveImageBlankTemplate(q,{...spec,bank:['ㄅ']}),null);
 assert.equal(deriveImageBlankTemplate(q,{...spec,numeric:false}),null);
 q.fields[0].input='text';
 assert.equal(deriveImageBlankTemplate(q,spec),null);
});
