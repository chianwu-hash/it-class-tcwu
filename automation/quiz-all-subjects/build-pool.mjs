// Convert only existing private, source-traceable catalogs. No network or source mutation.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';
const base='automation/output/quiz/all-midterm-local',out='automation/output/quiz/all-subjects-pool';await fs.mkdir(out+'/qa',{recursive:true});
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),hash=x=>createHash('sha256').update(x).digest('hex');
const plans=await read(base+'/runtime/paper-plan.json'),inventory=await read('automation/output/quiz/drive-library/inventory.json'),manifest=await read('automation/output/quiz/drive-library/manifest.json'),registered=await read('automation/output/quiz/drive-library/supabase-assets.json');
const formulaMap=await read(out+'/formula-map.json');
const owner=new URL(registered[0].url).pathname.split('/')[1],assets={},pending=[],pool=[],courses=[];
const assetsByHash=new Map(registered.map(a=>[new URL(a.url).pathname.split('/').at(-1),a]));
const dataSets=[['hanlin-g6-math',6,'數學','翰林'],['hanlin-g3-science',3,'自然','翰林'],['kang-g3-ch',3,'國語','康軒'],['kang-g6-ch',6,'國語','康軒'],['kang-g3-so',3,'社會','康軒'],['nani-g6-science',6,'自然','南一'],['nani-g6-social',6,'社會','南一'],['hanlin-g3-english',3,'英語','翰林'],['kang-g6-en',6,'英語','康軒']];
function combine(a,b){if(!a?.text&&!a?.media?.length)return b;const offset=a.media?.length||0,layout=structuredClone(b.layout||[{type:'paragraph',runs:[{type:'text',text:b.text}]}]);const shift=runs=>runs.forEach(r=>{if(r.type==='image')r.media_index+=offset;});for(const p of layout)if(p.type==='paragraph')shift(p.runs);else for(const row of p.rows)for(const cell of row)shift(cell);return {text:[a.text,b.text].filter(Boolean).join('\n'),media:[...a.media||[],...b.media||[]],layout:[...structuredClone(a.layout||[{type:'paragraph',runs:[{type:'text',text:a.text||''}]}]),...layout]};}
for(const [folder,grade,subject,publisher] of dataSets){
 const dir=base+'/'+folder,scope=plans.filter(x=>x.course===folder),unitTitles=Object.fromEntries(scope.map(x=>[Number(x.unit),x.unit_title])),courseId='115-1-'+folder;
 const course={id:courseId,grade,definition:{school_year:'115',volume:`${grade}年級上學期`,subject,publisher,units:unitTitles},enabled:true};courses.push(course);
 let rows,sections=[];
 if(folder==='hanlin-g6-math'||folder==='hanlin-g3-science'){
  sections=await read(dir+'/catalog/sections.json');const sm=new Map(sections.map(s=>[s.id,s]));const unitsFor=sids=>[...new Set(sids.flatMap(id=>{let s=sm.get(id),guard=0;while(s?.parentId&&guard++<15)s=sm.get(s.parentId);const m=s?.name.match(/^(\d+)_/);return m&&unitTitles[Number(m[1])]?[Number(m[1])]:[];}))];
  rows=(await read(dir+'/catalog/native-records.json')).map(r=>({id:r.id,question:r.single_choice,difficulty:r.difficulty,units:unitsFor(r.sections),sections:r.sections,publisher_explanation_present:r.publisher_explanation_present}));
 }else rows=(await read(dir+'/catalog.json')).map(r=>({...r,units:[Number(r.unit)]}));
 const ids=new Map();for(const r of rows)ids.set(r.id,(ids.get(r.id)||0)+1);
 let added=0;
 for(const r of rows){try{
  if(!r.question||r.question.type!=='single'||ids.get(r.id)>1)throw Error('非獨立單選或同原題多子題，待題組流程');
  if(!r.units.length||r.units.some(n=>!unitTitles[n]))throw Error('非本次期中範圍或單元無法可靠對應');
  if(![-3,0,3].includes(r.difficulty))throw Error('難度未核對');
  const q=structuredClone(r.question),originalId=q.id;
  if(/承上題|根據上題|接續上題/.test(q.prompt.text))throw Error('依賴其他題目');
  if(/[①②③④]|選項\s*[1-4A-D]|[（(][1-4][)）].{0,3}(?:皆|都)對/.test(q.explanation.text))throw Error('解析或題意引用原選項位置');
  if(q.options.length<2||q.options.length>8||!q.options.some(o=>o.id===q.answer.option_id))throw Error('答案或選項結構不符');
  if(!q.explanation.text?.trim()&&!q.explanation.media?.length)q.explanation={text:'這一題目前沒有詳細解析，可以先核對正確答案。',media:[]};
  q.prompt=combine(r.material,q.prompt);
  const formulaAudit=[];
  if(folder==='hanlin-g6-math')for(const c of [q.prompt,q.explanation,...q.options.map(o=>o.content)])if(c.layout){
   const groups=c.layout.flatMap(p=>p.type==='paragraph'?[p.runs]:p.rows.flat());
   for(const runs of groups)for(let i=0;i<runs.length;i++){const run=runs[i];if(run.type!=='image')continue;const m=c.media[run.media_index],key=path.parse(new URL(m.url).pathname).name,f=formulaMap[key];if(f){runs[i]={type:'text',text:'$'+f.latex+'$'};formulaAudit.push(f);}}
   const used=new Set(c.media.flatMap((m,i)=>m.kind==='audio'?[i]:[]));for(const runs of groups)for(const r of runs)if(r.type==='image')used.add(r.media_index);
   const remap=new Map([...used].sort((a,b)=>a-b).map((old,i)=>[old,i]));c.media=c.media.filter((_,i)=>used.has(i));for(const runs of groups)for(const r of runs)if(r.type==='image')r.media_index=remap.get(r.media_index);
   c.text=groups.map(runs=>runs.filter(r=>r.type==='text').map(r=>r.text).join('')).join('\n').trim();
  }
  if(/[\uE000-\uF8FF]/u.test(JSON.stringify(q)))throw Error('未知私用區字碼');
  if(!/標點|符號|句號|逗號|句讀/.test(q.prompt.text))for(const option of q.options){const c=option.content;if(c.text?.trim().length>1&&/[。]\s*$/.test(c.text)){c.text=c.text.replace(/。\s*$/,'');if(c.layout){const all=c.layout.flatMap(p=>p.type==='paragraph'?p.runs:p.rows.flat(2));const last=all.filter(x=>x.type==='text').at(-1);if(last)last.text=last.text.replace(/。\s*$/,'');}}}
  async function media(c){for(const m of c.media||[]){const old=m.url,name=path.basename(new URL(old).pathname);let file=path.join(dir,m.kind==='audio'?'web-audio':'web-images',name);try{await fs.access(file);}catch{file=path.join(base,'web-media',name);}
   const bytes=await fs.readFile(file),sha=hash(bytes),mime=m.kind==='audio'?'audio/mpeg':({'.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[path.extname(file).toLowerCase()]||'image/png');
   if(m.kind==='image'&&!manifest.assets[sha]?.verified)throw Error('圖片未驗證上傳：'+sha);
   assets[sha]={hash:sha,path:file,mime,bytes:bytes.length,registered:assetsByHash.has(sha),drive:!!manifest.assets[sha]?.verified};m.url=`https://quiz-media.invalid/${owner}/${sha}`;m.alt=m.kind==='audio'?'聽力音檔':'圖片';
  }}
  await media(q.prompt);for(const o of q.options)await media(o.content);await media(q.explanation);
  const optionFingerprints=q.options.map(o=>hash(JSON.stringify(o.content)));if(new Set(optionFingerprints).size!==q.options.length)throw Error('重複選項');
  q.id='mp_'+hash(courseId+'|'+r.id+'|native-v2-formula|'+hash(JSON.stringify(r))).slice(0,32);
  validateDocument({schema:1,title:'期中題池核對',catalog:course.definition,blocks:[{id:'b_'+q.id,material:{text:'',media:[]},questions:[q]}]});
  const knowledge=(r.sections||[]).map(id=>sections.find(s=>s.id===id)).filter(s=>s?.isKnowledgeNode).sort((a,b)=>a.id.localeCompare(b.id));
  const detailed=!!r.publisher_explanation_present&&(!!q.explanation.media.length||!!q.explanation.text.trim()&&!/書商未提供這一題|這一題目前沒有詳細解析/.test(q.explanation.text));
  const row={question_id:q.id,source_item_id:String(r.id),group_key:hash(courseId+'|'+JSON.stringify([q.prompt,q.options.map(o=>o.content)])),unit_ids:r.units,knowledge_code:knowledge.length?knowledge.map(s=>s.id).join('+'):'unmapped_'+q.id,knowledge_name:knowledge.length?knowledge.map(s=>s.name).join('、'):'尚未核對學習重點',difficulty:r.difficulty,source_version:hash('native-v2-formula|'+JSON.stringify(r)),publisher_explanation:detailed,question:q,checks:{validated:true,source_catalog:folder,source_question_id:originalId,material_preserved:!!r.material,knowledge_reliable:knowledge.length>0,formulas:formulaAudit},course_id:courseId,knowledge_reliable:knowledge.length>0};pool.push(row);added++;
 }catch(e){pending.push({course:courseId,id:r.id,reason:e.message});}}
 console.log(JSON.stringify({course:courseId,source:rows.length,prepared:added}));
}
await fs.writeFile(out+'/pool.json',JSON.stringify(pool),'utf8');await fs.writeFile(out+'/courses.json',JSON.stringify(courses),'utf8');await fs.writeFile(out+'/assets.json',JSON.stringify(assets),'utf8');await fs.writeFile(out+'/pending.json',JSON.stringify(pending),'utf8');
const report={at:new Date().toISOString(),prepared:pool.length,courses:courses.map(c=>({id:c.id,total:pool.filter(r=>r.course_id===c.id).length,units:Object.keys(c.definition.units).map(u=>({id:u,count:pool.filter(r=>r.course_id===c.id&&r.unit_ids.includes(Number(u))).length}))})),pending:pending.length,pool_sha256:hash(await fs.readFile(out+'/pool.json')),assets:Object.keys(assets).length,newAudio:Object.values(assets).filter(a=>a.mime.startsWith('audio')&&!a.registered).length};if(report.courses.some(c=>!c.total||c.units.some(u=>!u.count)))throw Error('存在未覆蓋科目或單元，請檢查pending');await fs.writeFile(out+'/qa/build-report.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
