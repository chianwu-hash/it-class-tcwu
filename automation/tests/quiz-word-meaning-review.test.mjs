import test from 'node:test';import assert from 'node:assert/strict';
import {wordMeaningReview} from '../../shared/quiz-word-meaning-review.mjs';
import {deriveAnswerTemplate} from '../../shared/quiz-answer-templates.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {answerFeedback} from '../../shared/partner-pilot/answer-feedback.mjs';
function fixture(character='頂',pair=true){const q={id:'synthetic-word-meaning',type:'open',prompt:{text:'造詞-造詞\n'+character+'：（　）'+(pair?'、（　）':''),media:[]},fields:Array.from({length:pair?2:1},(_,i)=>({id:'original-'+i,input:'text',label:'第'+i+'格'}))},answer={format:'self-review-v1',fields:Object.fromEntries(q.fields.map(f=>[f.id,{examples:['原例答'],criteria:['原檢核']}]))},templateRegistry={[q.id]:{guard:presentationSignature(q),model:deriveAnswerTemplate(q)}};return{q,answer,templateRegistry};}
test('one source target has one concise meaning card and several examples, regardless of one or two original fields',()=>{
 for(const pair of [false,true]){const {q,answer,templateRegistry}=fixture('頂',pair),before=JSON.stringify({q,answer}),m=wordMeaningReview(q,answer,{templateRegistry});assert.equal(m.cards.length,1);assert.equal(m.cards[0].character,'頂');assert(m.cards[0].meaning.includes('代替'));assert.deepEqual(m.cards[0].examples,['頭頂','屋頂','山頂','頂尖','頂替','頂班']);assert.deepEqual(m.cards[0].fields,q.fields.map(f=>f.id));assert.equal(JSON.stringify({q,answer}),before);}
});
test('a source word remains whole rather than turning 劈啪 into 啪',()=>{const {q,answer,templateRegistry}=fixture('劈啪'),m=wordMeaningReview(q,answer,{templateRegistry});assert.equal(m.cards[0].character,'劈啪');assert(m.cards[0].examples.every(e=>e.includes('劈啪')));});
test('no authorized reference, missing fields, changed source or field order retains original fallback',()=>{
 const {q,answer,templateRegistry}=fixture();assert.equal(wordMeaningReview({...q,answer},undefined,{templateRegistry}),null);assert.equal(wordMeaningReview(q,{format:'self-review-v1',fields:{}},{templateRegistry}),null);assert.equal(wordMeaningReview({...q,prompt:{...q.prompt,text:q.prompt.text+'改'}},answer,{templateRegistry}),null);assert.equal(wordMeaningReview({...q,fields:q.fields.toReversed()},answer,{templateRegistry}),null);assert.equal(wordMeaningReview(q,answer),null);assert.equal(wordMeaningReview(undefined,undefined),null);
});
test('unknown target, missing guide, images and compound tasks do not drop the original explanation',()=>{
 for(const text of ['先寫注音，再造詞：\n頂：（　）—（　）','先寫部首，再造詞：\n頂：（　）部—（　）','照樣造句：\n（　）越來越（　）']){const {q,answer}=fixture();q.prompt.text=text;const templateRegistry={[q.id]:{guard:presentationSignature(q),model:deriveAnswerTemplate(q)}};assert.equal(wordMeaningReview(q,answer,{templateRegistry}),null);}
 const {q,answer,templateRegistry}=fixture();assert.equal(wordMeaningReview(q,answer,{templateRegistry,guides:{}}),null);const x=fixture('龘');assert.equal(wordMeaningReview(x.q,x.answer,{templateRegistry:x.templateRegistry}),null);
});
test('partner feedback for unrelated questions keeps the existing explanation and result',()=>{const q={id:1,options:['甲','乙'],correct:0,attempts:[{correct:true}],explanation:'原解析'},html=answerFeedback(q,{fragment:()=>'<p>原解析</p>',esc:String});assert(html.includes('這題答對了'));assert(html.includes('feedback-explanation'));});
