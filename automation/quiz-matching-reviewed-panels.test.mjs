import test from 'node:test';import assert from 'node:assert/strict';
import {reviewedWeightMatching} from './lib/quiz-matching-reviewed-panels.mjs';
import {matchingSources,matchingVariants} from '../shared/quiz-matching-sources.mjs';
import {matchingPresentation} from '../shared/quiz-matching-presentation.mjs';
const fixture=()=>{
 const id='HL115G3M-00000001',url='https://example.invalid/original.png';
 return {src:{id,source_files:[{name:'preamble-question.docx.gz',sha256:'c'.repeat(64)}],question:{content:{text:'將相同重量連起來。',media:[{kind:'image',url,alt:'來源'}]}},answer:{content:{text:'答案：①→ㄆ；②→ㄅ'}}},review:{logical_targets:[{positions:[{position_id:'p1',kind:'single_choice',reference_value:'ㄆ'},{position_id:'p2',kind:'single_choice',reference_value:'ㄅ'}]}]},observation:{source:id,visuallyReviewed:true,config:{labels:['第1袋：1公斤20公克','第2袋：2公斤'],leftGrams:[1020,2000],rightText:['2000公克','1020公克'],rightGrams:[2000,1020]},panels:[],original:{sha256:'a'.repeat(64),sourceUrl:url}},options:{catalog:{},owner:'82dfc4ec-8c68-47d9-aa25-8918080ca577'}};
};
test('重量換算同時綁教師原鍵、固定複核、原單位與來源圖',()=>{
 const a=fixture(),r=reviewedWeightMatching(a.src,a.review,a.observation,a.options);assert.deepEqual(r.candidate.doc.blocks[0].questions[0].answer.fields,{f1:['r2'],f2:['r1']});assert.equal(r.plan.boards[0].unique,false);
 for(const change of [x=>x.src.answer.content.text='答案：①→ㄅ；②→ㄆ',x=>x.observation.config.rightText[1]='102公克',x=>x.observation.original.sourceUrl='https://example.invalid/other.png']){const b=fixture();change(b);assert.throws(()=>reviewedWeightMatching(b.src,b.review,b.observation,b.options));}
});
test('天平共用圖保留原比例與獨立比較，不增加一對一限制',()=>{
 const a=fixture();a.observation.config={labels:['左盤物品','右盤物品'],balance:'left_heavier',rightText:['200公克','750公克'],rightGrams:[200,750]};a.observation.panels=[{source:a.src.id,kind:'material',index:0,crop:{sha256:'b'.repeat(64),sourcePngSha256:'a'.repeat(64)}}];
 const r=reviewedWeightMatching(a.src,a.review,a.observation,a.options);assert.equal(r.plan.boards[0].materialIndex,1);assert.equal(r.candidate.doc.blocks[0].questions[0].prompt.media.length,2);
 a.observation.config.balance='left_lighter';assert.throws(()=>reviewedWeightMatching(a.src,a.review,a.observation,a.options));a.observation.config.balance='left_heavier';a.observation.panels[0].crop.sourcePngSha256='d'.repeat(64);assert.throws(()=>reviewedWeightMatching(a.src,a.review,a.observation,a.options));
});
test('圖片選項沿既有partner命名空間以精確變體匹配，不放寬未知SHA',()=>{
 const a=fixture();delete a.observation.config.rightText;
 a.observation.panels=[0,1].map(i=>({source:a.src.id,kind:'right',index:i,crop:{sha256:String(i+1).repeat(64),sourcePngSha256:'a'.repeat(64)}}));
 const r=reviewedWeightMatching(a.src,a.review,a.observation,a.options),q=r.candidate.doc.blocks[0].questions[0];matchingSources[q.id]=r.plan;matchingVariants[q.id]=[r.partnerSignature];
 try{assert.ok(matchingPresentation(q));const copy=structuredClone(q);for(const c of [copy.prompt,...copy.fields.flatMap(f=>f.options.map(o=>o.content))])for(const m of c.media)m.url='https://partner-media.invalid/'+m.url.split('/').at(-1);assert.ok(matchingPresentation(copy));copy.fields[0].options[0].content.media[0].url='https://partner-media.invalid/'+'f'.repeat(64);assert.equal(matchingPresentation(copy),null);}finally{delete matchingSources[q.id];delete matchingVariants[q.id];}
});
