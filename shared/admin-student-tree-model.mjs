import {getRewardTreeCourse} from './reward-tree-config.js';
import {deriveRewardTreeModel} from './reward-tree-model.js';
import {foundationTreeData} from './typing-foundation-rewards.js';
import {quizRewardTreeData} from './quiz-rewards.mjs';
import {homeworkTreeData} from './homework-api.js';
import {readingTreeData} from './reading-api.js';
import {appendGardenTestRewards} from './garden-test-rehearsal.mjs';

export function teacherTreeModel(data,course){
 if(data?.identity?.mapping!=='linked'||!data.as_of)throw Error('invalid_tree_snapshot');
 for(const key of ['weekly_rows','foundation','assignments','periods','rehearsal','unlocks','catalog'])if(!Array.isArray(data[key]))throw Error('invalid_tree_snapshot');
 for(const key of ['awards','flowers','partner'])if(!Array.isArray(data.quiz?.[key]))throw Error('invalid_tree_snapshot');
 const rows=[...data.weekly_rows],activities=[...getRewardTreeCourse(course).activities];
 const add=part=>{activities.push(...part.activities);rows.push(...part.rows);};
 if(['grade3-115-1','grade6-115-1'].includes(course))add(foundationTreeData(data.foundation,course));
 add(quizRewardTreeData(data.quiz,course));
 if(course==='grade6-115-1'){add(homeworkTreeData(data.assignments));add(readingTreeData(data.periods));}
 return appendGardenTestRewards(deriveRewardTreeModel(rows,activities),data.rehearsal,course);
}

// Resolve persisted choices only; never create unlocks or migrate saved growth.
export function teacherTreeScene(data,model){
 const g=data.growth,leaves=model.stats.leafCount+(model.stats.pastExamFlowerCount||0),flowers=model.stats.flowerCount;
 const eligible=leaves>=44&&flowers>=10;
 const supported=g&&g.reward_version>=2&&g.foundation_reward_version>=1;
 const level=supported&&eligible?2:1;
 const warning=g&&!supported?'成長紀錄需由學生端同步，這裡先顯示第一級與現有花葉。':!g&&eligible?'已達第二級條件，待學生端同步；教師檢視不會觸發升級。':'';
 const order=[...(g?.order||[])],known=new Set(order.map(r=>r.id));
 for(const r of model.rewards)if(!known.has(r.id)){order.push({id:r.id,kind:r.kind});known.add(r.id);}
 const owned=new Set(data.unlocks),pets=data.catalog.filter(c=>c.key?.startsWith('pet:')&&owned.has(c.key)).sort((a,b)=>a.leaves-b.leaves);
 const choice=data.choices||{},pet=pets.some(c=>c.pet===choice.pet)?choice.pet:pets[0]?.pet||null;
 const fallback=pet==='dog'?'a':'b';let home=choice.homes?.[pet]||fallback;
 if(!['a','b','c'].includes(home)||(home!==fallback&&!owned.has(`home:${pet}:${home}`)))home=fallback;
 const petMode=choice.modes?.[pet]==='rest'?'rest':'walk';
 return {level,warning,order,treeSkin:data.skin==='b'?'b':'a',pet,home:pet?home:null,
  homeVisible:!!pet&&(petMode==='rest'||choice.homeVisible===true),petMode};
}
