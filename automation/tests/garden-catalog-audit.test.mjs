import {test} from 'node:test';import assert from 'node:assert/strict';
import {expectedCatalog,compareCatalog} from '../audit-garden-catalog.mjs';
const courses=[{id:'grade3-115-1',activities:[{weekCode:'10',activityKey:'typing_task_5',type:'typing',totalLevels:5,pageHref:'/grade3/115-1/week10.html'}]}];
test('new weekly activity and both foundation curricula require server catalogue rows',()=>{
 const expected=expectedCatalog(courses,['en_01','zh_01']);assert.equal(expected.length,5);
 const result=compareCatalog(expected,expected.slice(1));assert.equal(result.missing[0].activity_key,'typing_task_5');assert.equal(result.missing.length,1);
});
test('wrong levels and boss mode are not silently accepted',()=>{
 const expected=expectedCatalog(courses,[]);const r=compareCatalog(expected,[{...expected[0],total_levels:1,reward_mode:'boss'}]);assert.equal(r.mismatched.length,1);
});
test('catalogue is additive; historic rows are reported rather than deleted',()=>{
 const expected=expectedCatalog(courses,[]),actual=[...expected,{...expected[0],activity_key:'retired'}];const r=compareCatalog(expected,actual);assert.equal(r.extra.length,1);assert.equal(r.missing.length,0);
});
test('duplicate course-week-activity keys are rejected',()=>assert.throws(()=>expectedCatalog([...courses,...courses],[]),/duplicate/));
