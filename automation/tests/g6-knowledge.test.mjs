import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fingerprint,candidates} from '../quiz-knowledge/review.mjs';
test('題目指紋不受 JSON 欄位順序影響，內容變動必須重新核對',()=>{
 assert.equal(fingerprint({id:'a',prompt:{text:'題目',media:[]}}),fingerprint({prompt:{media:[],text:'題目'},id:'a'}));
 assert.notEqual(fingerprint({text:'原題'}),fingerprint({text:'新題'}));
});
test('延伸覆蓋率只計同科同重點、有解析、不同題族且難度不提高的候選',()=>{
 const source={question_id:'source',course_id:'course',knowledge_code:'point',group_key:'source-family',difficulty:0};
 const valid={...source,question_id:'valid',group_key:'other',difficulty:-3,usable:true,knowledge_reliable:true,publisher_explanation:true};
 const pool=[valid,...[{course_id:'other'},{knowledge_code:'different'},{group_key:'source-family'},{difficulty:3},{usable:false},{knowledge_reliable:false},{publisher_explanation:false}].map((x,i)=>({...valid,...x,question_id:'invalid'+i}))];
 assert.deepEqual(candidates(pool,source).map(p=>p.question_id),['valid']);
});
test('四科核對清冊完整且唯一，疑義題有原因，沒有題幹或答案副本',async()=>{
 const r=JSON.parse(await fs.readFile(new URL('../quiz-knowledge/g6-reviewed.json',import.meta.url),'utf8'));
 assert.equal(r.assignments.length,930);assert.equal(new Set(r.assignments.map(a=>a.question_id)).size,930);
 const counts=Object.fromEntries(['115-1-kang-g6-ch','115-1-kang-g6-en','115-1-nani-g6-science','115-1-nani-g6-social'].map(c=>[c,r.assignments.filter(a=>a.course_id===c).length]));
 assert.deepEqual(Object.values(counts),[347,154,140,289]);
 assert.deepEqual(r.assignments.filter(a=>!a.knowledge_reliable).map(a=>a.source_item_id).sort(),['1504811','675931']);
 for(const a of r.assignments){assert.match(a.question_sha256,/^[a-f0-9]{64}$/);assert(a.knowledge_code&&a.knowledge_name&&a.evidence);if(!a.knowledge_reliable)assert(a.hold_reason);assert(!('question' in a)&&!('answer' in a));}
});
