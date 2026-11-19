import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {newDocument,validateDocument} from '../shared/quiz-document.mjs';
import {readingPresentation} from '../shared/quiz-reading-presentation.mjs';
import {readingWorkbenchSupported} from '../shared/quiz-reading-workbench.mjs';
import {matchingPresentation} from '../shared/quiz-matching-presentation.mjs';

// Input files are private exports. Output deliberately contains counts only:
// no questions, answers, source identifiers, media URLs or local source paths.
export function auditCoverage(pool,courses,sourceTypes){
 const definitions=new Map(courses.map(c=>[c.id,c]));
 const types=new Map(sourceTypes.rows.map(r=>[r.question_id,r]));
 const groups=new Map(),seen=new Set();
 let missing=0,invalid=0;
 for(const row of pool){
  if(seen.has(row.question_id))throw Error('duplicate_question_id');seen.add(row.question_id);
  const original=types.get(row.question_id),names=[...new Set(original?.source_types?.map(t=>t.name).filter(Boolean)??[])].sort();
  if(!names.length)missing++;
  const courseId=row.course_id??'legacy-unassigned',course=definitions.get(courseId),q=row.question;
  // Preserve multiple publisher labels on one source as one row, not two questions.
  const key=JSON.stringify([courseId,names]);
  let group=groups.get(key);
  if(!group){group={course:courseId,grade:course?.grade??null,subject:course?.definition?.subject??'舊題庫待對應',publisher:course?.definition?.publisher??'',sourceTypes:names,total:0,usable:0,held:0,formats:{},inputs:{},images:0,audio:0,reading:0,readingWorkbench:0,readingExcluded:{},expression:0,sketch:0,openSketch:0,invalid:0,validation:'待本輪操作驗收'};groups.set(key,group);}
  group.total++;row.usable?group.usable++:group.held++;
  const count=(o,k)=>o[k]=(o[k]??0)+1;
  count(group.formats,q.type);
  for(const f of q.fields??[])count(group.inputs,f.input);
  const media=[];
  const walk=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(walk);return;}if(Array.isArray(value.media))media.push(...value.media);for(const [k,v]of Object.entries(value))if(k!=='media'&&k!=='answer'&&k!=='explanation')walk(v);};
  walk(q);
  if(media.some(m=>m.kind==='image'))group.images++;
  if(media.some(m=>m.kind==='audio'))group.audio++;
  if(q.work?.input==='expression')group.expression++;
  if(q.work?.input==='sketch')group.sketch++;
  if(q.type==='open'&&q.fields?.some(f=>f.input==='sketch'))group.openSketch++;
  try{const d=newDocument();d.blocks[0].questions=[q];validateDocument(d);}catch{group.invalid++;invalid++;}
  try{const plan=readingPresentation(q);if(plan&&!plan.standalone){group.reading++;if(readingWorkbenchSupported(q,plan))group.readingWorkbench++;else count(group.readingExcluded,q.work?'含計算過程':matchingPresentation(q)?'連線題保留整體操作':'其他版型限制');}}catch{count(group.readingExcluded,'解析失敗');}
 }
 return {schema:1,scope:'一般題庫當下紀錄；不代表完整原始光碟、考古卷或學生操作已驗收',total:pool.length,usable:pool.filter(r=>r.usable).length,missingSourceTypes:missing,invalid,groups:[...groups.values()].sort((a,b)=>a.course.localeCompare(b.course)||a.sourceTypes.join().localeCompare(b.sourceTypes.join()))};
}

export function auditPastCoverage(versions,papers){
 const active=new Set(papers.filter(p=>p.enabled).map(p=>p.active_version)),groups=new Map();
 const paperByVersion=new Map(papers.filter(p=>p.enabled).map(p=>[p.active_version,p]));
 let activeVersions=0,totalGroups=0;
 for(const v of versions){if(!active.has(v.id))continue;activeVersions++;
  const catalog=v.document.catalog??{},grade=catalog.grade??paperByVersion.get(v.id)?.grade??null,subject=catalog.subject||'未標科目';
  for(const g of v.document.groups??[]){totalGroups++;const key=JSON.stringify([grade,subject,g.kind]);
   let entry=groups.get(key);if(!entry){entry={grade,subject,kind:g.kind,total:0,fields:0};groups.set(key,entry);}entry.total++;entry.fields+=(g.fields??[]).length;
  }
 }
 return {scope:'啟用考古卷的當前固定版本；kind 是平台契約，不冒稱書商原始題型',papers:papers.length,enabledPapers:active.size,activeVersions,missingActiveVersions:active.size-activeVersions,historicalVersions:versions.length,totalGroups,groups:[...groups.values()]};
}

async function main(){
 const args=process.argv.slice(2),get=name=>{const at=args.indexOf('--'+name);if(at<0||!args[at+1])throw Error('missing --'+name);return args[at+1];};
 const read=async name=>JSON.parse(await fs.readFile(get(name),'utf8'));
 const result=auditCoverage(await read('pool'),await read('courses'),await read('source-types'));
 if(args.includes('--past'))result.past=auditPastCoverage(await read('past'),(await read('past-papers')).map(p=>p.paper??p));
 await fs.writeFile(get('out'),JSON.stringify(result,null,2)+'\n','utf8');
 console.log(JSON.stringify({total:result.total,usable:result.usable,groups:result.groups.length,missingSourceTypes:result.missingSourceTypes,invalid:result.invalid}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
