import test from 'node:test';
import assert from 'node:assert/strict';
import {shortAnswerPresentation} from '../../shared/quiz-short-answer.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';

test('簡答欄寬只依核定題文指紋，答案變體不影響空白起始寬度',()=>{
 const q={id:'synthetic-short',type:'short',prompt:{text:'請依原題寫出名稱。',media:[]},answer:{accepted:['合成甲']}};
 const registry={[q.id]:{guard:presentationSignature(q),initialChars:4}};
 assert.deepEqual(shortAnswerPresentation(q,registry),{initialChars:4});
 assert.deepEqual(shortAnswerPresentation({...q,answer:{accepted:['合成更長答案']}},registry),{initialChars:4});
 assert.equal(shortAnswerPresentation({...q,prompt:{text:'另一個題目',media:[]}},registry),null);
 assert.equal(shortAnswerPresentation({...q,type:'open'},registry),null);
 assert.equal(shortAnswerPresentation(q,{}),null);
 for(const initialChars of[0,1,13,4.5,'4'])assert.equal(shortAnswerPresentation(q,{[q.id]:{guard:presentationSignature(q),initialChars}}),null);
});

test('自組卷媒體命名空間須經真複本指紋核准，未知URL拒絕',()=>{
 const original={id:'synthetic-media',type:'short',prompt:{text:'看原圖填名稱。',media:[{kind:'image',url:'https://quiz-media.invalid/00000000-0000-0000-0000-000000000001/'+'a'.repeat(64),alt:'合成原圖'}]}};
 const copy=structuredClone(original);copy.prompt.media[0].url='https://partner-media.invalid/'+'b'.repeat(64);
 const registry={[original.id]:{guard:presentationSignature(original),partnerGuard:presentationSignature(copy),initialChars:4}};
 assert.ok(shortAnswerPresentation(original,registry));assert.ok(shortAnswerPresentation(copy,registry));
 copy.prompt.media[0].url='https://partner-media.invalid/'+'c'.repeat(64);assert.equal(shortAnswerPresentation(copy,registry),null);
});
