import test from 'node:test';import assert from 'node:assert/strict';
import {reviewUnits} from '../../shared/partner-pilot/review-layout.mjs';
test('a mark on any child retains the whole original group without mutating snapshots',()=>{
 const shared=[{id:14,number:4,past:{group:'a'}},{id:10,number:1},{id:13,number:3,past:{group:'a'}},{id:12,number:2}],notes=[{kind:'mark',qid:14}],before=structuredClone(shared);
 const units=reviewUnits(shared,notes);assert.deepEqual(units.map(u=>u.questions.map(q=>q.id)),[[10],[12],[13,14]]);assert.deepEqual(units.map(u=>u.index),[1,2,3]);assert.equal(units[2].marked,true);assert.equal(units[0].marked,false);assert.deepEqual(shared,before);
});
test('same numeric IDs of unrelated notes never mark a unit, no marks or empty snapshot remain valid',()=>{
 assert.equal(reviewUnits([{id:5,number:1}],[{kind:'discuss',qid:5}])[0].marked,false);assert.deepEqual(reviewUnits([],[]),[]);
});
