import test from 'node:test';import assert from 'node:assert/strict';
import {prepareExplanation,candidates} from '../quiz-knowledge/g4-complete-review.mjs';

test('只移除可獨立成立解析的單一前導舊序號，保留圖文與來源物件',()=>{
 const q={explanation:{text:'解析：③比例尺可用來計算實際距離。',media:[{kind:'image',url:'https://example.invalid/a'}],layout:[{type:'paragraph',runs:[{type:'text',text:'解析：'},{type:'text',text:'③'},{type:'text',text:'比例尺可用來計算實際距離。'}]}]}};
 const original=structuredClone(q),r=prepareExplanation(q,true);assert.equal(r.publisher_explanation,true);assert.equal(r.explanation.text,'解析：比例尺可用來計算實際距離。');assert.equal(r.explanation.layout[0].runs[1].text,'');assert.deepEqual(r.explanation.media,q.explanation.media);assert.deepEqual(q,original);
});
test('多選項位置引用與未提供詳解都不能列入延伸候選',()=>{
 for(const text of ['①正確，②錯誤。','詳解：①／②。','應選選項 B。','先相加，故選③。'])assert.equal(prepareExplanation({explanation:{text,media:[]}},true).publisher_explanation,false);
 assert.equal(prepareExplanation({explanation:{text:'只有正確答案。',media:[]}},false).publisher_explanation,false);
 assert.equal(prepareExplanation({explanation:{text:'此角為直角。',media:[]}},true).publisher_explanation,true);
});
test('配題維持同課程同重點、不同題族、有解析及不提高難度',()=>{
 const s={course_id:'c',knowledge_code:'k',group_key:'source',difficulty:0};const good={...s,question_id:'good',group_key:'other',usable:true,knowledge_reliable:true,publisher_explanation:true};
 const cases=[good,{...good,question_id:'hard',difficulty:3},{...good,question_id:'other-course',course_id:'x'},{...good,question_id:'other-focus',knowledge_code:'x'},{...good,question_id:'same-family',group_key:'source'},{...good,question_id:'no-explanation',publisher_explanation:false},{...good,question_id:'held',knowledge_reliable:false},{...good,question_id:'disabled',usable:false}];assert.deepEqual(candidates(cases,s).map(p=>p.question_id),['good']);
});
