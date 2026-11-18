import test from 'node:test';
import assert from 'node:assert/strict';
import {readingSignature} from '../../shared/quiz-reading-signature.mjs';
import {sourceStream} from '../../shared/quiz-content-slices.mjs';
import {correctionQuestionPresentation,pastCorrectionPrompt,pastCorrectionFieldLabel} from '../../shared/quiz-correction-presentation.mjs';
import {auditCorrectionInstructions} from '../audit-correction-instructions.mjs';

const make=()=>({id:'synthetic-correction',type:'fields',prompt:{text:'（　）（　）甲句錯字與乙句錯字。',media:[]},fields:[{id:'original-a',label:'第1格',input:'text'},{id:'original-b',label:'第2格',input:'text'}],answer:{format:'fields-v1',fields:{'original-a':['甲'],'original-b':['乙']}}});
const registry=q=>({[q.id]:[{guard:readingSignature(q),sourceSha256:'a'.repeat(64)}]});
test('source-reviewed projection states task, output and order without rewriting intended errors or response contract',()=>{
 const q=make(),saved=structuredClone(q),view=correctionQuestionPresentation(q,registry(q));assert.deepEqual(q,saved);
 assert.match(view.prompt.text,/2 個錯字，依出現順序填入正確的字/u);assert(view.prompt.text.endsWith(q.prompt.text));assert.deepEqual(view.fields.map(f=>f.label),['第1個正確的字','第2個正確的字']);
 assert.deepEqual(view.answer,q.answer);assert.deepEqual(view.fields.map(({label,...rest})=>rest),q.fields.map(({label,...rest})=>rest));assert.equal(correctionQuestionPresentation(view,registry(q)),view);
});
test('unreviewed IDs, changed content, ordinary fill blanks and unknown field shapes stay untouched',()=>{
 const q=make(),r=registry(q);assert.equal(correctionQuestionPresentation(q,{}),q);
 const changed={...q,prompt:{text:'另一題',media:[]}};assert.equal(correctionQuestionPresentation(changed,r),changed);
 const field={...q,fields:[{id:'original-a',input:'single',options:[]}]};assert.equal(correctionQuestionPresentation(field,registry(field)),field);
});
test('single-character correction has a useful caption and rich prompt media stays in its original order',()=>{
 const q=make();q.fields=q.fields.slice(0,1);q.prompt={text:'改錯字\n原句',media:[{kind:'image',url:'https://example.invalid/original.png',alt:'原圖'}],layout:[{type:'paragraph',runs:[{type:'text',text:'改錯字'}]},{type:'paragraph',runs:[{type:'text',text:'原句'},{type:'image',media_index:0}]}]};
 const view=correctionQuestionPresentation(q,registry(q));assert.equal(view.fields[0].label,'正確的字');assert.deepEqual(view.prompt.media,q.prompt.media);assert.equal(sourceStream(view.prompt).split('\ufffc').length,2);assert(!view.prompt.text.includes('改錯字\n'));
});
test('audit refuses key-order/count guesses and records only verified immutable identities',()=>{
 const q=make(),native=[{id:'source',type_code:'06',type_name:'改錯字',sha256:'a'.repeat(64),key:'《答案》甲，乙'}],pool=[{source_item_id:'source',question:q}];
 assert.equal(auditCorrectionInstructions({pool,native}).report.issues.length,0);
 const wrong=structuredClone(q);wrong.answer.fields['original-a']=['乙'];assert.equal(auditCorrectionInstructions({pool:[{source_item_id:'source',question:wrong}],native}).report.registered,0);
});
test('past correction preserves meaningful paragraph targets, avoids duplicate clear instructions and excludes word-meaning/choice questions',()=>{
 const g={kind:'short',title:'二、改錯字',material:'請依序填入正確的字。',fields:[{id:'old-1',text:'第1格'},{id:'old-2',text:'第2段正確字第1格'}]};
 assert.equal(pastCorrectionPrompt(g),null);assert.equal(pastCorrectionFieldLabel(g,g.fields[0],0),'第1個正確的字');assert.match(pastCorrectionFieldLabel(g,g.fields[1],1),/^第2段/u);
 assert(pastCorrectionPrompt({...g,material:'二、改錯字（每格1分）'}));
 for(const other of [{...g,kind:'single'},{...g,title:'詞語意思：改正錯誤'}]){assert.equal(pastCorrectionPrompt(other),null);assert.equal(pastCorrectionFieldLabel(other,other.fields[0],0),null);}
});
