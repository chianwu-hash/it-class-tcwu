import assert from 'node:assert/strict';
import {importModule} from './lib/data-url-import.mjs';
const {deriveRewardTreeModel}=await importModule('shared/reward-tree-model.js');
const {foundationTreeData}=await importModule('shared/typing-foundation-rewards.js');
const {lessons}=await importModule('shared/typing-foundation-curriculum.mjs');
const full=foundationTreeData(lessons.map(l=>({lesson_key:l.key,completed:true,checkpoint:5})),'grade6-115-1');
assert.equal(deriveRewardTreeModel(full.rows,full.activities).stats.leafCount,12);
assert.equal(deriveRewardTreeModel([...full.rows,...full.rows],full.activities).stats.leafCount,12);
const {zhuyinLessons}=await importModule('shared/zhuyin-foundation-curriculum.mjs');
const mixed=foundationTreeData([...lessons,...zhuyinLessons].map(l=>({lesson_key:l.key,completed:true,checkpoint:5})),'grade6-115-1');
assert.equal(deriveRewardTreeModel(mixed.rows,mixed.activities).stats.leafCount,24);
assert.equal(deriveRewardTreeModel([...mixed.rows,...mixed.rows],mixed.activities).stats.leafCount,24);
assert.equal(deriveRewardTreeModel(mixed.rows.filter(r=>r.activity_key!==zhuyinLessons[0].key),mixed.activities).stats.leafCount,23);
for(const course of ['grade3-115-1','grade6-115-1']){
 for(const completed of [false,true]){
  const data=foundationTreeData({checkpoint:5,completed},course);
  const model=deriveRewardTreeModel(data.rows,data.activities);
  assert.equal(model.stats.leafCount,completed?1:0);assert.equal(model.stats.flowerCount,0);
  assert.equal(model.stats.pendingLeafCount,completed?23:24);
  const repeated=deriveRewardTreeModel([...data.rows,...data.rows],data.activities);assert.equal(repeated.stats.leafCount,completed?1:0);
 }
 const reset=foundationTreeData({checkpoint:0,completed:false},course);assert.equal(deriveRewardTreeModel(reset.rows,reset.activities).stats.leafCount,0);
}
const activity={courseId:'grade6-115-1',type:'typing',weekCode:'02',activityKey:'typing_task_5',totalLevels:5};
const legacy=deriveRewardTreeModel([{course_id:activity.courseId,week_code:'02',activity_key:activity.activityKey,current_level:5,completed:true}],[activity]);
assert.equal(legacy.stats.leafCount,4);assert.equal(legacy.stats.flowerCount,1);
console.log('PASS: foundation one-leaf/no-flower, pending, duplicate/replay, reset, both identity courses; legacy typing unchanged.');
