import {getRewardTreeCourse} from './reward-tree-config.js';
import {deriveRewardTreeModel} from './reward-tree-model.js';
import {foundationTreeData} from './typing-foundation-rewards.js';
import {wholeQuizLeaves} from './quiz-leaf-credit.mjs';
import {homeworkTreeData} from './homework-api.js';
import {readingTreeData} from './reading-api.js';

// Same course catalog, adapters and earned-reward model as my-tree.html.
// Read persisted awards, never infer awards from scores or trigger a reward RPC.
export function summarizeLearningRewards(data,courseId){
  for(const key of ['weekly_rows','foundation','awards','assignments','periods']){
    if(!Array.isArray(data[key]))throw new Error('invalid_rewards_response');
  }
  const rows=[...data.weekly_rows],activities=[...getRewardTreeCourse(courseId).activities];
  const categories=new Map(activities.map(a=>[`${a.weekCode}:${a.activityKey}`,'週次活動']));
  const add=(part,category)=>{
    activities.push(...part.activities);rows.push(...part.rows);
    for(const a of part.activities)categories.set(`${a.weekCode}:${a.activityKey}`,category);
  };
  add(foundationTreeData(data.foundation,courseId),'打字基礎');
  const quiz=wholeQuizLeaves(data.awards);
  add({activities:quiz.leaves.map(a=>({courseId,weekCode:'00',activityKey:'practice_'+a.id,type:'quiz',label:'考前練功坊・'+a.title})),
    rows:quiz.leaves.map(a=>({course_id:courseId,week_code:'00',activity_key:'practice_'+a.id,completed:true,updated_at:a.awarded_at}))},'考前練功坊');
  if(courseId==='grade6-115-1'){
    add(homeworkTreeData(data.assignments),'作業繳交與過關');
    add(readingTreeData(data.periods),'閱讀分享與過關');
  }
  const model=deriveRewardTreeModel(rows,activities);
  const past=(data.past_flowers||[]).map(a=>({id:`${courseId}:00:practice_${a.id}:flower:1`,category:'考古題',title:`考古題・${a.title} 過關花`,kind:'flower',updated_at:a.awarded_at}));
  const groups=new Map();
  for(const category of ['週次活動','打字基礎','考前練功坊',...(courseId==='grade6-115-1'?['作業繳交與過關','閱讀分享與過關']:[])])groups.set(category,{category,leaves:0,flowers:0});
  const items=model.rewards.map(r=>{
    const category=categories.get(`${r.weekCode}:${r.activityKey}`);
    if(!category)throw new Error('unknown_reward_source');
    groups.get(category)[r.kind==='flower'?'flowers':'leaves']++;
    return {id:r.id,category,title:r.title,kind:r.kind,updated_at:r.updatedAt};
  });
  if(past.length){groups.set('考古題',{category:'考古題',leaves:0,flowers:past.length});items.push(...past);}
  return {leaves:model.stats.leafCount,flowers:model.stats.flowerCount+past.length,pendingHalf:quiz.pendingHalf,
    groups:[...groups.values()],items,unknownRows:model.stats.unknownRowCount,skippedActivities:model.stats.skippedActivityCount,
    rehearsal:data.rehearsal||null};
}

export function summarizeClassRewards(data,courseId){
  if(!Array.isArray(data.items)||data.items.length!==data.total)throw new Error('incomplete_class_response');
  const seen=new Set(),totals={leaves:0,flowers:0,pendingHalves:0,linked:0,unlinked:0,conflict:0};
  const items=data.items.map(row=>{
    if(row.class_code!==data.class_code||seen.has(row.student_code))throw new Error('invalid_class_response');
    seen.add(row.student_code);
    const mapping=row.rewards?.identity?.mapping;
    if(!['linked','unlinked','conflict'].includes(mapping))throw new Error('invalid_class_response');
    totals[mapping]++;
    if(mapping!=='linked')return {...row,rewards:undefined,mapping,leaves:null,flowers:null,pendingHalf:null};
    const summary=summarizeLearningRewards(row.rewards,courseId);
    totals.leaves+=summary.leaves;totals.flowers+=summary.flowers;totals.pendingHalves+=Number(summary.pendingHalf);
    return {class_code:row.class_code,seat_no:row.seat_no,student_code:row.student_code,display_name:row.display_name,
      mappings:row.mappings,mapping,leaves:summary.leaves,flowers:summary.flowers,pendingHalf:summary.pendingHalf,
      rehearsal:summary.rehearsal,unknownRows:summary.unknownRows,skippedActivities:summary.skippedActivities};
  });
  return {items,totals,total:data.total,class_code:data.class_code,as_of:data.as_of};
}

export function sortClassRewards(items,sort='seat'){
  return [...items].sort((a,b)=>{
    if(sort==='leaves'||sort==='flowers'){
      if((a[sort]===null)!==(b[sort]===null))return a[sort]===null?1:-1;
      const diff=(b[sort]??0)-(a[sort]??0);if(diff)return diff;
    }
    return Number(a.seat_no)-Number(b.seat_no);
  });
}
