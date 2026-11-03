// Compare a verified deployed source snapshot with the server-owned catalogue.
// Never apply SQL here; differences require explicit review and a guarded migration.
import fs from 'node:fs/promises';
import path from 'node:path';
export const catalogKey = r => [r.course_id,r.week_code,r.activity_key].join(':');
export function expectedCatalog(courses, foundationKeys){
 const rows=courses.flatMap(c=>c.activities.map(a=>({course_id:c.id,week_code:a.weekCode,activity_key:a.activityKey,kind:a.type,total_levels:Number(a.totalLevels)||1,reward_mode:a.rewardMode||null,page:a.pageHref})));
 for(const course_id of ['grade3-115-1','grade6-115-1'])for(const activity_key of foundationKeys)rows.push({course_id,week_code:'foundation',activity_key,kind:'foundation',total_levels:1,reward_mode:null});
 if(new Set(rows.map(catalogKey)).size!==rows.length)throw Error('duplicate_catalog_key');
 return rows;
}
export function compareCatalog(expected,actual){
 const found=new Map(actual.map(r=>[catalogKey(r),r]));
 const missing=[],mismatched=[];
 for(const r of expected){const a=found.get(catalogKey(r));if(!a)missing.push(r);else if(['kind','total_levels','reward_mode'].some(k=>r[k]!==a[k]))mismatched.push({expected:r,actual:a});}
 const keys=new Set(expected.map(catalogKey));
 return {expected:expected.length,actual:actual.length,missing,mismatched,extra:actual.filter(a=>!keys.has(catalogKey(a)))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 const dir=process.argv[2];if(!dir)throw Error('verified_source_snapshot_directory_required');
 const load=async name=>import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(path.join(dir,name),'utf8')).toString('base64'));
 const [config,en,zh]=await Promise.all([load('reward-tree-config.js'),load('typing-foundation-curriculum.mjs'),load('zhuyin-foundation-curriculum.mjs')]);
 const expected=expectedCatalog(config.getRewardTreeCourses(),[...en.lessons,...zh.zhuyinLessons].map(l=>l.key));
 const database=JSON.parse(await fs.readFile(path.join(dir,'database.json'),'utf8'));
 const report=compareCatalog(expected,database.catalog);
 await fs.writeFile(path.join(dir,'expected.json'),JSON.stringify(expected,null,2));
 await fs.writeFile(path.join(dir,'audit.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
