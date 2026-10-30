import fs from 'node:fs/promises';
const config=await fs.readFile('shared/reward-tree-config.js','utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(config).toString('base64'));
const {lessons}=await import('../shared/typing-foundation-curriculum.mjs');const {zhuyinLessons}=await import('../shared/zhuyin-foundation-curriculum.mjs');
const entries=mod.getRewardTreeCourses().flatMap(c=>c.activities.map(a=>[c.id,a.weekCode,a.activityKey,a.type,Number(a.totalLevels)||1,a.rewardMode]));
for(const course of ['grade3-115-1','grade6-115-1'])for(const l of [...lessons,...zhuyinLessons])entries.push([course,'foundation',l.key,'foundation',1,null]);
const q=s=>s==null?'null':"'"+String(s).replaceAll("'","''")+"'";
await fs.writeFile('supabase/garden-catalog.sql','begin;\ninsert into public.garden_reward_catalog(course_id,week_code,activity_key,kind,total_levels,reward_mode) values\n'+entries.map(v=>'('+v.map(q).join(',')+')').join(',\n')+'\non conflict(course_id,week_code,activity_key) do update set kind=excluded.kind,total_levels=excluded.total_levels,reward_mode=excluded.reward_mode;\ncommit;\n');
console.log('catalogue entries',entries.length);
