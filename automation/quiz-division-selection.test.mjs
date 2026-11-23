import test from 'node:test';
import assert from 'node:assert/strict';
import {divisionSelectionCandidate} from './lib/quiz-division-selection.mjs';
import {batchCounts,expectedResponse} from './lib/quiz-batch-plan.mjs';
const source=()=>({id:'HL115G3M-00000001',question:{content:{text:'算算看，再勾選可以整除的算式。\n□(１) 18÷3＝（ ）…（ ）\n□(２) 23÷5＝（ ）…（ ）',media:[]}},answer:{content:{text:'答案：(１)ˇ；6；0；(２)4；3',media:[]}}});
const review=()=>({logical_targets:[{target_id:'t',positions:[{position_id:'q1',kind:'number',reference_value:6},{position_id:'r1',kind:'number',reference_value:0},{position_id:'q2',kind:'number',reference_value:'4'},{position_id:'r2',kind:'number',reference_value:'3'},{position_id:'set',kind:'set',reference_value:['(1)']}]}]});
test('保留共用題幹，計算及整除勾選拆為獨立判分小題',()=>{
 const s=source(),r=divisionSelectionCandidate(s,review(),{}),qs=r.candidate.doc.blocks[0].questions;
 assert.equal(r.candidate.doc.blocks[0].material.text,s.question.content.text.split('\n')[0]);assert.equal(qs.length,3);assert.deepEqual(expectedResponse(qs[0]),{v:1,f:{q:'6',r:'0'}});assert.deepEqual(expectedResponse(qs[2]),{v:1,f:{divisible:['e1']}});assert.equal(r.mapping.length,5);
 const counts=batchCounts({schema:1,candidates:[r.candidate]});assert.equal(counts.sources,1);assert.equal(counts.questions,3);assert.equal(counts.positions,5);assert.equal(counts.samples,1);
});
test('原教師商餘數、勾選與固定複核任一矛盾都拒絕',()=>{
 const s=source();s.answer.content.text=s.answer.content.text.replace('6','7');assert.throws(()=>divisionSelectionCandidate(s,review(),{}));
 const tick=source();tick.answer.content.text=tick.answer.content.text.replace('ˇ','');assert.throws(()=>divisionSelectionCandidate(tick,review(),{}));
 const r=review();r.logical_targets[0].positions.at(-1).reference_value=['(2)'];assert.throws(()=>divisionSelectionCandidate(source(),r,{}));
});
test('不忽略多餘原文、來源題號缺口或缺失的數字複核',()=>{
 const s=source();s.question.content.text+='\n還有其他題意';assert.throws(()=>divisionSelectionCandidate(s,review(),{}));
 const r=review();r.logical_targets[0].positions.splice(1,1);assert.throws(()=>divisionSelectionCandidate(source(),r,{}));
 const gap=source();gap.question.content.text=gap.question.content.text.replace('(２)','(３)');assert.throws(()=>divisionSelectionCandidate(gap,review(),{}));
});
test('有教師圖時必須先有獨立核圖證據',()=>{
 const s=source();s.answer.content.media=[{kind:'image',url:'https://example.invalid/key.png'}];assert.throws(()=>divisionSelectionCandidate(s,review(),{}));assert.equal(divisionSelectionCandidate(s,review(),{},{teacherMediaVerified:true}).candidate.doc.blocks[0].questions.length,3);
});
