import assert from 'node:assert/strict';import {withGardenTestRewards} from '../shared/garden-test-rehearsal.mjs';
const model={rewards:[{id:'real',kind:'quiz-leaf'}],leaves:[{id:'real',kind:'quiz-leaf'}],flowers:[],pendingLeaves:[],pendingFlowers:[],stats:{leafCount:1,flowerCount:0}};let calls=0;
const args={courseId:'grade3-115-1',session:{user:{email:'student@example.invalid'}},supabase:{rpc:async(_,params)=>{
 const courseId=params.p_course_id;
 calls++;
 return {data:[{id:courseId+':test-setup:fixture:typing-leaf:1',kind:'typing-leaf',courseId,earned:true}]};
}}};
assert.equal(await withGardenTestRewards(model,args),model);assert.equal(calls,0);
args.session.user.email='chianwu@apps.ntpc.edu.tw';const m=await withGardenTestRewards(model,args);assert.equal(calls,1);assert.equal(m.stats.leafCount,2);assert.equal(model.stats.leafCount,1);assert.equal(m.pendingLeaves,model.pendingLeaves);
args.courseId='grade6-115-1';
const grade6=await withGardenTestRewards(model,args);
assert.equal(calls,2);assert.equal(grade6.stats.leafCount,2);assert.equal(grade6.leaves[1].courseId,'grade6-115-1');
args.courseId='grade4-115-1';assert.equal(await withGardenTestRewards(model,args),model);assert.equal(calls,2);
args.courseId='grade6-115-1';args.session.user.email='student@example.invalid';
assert.equal(await withGardenTestRewards(model,args),model);assert.equal(calls,2);
console.log(JSON.stringify({passed:true,checks:['no-extra-RPC-for-students','only-designated-account-and-course','merge-keeps-real-progress-intact']}));
