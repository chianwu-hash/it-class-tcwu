import test from 'node:test';import assert from 'node:assert/strict';
import {boxedContent,sourceBoxQuestion,sourceBoxReading} from '../../shared/quiz-source-boxes.mjs';
import {sourceStream} from '../../shared/quiz-content-slices.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {auditSourceBoxes} from '../audit-source-boxes.mjs';
const make=()=>({id:'synthetic-box',type:'fields',prompt:{text:'□中的詞語是什麼意思？\n（　）１甲乙的句子。\n（　）２丙丁的句子。',media:[]},fields:[1,2].map(n=>({id:'f'+n,label:'第'+n+'格',input:'single',options:[{id:'original-a',content:{text:'一種意思',media:[]}},{id:'original-b',content:{text:'另一種意思',media:[]}}]})),answer:{format:'fields-v1',fields:{f1:['original-a'],f2:['original-b']}}});
const plan=q=>({guard:presentationSignature(q),paired:true,ranges:['甲乙','丙丁'].map(t=>[q.prompt.text.indexOf(t),q.prompt.text.indexOf(t)+t.length])});
test('source boxes and sentence-choice adjacency retain original response identities and intended words',()=>{
 const q=make(),original=structuredClone(q),registry={[q.id]:[plan(q)]},view=sourceBoxQuestion(q,registry),reading=sourceBoxReading(view);
 assert.deepEqual(q,original);assert.equal(view.fields,q.fields);assert.equal(view.answer,q.answer);assert.equal(view.prompt.text,q.prompt.text);assert.equal(sourceBoxQuestion(view,registry),view);
 assert(reading.standalone);assert.equal(reading.questions.length,2);assert(reading.questions[0].text.includes('甲乙'));assert(!reading.questions[0].text.includes('丙丁'));assert.deepEqual(reading.questions.map(c=>c.layout[0].runs.filter(r=>r.boxed).map(r=>r.text)),[['甲乙'],['丙丁']]);assert.equal(reading.fields[0].options,q.fields[0].options);
});
test('text offsets across paragraphs and images remain lossless; invalid source ranges are rejected',()=>{
 const c={text:'甲乙\n丙丁',media:[{kind:'image',url:'https://example.invalid/original'}],layout:[{type:'paragraph',runs:[{type:'text',text:'甲乙'},{type:'image',media_index:0}]},{type:'paragraph',runs:[{type:'text',text:'丙丁'}]}]},view=boxedContent(c,[[4,6]]);
 assert.equal(sourceStream(view),sourceStream(c));assert.equal(view.media,c.media);assert.equal(view.layout[1].runs[0].boxed,true);assert.equal(view.layout[0].runs[1].media_index,0);assert.equal(boxedContent(c,[[0,100]]),null);assert.equal(boxedContent(c,[[2,4],[1,3]]),null);
});
test('unknown or changed sources do not acquire boxes or guessed answer meanings',()=>{
 const q=make(),registry={[q.id]:[plan(q)]};assert.equal(sourceBoxQuestion(q,{}),q);const changed={...q,prompt:{...q.prompt,text:q.prompt.text+'改版'}};assert.equal(sourceBoxQuestion(changed,registry),changed);assert.equal(sourceBoxReading(changed),null);
});
test('offline audit refuses ambiguous repeated source words and preserves the stored question',()=>{
 const q=make(),native=[{id:'source',sha256:'a'.repeat(64),type_code:'81',question:q.prompt.text,boxes:['甲乙','丙丁']}],pool=[{source_item_id:'source',question:q}],ok=auditSourceBoxes({native,pool});assert.equal(ok.report.registered,1);assert.deepEqual(ok.report.issues,[]);
 const bad=structuredClone(q);bad.prompt.text+='甲乙';assert.equal(auditSourceBoxes({native,pool:[{source_item_id:'source',question:bad}]}).report.registered,0);
});
