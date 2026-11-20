import test from 'node:test';import assert from 'node:assert/strict';
import {reviewUnits,reviewPreviewText} from '../../shared/partner-pilot/review-layout.mjs';

test('回顧導覽的純文字分數可讀，未知公式及原題物件保持',()=>{
 assert.equal(reviewPreviewText('吃了$\\frac{3}{8}$個，剩下$\\dfrac{5}{8}$個。'),'吃了8分之3個，剩下8分之5個。');
 assert.equal(reviewPreviewText('一般文字與$\\sqrt{9}$'), '一般文字與$\\sqrt{9}$');
 assert.equal(reviewPreviewText(null),'');
});
test('a mark on any child retains the whole original group without mutating snapshots',()=>{
 const shared=[{id:14,number:4,past:{group:'a'}},{id:10,number:1},{id:13,number:3,past:{group:'a'}},{id:12,number:2}],notes=[{kind:'mark',qid:14}],before=structuredClone(shared);
 const units=reviewUnits(shared,notes);assert.deepEqual(units.map(u=>u.questions.map(q=>q.id)),[[10],[12],[13,14]]);assert.deepEqual(units.map(u=>u.index),[1,2,3]);assert.equal(units[2].marked,true);assert.equal(units[0].marked,false);assert.deepEqual(shared,before);
});
test('same numeric IDs of unrelated notes never mark a unit, no marks or empty snapshot remain valid',()=>{
 assert.equal(reviewUnits([{id:5,number:1}],[{kind:'discuss',qid:5}])[0].marked,false);assert.deepEqual(reviewUnits([],[]),[]);
});
