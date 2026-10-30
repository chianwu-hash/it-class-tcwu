// Data-only classification. Private publisher questions are never copied to the repository.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const moduleFile=fileURLToPath(import.meta.url),here=path.dirname(moduleFile);
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const fingerprint=v=>hash(JSON.stringify(canonical(v)));
export const courses=['115-1-kang-g6-ch','115-1-kang-g6-en','115-1-nani-g6-science','115-1-nani-g6-social'];
const held={
 '675931':'雲霧為水蒸氣與霜由凝結形成兩項敘述均有疑義；待原題複核，不供延伸。',
 '1504811':'題幹問推翻哪個政權，四個選項卻描述戰後族群情況；待原題複核，不供延伸。'
};
export function candidates(pool,source){return pool.filter(p=>p.usable&&p.knowledge_reliable&&p.publisher_explanation&&p.course_id===source.course_id&&p.knowledge_code===source.knowledge_code&&p.group_key!==source.group_key&&p.difficulty<=source.difficulty);}
export function coverage(pool){return courses.map(course_id=>{const ps=pool.filter(p=>p.course_id===course_id),available=ps.filter(p=>p.usable&&p.knowledge_reliable&&candidates(pool,p).length);return {course_id,total:ps.length,classified:ps.filter(p=>p.knowledge_reliable).length,held:ps.filter(p=>!p.knowledge_reliable).length,groups:new Set(ps.map(p=>p.knowledge_code)).size,extendable_sources:available.length,explained_candidates:ps.filter(p=>p.publisher_explanation&&p.knowledge_reliable).length};});}
export async function review(snapshot,publisherRoot){
 const labels=await read(path.join(here,'kang-knowledge-labels.json')),maps={},sourceHashes={};
 for(const [folder,file] of [['nani-g6-science','g6-science.json'],['nani-g6-social','g6-social.json']]){
  const groups=await read(path.join(here,file)),byId=new Map();
  for(const [key,[name,ids]] of Object.entries(groups))for(const id of ids.split(' ')){if(byId.has(id))throw Error('duplicate_review '+folder+' '+id);byId.set(id,{code:folder+':'+key,name});}
  maps[folder]=byId;
 }
 const metadata={};for(const course of courses){const folder=course.slice(6),bytes=await fs.readFile(path.join(publisherRoot,folder,'metadata.json'));sourceHashes[course]=hash(bytes.toString('utf8'));metadata[folder]=JSON.parse(bytes);}
 const assignments=[];
 for(const p of snapshot.pool){
  if(!courses.includes(p.course_id))throw Error('out_of_scope');
  const folder=p.course_id.slice(6),m=metadata[folder];let code,name,evidence;
  if(folder.startsWith('kang-')){
   const matches=m.QuesMaster.filter(r=>r.QUES_NO===p.source_item_id);if(matches.length!==1)throw Error('source_identity_not_unique '+p.source_item_id);
   const r=matches[0],codes=r.KNOW_SPOT?.split(';').filter(Boolean).sort();if(!codes?.length)throw Error('missing_publisher_knowledge '+p.source_item_id);
   const chapter=m.CodeChapter.find(c=>c.LESN_NUM===r.LESN_NUM);if(!chapter||!p.unit_ids.includes(Number(r.LESN_NUM)))throw Error('source_unit_mismatch '+p.source_item_id);
   const skills=codes.filter(c=>!c.startsWith('ECHa'));if(!skills.length||skills.some(c=>!labels[c]))throw Error('unknown_knowledge_label '+p.source_item_id);
   code=folder+':'+codes.join('+');name=chapter.LESN_NAME.trim()+'：'+[...new Set(skills.map(c=>labels[c]))].join('、');
   evidence={publisher_knowledge:codes,publisher_unit:r.LESN_NUM,publisher_type:r.QUES_TYPE};
  }else{
   const match=maps[folder].get(p.source_item_id);if(!match)throw Error('missing_review '+p.source_item_id);
   const matches=m.items.filter(r=>String(r.Subject_No)===p.source_item_id);if(matches.length!==1)throw Error('source_identity_not_unique '+p.source_item_id);
   const r=matches[0],dir=m.directories.find(d=>d.Directory_No===r.Directory_No);if(!dir||!p.unit_ids.includes(dir.Section_1))throw Error('source_unit_mismatch '+p.source_item_id);
   code=match.code;name=match.name;evidence={publisher_directory:dir.Directory_No,publisher_section:dir.Section12,publisher_title:dir.Directory_Name,publisher_outline:r.Outline_Con};
  }
  assignments.push({question_id:p.question_id,source_item_id:p.source_item_id,course_id:p.course_id,question_sha256:fingerprint(p.question),source_version:p.source_version,knowledge_code:code,knowledge_name:name,knowledge_reliable:!held[p.source_item_id],hold_reason:held[p.source_item_id]||null,evidence});
 }
 for(const folder of ['nani-g6-science','nani-g6-social']){const expected=snapshot.pool.filter(p=>p.course_id==='115-1-'+folder);if(expected.length!==maps[folder].size)throw Error('review_scope_mismatch '+folder);}
 const updated=snapshot.pool.map(p=>({...p,...assignments.find(a=>a.question_id===p.question_id)}));
 const report=coverage(updated);if(report.some(c=>!c.extendable_sources))throw Error('course_has_no_extension');
 return {schema:1,reviewed_at:'2026-10-30',review_method:'書商知識代碼／章節交叉核對；自然社會逐題題幹與選項分類；疑義題保留待查；不改題幹答案解析',source_metadata_sha256:sourceHashes,assignments,coverage:report};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(moduleFile)){
 const [snapshotFile,publisherRoot,output]=process.argv.slice(2);const result=await review(await read(snapshotFile),publisherRoot);await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.coverage));
}
