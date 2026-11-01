import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const dataUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
// Browser adapters retain their exact function bodies; remove only network-only
// imports for this Node test. No auth, request or reward notification is invoked.
async function browserModule(url){
  let code=await readFile(url,'utf8');
  if(/\/(homework|reading)-api\.js$/.test(url.pathname))code=code.replace(/^import .*;\r?\n/gm,'');
  for(const m of [...code.matchAll(/from (["'])(\.\/[^"']+)\1/g)]){
    code=code.replace(m[0],`from '${await browserModule(new URL(m[2],url))}'`);
  }
  return dataUrl(code);
}
const runnableUrl=await browserModule(new URL('../../shared/admin-learning-rewards.mjs',import.meta.url));
export const {summarizeLearningRewards,summarizeClassRewards,sortClassRewards}=await import(runnableUrl);
const {summarizeGardenStatus,summarizeClassGardenRewards,classUnlockConditions}=await import(await browserModule(new URL('../../shared/admin-learning-garden.mjs',import.meta.url)));
const course='grade6-115-1';
const empty=()=>({weekly_rows:[],foundation:[],awards:[],assignments:[],periods:[]});
const award=(id,units)=>({id,half_units:units,title:'同一重點練習',awarded_at:'2026-11-01T00:00:00Z'});

test('花葉沿用努力樹：半葉跨卷湊整，不以試卷數或正確率推算',()=>{
  const data=empty();data.awards=[award('a',1)];let stats=summarizeLearningRewards(data,course);
  assert.equal(stats.leaves,0);assert.equal(stats.pendingHalf,true);
  data.awards.push(award('b',2));stats=summarizeLearningRewards(data,course);
  assert.equal(stats.leaves,1);assert.equal(stats.flowers,0);assert.equal(stats.pendingHalf,true);
  data.awards.push(award('c',1));stats=summarizeLearningRewards(data,course);
  assert.equal(stats.leaves,2);assert.equal(stats.pendingHalf,false);
});
test('英中基礎與週次分開；重置與目前作業閱讀評比會收回有效葉',()=>{
  const data=empty();data.foundation=[{lesson_key:'english-home-row-v1',completed:true},{lesson_key:'zhuyin-home-v1',completed:true}];
  data.assignments=[{id:'hw',course_id:course,week_code:'02',title:'作業',submission:{status:'passed'}}];
  data.periods=[{id:'reading',course_id:course,week_code:'02',submission:{status:'needs_revision'}}];
  let stats=summarizeLearningRewards(data,course);assert.equal(stats.leaves,5);assert.equal(stats.flowers,0);
  data.foundation[0].completed=false;data.assignments[0].submission.status='needs_revision';
  stats=summarizeLearningRewards(data,course);assert.equal(stats.leaves,3);
  assert.equal(new Set(stats.items.map(r=>r.id)).size,stats.items.length);
  const g3=summarizeLearningRewards(data,'grade3-115-1');assert.equal(g3.leaves,1);assert.equal(g3.groups.length,3);
});
test('週次完成的關卡葉與魔王花、不明活動、測試體驗分開處理',async()=>{
  const {getRewardTreeCourse}=await import(await browserModule(new URL('../../shared/reward-tree-config.js',import.meta.url)));
  const a=getRewardTreeCourse(course).activities.find(a=>a.type==='typing'&&a.totalLevels>1);
  const data=empty();data.weekly_rows=[{course_id:course,week_code:a.weekCode,activity_key:a.activityKey,completed:true},
    {course_id:course,week_code:'99',activity_key:'unknown',completed:true}];
  data.rehearsal={leaves:43,flowers:10};const stats=summarizeLearningRewards(data,course);
  assert.equal(stats.leaves,a.totalLevels-1);assert.equal(stats.flowers,1);assert.equal(stats.unknownRows,1);
  assert.deepEqual(stats.rehearsal,data.rehearsal);
  assert.throws(()=>summarizeLearningRewards({...data,awards:null},course),/invalid_rewards_response/);
});

test('全班保留未連結與對應衝突，半葉不跨人合併，排序不改總數或原資料',()=>{
  const pupil=(seat,mapping,awards=[])=>({class_code:'603',seat_no:seat,student_code:'603'+String(seat).padStart(2,'0'),display_name:'合成同學',
    rewards:{...empty(),awards,identity:{mapping}}});
  const data={class_code:'603',total:4,items:[pupil(2,'linked',[award('b',1)]),pupil(1,'linked',[award('a',1)]),pupil(3,'unlinked'),pupil(4,'conflict')]};
  const s=summarizeClassRewards(data,course);
  assert.deepEqual(s.totals,{leaves:0,flowers:0,pendingHalves:2,linked:2,unlinked:1,conflict:1});
  assert.equal(s.items[2].leaves,null);assert.equal(s.items[3].flowers,null);
  assert.deepEqual(sortClassRewards(s.items,'leaves').map(r=>r.seat_no),[1,2,3,4]);
  assert.deepEqual(s.items.map(r=>r.seat_no),[2,1,3,4]);
  assert.throws(()=>summarizeClassRewards({...data,total:5},course),/incomplete_class_response/);
  assert.throws(()=>summarizeClassRewards({...data,items:[data.items[0],data.items[0],...data.items.slice(2)]},course),/invalid_class_response/);
  assert.throws(()=>summarizeClassRewards({...data,class_code:'604'},course),/invalid_class_response/);
  const ranked=[{seat_no:1,leaves:3,flowers:5},{seat_no:2,leaves:8,flowers:1},{seat_no:3,leaves:null,flowers:null}];
  assert.deepEqual(sortClassRewards(ranked,'leaves').map(r=>r.seat_no),[2,1,3]);
  assert.deepEqual(sortClassRewards(ranked,'flowers').map(r=>r.seat_no),[1,2,3]);
  assert.equal(summarizeClassRewards({class_code:'699',total:0,items:[]},course).totals.leaves,0);
});

const gardenData=()=>({...empty(),past_flowers:[],garden:{growth:null,has_growth:false,legacy_pet:false,unlocks:[],catalog:[
  {key:'pet:cat',label:'橘寶與貓窩',leaves:12,flowers:3},{key:'pet:dog',label:'布丁與狗窩',leaves:24,flowers:6}]}});
const addFlowers=(d,n)=>{d.past_flowers=Array.from({length:n},(_,i)=>({id:'past:'+i,title:'考古題',awarded_at:'2026-11-01T00:00:00Z'}));};
test('努力樹等級以葉與花同時達標，達標待同步不冒充已升級或寵物已解鎖',()=>{
  const d=gardenData();d.awards=Array.from({length:44},(_,i)=>award(String(i),2));
  assert.equal(summarizeGardenStatus(d,course).level,1);
  addFlowers(d,10);let s=summarizeGardenStatus(d,course);assert.equal(s.level,2);assert.equal(s.synchronizationPending,true);
  assert.equal(s.features.find(f=>f.key==='level2-scene').status,'pending');
  assert.equal(s.features.find(f=>f.key==='pet:cat').status,'locked');assert.equal(s.newLeaves,0);
  const noLeaves=gardenData();addFlowers(noLeaves,30);assert.equal(summarizeGardenStatus(noLeaves,course).level,1);
  const high=gardenData();high.awards=Array.from({length:90},(_,i)=>award(String(i),2));addFlowers(high,30);assert.equal(summarizeGardenStatus(high,course).level,2);
  assert.equal(summarizeLearningRewards(d,course).flowers,10);
  assert.equal(summarizeLearningRewards(d,course).leaves,44);
});
test('已存基準與跨學期權限、新增花解鎖、降回一級、舊快照待同步分開呈現',()=>{
  const d=gardenData();d.awards=Array.from({length:44},(_,i)=>award(String(i),2));addFlowers(d,10);
  d.garden.growth={reward_version:2,leaf_floor:44,flower_floor:10,baseline:summarizeLearningRewards(d,course).items};d.garden.has_growth=true;
  d.garden.unlocks=[{key:'pet:dog',course_id:'grade3-114-2',unlocked_at:'2026-10-01T00:00:00Z'}];
  addFlowers(d,13);let s=summarizeGardenStatus(d,course);assert.equal(s.newFlowers,3);assert.equal(s.level,2);
  assert.equal(s.features.find(f=>f.key==='pet:cat').status,'pending');assert.equal(s.features.find(f=>f.key==='pet:dog').status,'unlocked');
  assert.equal(s.features.find(f=>f.key==='pet:dog').course_id,'grade3-114-2');
  d.awards=[];s=summarizeGardenStatus(d,course);assert.equal(s.level,1);assert.equal(s.features.find(f=>f.key==='pet:dog').available,false);
  d.garden.growth.reward_version=1;s=summarizeGardenStatus(d,course);assert.equal(s.level,null);assert.equal(s.migrationPending,true);
  assert.equal(s.features.find(f=>f.key==='pet:dog').status,'unlocked');
});
test('轉換保留門檻、測試體驗與花色依目前狀態，來源缺漏不假報第一級',()=>{
  const d=gardenData();d.awards=[award('one',2)];d.rehearsal={setup_id:'test-setup',leaves:43,flowers:10};
  let s=summarizeGardenStatus(d,course);assert.equal(s.level,2);assert.equal(s.leaves,44);assert.equal(s.includesRehearsal,true);
  assert.equal(summarizeLearningRewards(d,course).leaves,1);
  d.rehearsal=null;addFlowers(d,11);d.garden.growth={reward_version:2,leaf_floor:1,flower_floor:11,baseline:[]};
  s=summarizeGardenStatus(d,course);assert.equal(s.level,2);
  assert.equal(s.features.find(f=>f.key==='flower-color').status,'unlocked');
  assert.throws(()=>summarizeGardenStatus({...d,garden:null},course),/invalid_garden_response/);
});

test('全班等級與解鎖共用個人判定，跨人不混權限，未連結與衝突不冒充第一級',()=>{
  const one=gardenData(),two=gardenData(),old=gardenData();
  two.awards=Array.from({length:44},(_,i)=>award(String(i),2));addFlowers(two,10);
  two.garden.growth={reward_version:2,leaf_floor:44,flower_floor:10,baseline:summarizeLearningRewards(two,course).items};
  two.garden.has_growth=true;two.garden.unlocks=[{key:'pet:dog',course_id:'grade3-114-2'}];
  old.garden.growth={reward_version:1,leaf_floor:44,flower_floor:10,baseline:[]};
  const rows=[one,two,old,{identity:{mapping:'unlinked'}},{identity:{mapping:'conflict'}}].map((rewards,i)=>({class_code:'603',seat_no:i+1,student_code:'6030'+(i+1),display_name:'合成同學',rewards:{...rewards,identity:rewards.identity||{mapping:'linked'}}}));
  const s=summarizeClassGardenRewards({class_code:'603',total:rows.length,items:rows},course);
  assert.equal(s.items[0].garden.level,1);assert.equal(s.items[1].garden.level,2);assert.equal(s.items[2].garden.level,null);
  assert.equal(s.items[3].garden,null);assert.equal(s.items[4].garden,null);
  assert.equal(s.items[0].garden.features.find(f=>f.key==='pet:dog').status,'locked');
  assert.equal(s.items[1].garden.features.find(f=>f.key==='pet:dog').status,'unlocked');
  for(let i=0;i<3;i++)assert.deepEqual(s.items[i].garden,summarizeGardenStatus(rows[i].rewards,course));
  assert.throws(()=>summarizeClassGardenRewards({class_code:'603',total:1,items:[{...rows[0],rewards:{...rows[0].rewards,garden:undefined}}]},course),/invalid_garden_response/);
});

test('剩餘解鎖條件按目前成果扣除：升級葉花同時達標、寵物葉花擇一、保留門檻不混算',()=>{
  const d=gardenData();d.awards=Array.from({length:58},(_,i)=>award(String(i),2));addFlowers(d,9);
  let s=summarizeGardenStatus(d,course);assert.equal(s.levelRemaining,'達到第二級還差 1 朵花。');
  assert.equal(s.features.find(f=>f.key==='level2-scene').remaining,s.levelRemaining);
  assert.ok(s.features.find(f=>f.key==='pet:cat').remaining.includes('升級後還需新增 12 片葉子或 3 朵花'));
  d.awards=d.awards.slice(0,44);addFlowers(d,10);d.garden.growth={reward_version:2,leaf_floor:44,flower_floor:10,baseline:summarizeLearningRewards(d,course).items};
  d.awards.push(award('more1',2),award('more2',2),award('more3',2));addFlowers(d,11);
  s=summarizeGardenStatus(d,course);assert.ok(s.features.find(f=>f.key==='pet:cat').remaining.includes('還差 9 片葉子或 2 朵花'));
  d.awards=d.awards.slice(0,43);addFlowers(d,10);d.garden.growth.leaf_floor=42;d.garden.growth.flower_floor=11;
  s=summarizeGardenStatus(d,course);assert.equal(s.levelRemaining,'達到第二級還差 1 片葉子；或依另一組保留門檻，還差 1 朵花。');
  const fresh=gardenData();addFlowers(fresh,2);assert.equal(summarizeGardenStatus(fresh,course).features[0].remaining,'還差 1 朵花。');
});

test('班級差額摘要與全部條件：不漏未解鎖功能、不重列已解鎖、不猜未知帳號',()=>{
  const d=gardenData();d.awards=Array.from({length:58},(_,i)=>award(String(i),2));addFlowers(d,9);
  const s=summarizeGardenStatus(d,course),brief=classUnlockConditions(s),full=classUnlockConditions(s,true);
  assert.equal(brief.message,'達到第二級還差 1 朵花。');assert.equal(brief.groups.length,1);
  assert.ok(brief.groups[0].remaining.includes('升級後還需新增 12 片葉子或 3 朵花'));
  assert.deepEqual(full.groups.flatMap(g=>g.labels).sort(),s.features.filter(f=>f.status!=='unlocked').map(f=>f.label).sort());
  assert.ok(full.groups.every(g=>s.features.some(f=>f.remaining===g.remaining&&f.status===g.status)));
  assert.equal(full.groups.some(g=>g.labels.includes('花朵換色')),false);assert.equal(full.hiddenGroups,0);
  assert.deepEqual(classUnlockConditions(null).groups,[]);assert.ok(classUnlockConditions(null).message.includes('帳號對應確認'));
  const complete={...s,level:2,synchronizationPending:false,features:s.features.map(f=>({...f,status:'unlocked'}))};
  assert.equal(classUnlockConditions(complete).message,'目前所有功能均已解鎖。');
  const unknown={...s,level:null,levelRemaining:'成長紀錄待同步後確認。',features:[{label:'功能',status:'unknown',remaining:'成長紀錄待同步後確認。'}]};
  assert.equal(classUnlockConditions(unknown,true).groups[0].status,'unknown');
});
