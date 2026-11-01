import {summarizeLearningRewards,summarizeClassRewards} from './admin-learning-rewards.mjs';

// A read-only interpretation of the current growth and item-unlock contracts.
// A saved entitlement is distinct from a newly met, unsynchronized condition.
export function summarizeGardenStatus(data,courseId){
  const g=data.garden;if(!g||!Array.isArray(g.catalog)||!Array.isArray(g.unlocks)||!Array.isArray(data.past_flowers))throw new Error('invalid_garden_response');
  const s=summarizeLearningRewards(data,courseId),rehearsal=s.rehearsal;
  const leaves=s.leaves+(rehearsal?.leaves||0),flowers=s.flowers+(rehearsal?.flowers||0);
  const current=[...s.items];
  if(rehearsal){
    if(!rehearsal.setup_id&&(rehearsal.leaves||rehearsal.flowers))throw new Error('invalid_garden_response');
    for(const [kind,count] of [['typing-leaf',rehearsal.leaves],['flower',rehearsal.flowers]])for(let i=1;i<=count;i++)current.push({id:`${courseId}:test-setup:${rehearsal.setup_id}:${kind}:${i}`,kind});
  }
  const growth=g.growth;
  if(growth&&!Array.isArray(growth.baseline))throw new Error('invalid_garden_response');
  // Older baselines need the student's migration path. Do not simulate a grant
  // or incorrectly label converted past-exam leaves as extra growth.
  const migrationPending=!!growth&&growth.reward_version<2;
  const reached=(leaves>=44&&flowers>=10)||!!growth&&(leaves>=growth.leaf_floor&&flowers>=growth.flower_floor);
  const level=migrationPending?null:reached?2:1;
  const synchronizationPending=level===2&&!growth;
  const baseline=new Set((growth?.baseline||current).map(r=>r.id));
  const added=current.filter(r=>!baseline.has(r.id));
  const newLeaves=added.filter(r=>r.kind!=='flower').length,newFlowers=added.filter(r=>r.kind==='flower').length;
  const owned=new Map(g.unlocks.map(u=>[u.key,u]));
  const gaps=(targetLeaves,targetFlowers)=>({leaves:Math.max(0,targetLeaves-leaves),flowers:Math.max(0,targetFlowers-flowers)});
  const gapText=g=>[g.leaves?`${g.leaves} 片葉子`:'',g.flowers?`${g.flowers} 朵花`:''].filter(Boolean).join('、');
  let paths=[gaps(44,10)];
  if(growth&&!migrationPending)paths.push(gaps(growth.leaf_floor,growth.flower_floor));
  paths=paths.filter((p,i,all)=>!all.some((q,j)=>j!==i&&q.leaves<=p.leaves&&q.flowers<=p.flowers&&(q.leaves<p.leaves||q.flowers<p.flowers||j<i)));
  const levelRemaining=migrationPending?'成長紀錄待同步後，才能確認剩餘升級條件。':level===2?
    synchronizationPending?'第二級條件已達成，待學生端同步升級。':'已達第二級。':
    `達到第二級還差 ${paths.map(p=>gapText(p)).join('；或依另一組保留門檻，還差 ')}。`;
  const features=[
    {key:'flower-color',label:'花朵換色',status:flowers>=3?'unlocked':'locked',note:'本學期累積 3 朵花',remaining:flowers>=3?'條件已達成。':`還差 ${3-flowers} 朵花。`},
    ...[['level2-scene','第二級場景與天氣'],['growth-replay','重播成長紀念']].map(([key,label])=>({key,label,
      status:level===null?'unknown':level===2?growth?'unlocked':'pending':'locked',note:'本學期努力樹達第二級',remaining:levelRemaining})),
    {key:'tree-skin',label:'切換樹型',status:g.has_growth?'unlocked':synchronizationPending?'pending':'locked',
      available:level===2,note:'曾有第二級成長紀錄，權限跨學期保留',remaining:levelRemaining}
  ];
  for(const item of g.catalog){
    const grant=owned.get(item.key),eligible=level===2&&!!growth&&(newLeaves>=item.leaves||newFlowers>=item.flowers);
    const missingLeaves=Math.max(0,item.leaves-newLeaves),missingFlowers=Math.max(0,item.flowers-newFlowers);
    const itemGap=missingLeaves===0||missingFlowers===0?'本項新增花葉條件已達成，待學生端同步。':
      `升二級後目前已新增 ${newLeaves} 葉、${newFlowers} 花；還差 ${missingLeaves} 片葉子或 ${missingFlowers} 朵花（擇一達成）。`;
    const remaining=migrationPending?'成長紀錄待同步後，才能確認本項剩餘條件。':level!==2?
      `${levelRemaining}${growth?itemGap:`升級後還需新增 ${item.leaves} 片葉子或 ${item.flowers} 朵花（擇一達成）。`}`:itemGap;
    features.push({key:item.key,label:item.label,status:grant?'unlocked':migrationPending?'unknown':eligible?'pending':'locked',
      available:level===2,course_id:grant?.course_id,unlocked_at:grant?.unlocked_at,
      remaining,note:`升二級後再新增 ${item.leaves} 葉或 ${item.flowers} 花；已取得權限跨學期保留`});
  }
  if(g.legacy_pet&&!owned.has('pet:cat'))features.push({key:'legacy-pet',label:'寵物與小窩（既有權限）',status:'unlocked',available:level===2,note:'已有寵物解鎖紀錄，項目清單待學生端同步'});
  return {level,levelRemaining,synchronizationPending,migrationPending,features,leaves,flowers,newLeaves,newFlowers,
    includesRehearsal:!!rehearsal,grown_at:growth?.grown_at||null,as_of:data.as_of};
}

export function summarizeClassGardenRewards(data,courseId){
  const summary=summarizeClassRewards(data,courseId);
  return {...summary,items:summary.items.map((item,i)=>({...item,
    garden:item.mapping==='linked'?summarizeGardenStatus(data.items[i].rewards,courseId):null}))};
}

export function classUnlockConditions(garden,all=false){
  if(!garden)return {message:'帳號對應確認後才能計算剩餘條件。',groups:[],hiddenGroups:0};
  const grouped=new Map();
  for(const feature of garden.features.filter(f=>f.status!=='unlocked')){
    const remaining=feature.remaining||feature.note,key=feature.status+':'+remaining;
    if(!grouped.has(key))grouped.set(key,{labels:[],remaining,status:feature.status});
    grouped.get(key).labels.push(feature.label);
  }
  const groups=[...grouped.values()],message=garden.level!==2||garden.synchronizationPending?garden.levelRemaining:'';
  if(!groups.length)return {message:'目前所有功能均已解鎖。',groups:[],hiddenGroups:0};
  if(all)return {message,groups,hiddenGroups:0};
  const next=groups.find(g=>g.remaining!==message);
  return {message,groups:next?[{...next,remaining:message&&next.remaining.startsWith(message)?next.remaining.slice(message.length):next.remaining}]:[],
    hiddenGroups:groups.filter(g=>g.remaining!==message&&g!==next).length};
}
