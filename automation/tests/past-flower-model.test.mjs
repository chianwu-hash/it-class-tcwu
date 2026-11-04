import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const config=asModule(await fs.readFile('shared/reward-tree-config.js','utf8'));
const {deriveRewardTreeModel}=await import(asModule((await fs.readFile('shared/reward-tree-model.js','utf8')).replace('./reward-tree-config.js',config)));
const {safeRewardSourceHref}=await import(asModule(await fs.readFile('shared/reward-tree-renderer.js','utf8')));
test('考古花的種類、來源、統計及安全回看連結，與一般魔王花各自保留',()=>{
 const cid='grade3-115-1',attempt='00000000-0000-4000-8000-000000000001',href='/grade3/115-1/past-exam.html?paper=paper-v1&attempt='+attempt;
 const acts=[{courseId:cid,weekCode:'00',activityKey:'practice_past:abc',type:'past-exam-flower',label:'期中綜合練習',pageHref:href,sourceLinks:[{title:'回看試卷',href}]},{courseId:cid,weekCode:'01',activityKey:'typing',type:'typing',totalLevels:2,rewardMode:'boss',label:'魔王關'}];
 const m=deriveRewardTreeModel([{course_id:cid,week_code:'00',activity_key:'practice_past:abc',completed:true,score:70}],acts);
 assert.equal(m.flowers.length,1);assert.equal(m.leaves.length,0);assert.equal(m.stats.pastExamFlowerCount,1);assert.equal(m.flowers[0].id,cid+':00:practice_past:abc:flower:1');assert.equal(m.flowers[0].flowerStyle,'forest');assert.equal(m.flowers[0].sourceType,'past_exam');assert.equal(m.flowers[0].sourceLinks[0].href,href);
 assert(safeRewardSourceHref(href));assert(safeRewardSourceHref('/grade6/115-1/quiz.html?cloud=1&session='+attempt));for(const h of ['javascript:alert(1)','https://evil.invalid'+href,href+'&redirect=https://evil.invalid','/my-tree.html',href.replace('paper-v1','../secret')])assert.equal(safeRewardSourceHref(h),false);
});
