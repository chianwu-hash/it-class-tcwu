import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const config=dataUrl(await readFile(new URL('../shared/reward-tree-config.js',import.meta.url),'utf8'));
const modelSource=(await readFile(new URL('../shared/reward-tree-model.js',import.meta.url),'utf8')).replace('"./reward-tree-config.js"',JSON.stringify(config));
const {deriveRewardTreeModel}=await import(dataUrl(modelSource));
const curriculum=dataUrl(await readFile(new URL('../shared/typing-foundation-curriculum.mjs',import.meta.url),'utf8'));
const zhuyin=dataUrl(await readFile(new URL('../shared/zhuyin-foundation-curriculum.mjs',import.meta.url),'utf8'));
const {foundationTreeData}=await import(dataUrl((await readFile(new URL('../shared/typing-foundation-rewards.js',import.meta.url),'utf8')).replace("'./typing-foundation-curriculum.mjs'",JSON.stringify(curriculum)).replace("'./zhuyin-foundation-curriculum.mjs'",JSON.stringify(zhuyin))));
const {lessons}=await import(curriculum);
const full=foundationTreeData(lessons.map(l=>({lesson_key:l.key,completed:true,checkpoint:5})),'grade6-115-1');
assert.equal(deriveRewardTreeModel(full.rows,full.activities).stats.leafCount,12);
assert.equal(deriveRewardTreeModel([...full.rows,...full.rows],full.activities).stats.leafCount,12);
const {zhuyinLessons}=await import(zhuyin);
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
