import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {fingerprint} from './review.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
export const courseIds=['115-1-kang-g4-chinese','115-1-nani-g4-math','115-1-nani-g4-science','115-1-hanlin-g4-social','115-1-hanlin-g4-english'];
export function candidates(pool,s){return pool.filter(p=>p.usable&&p.knowledge_reliable&&p.publisher_explanation&&p.course_id===s.course_id&&p.knowledge_code===s.knowledge_code&&p.group_key!==s.group_key&&p.difficulty<=s.difficulty);}
export function coverage(pool){return courseIds.map(course_id=>{const ps=pool.filter(p=>p.course_id===course_id);return {course_id,total:ps.length,reliable:ps.filter(p=>p.knowledge_reliable).length,held:ps.filter(p=>!p.knowledge_reliable).length,groups:new Set(ps.map(p=>p.knowledge_code)).size,explainedCandidates:ps.filter(p=>p.usable&&p.knowledge_reliable&&p.publisher_explanation).length,extendableSources:ps.filter(p=>p.usable&&p.knowledge_reliable&&candidates(pool,p).length).length};});}
function index(groups){const result=new Map();for(const[code,[name,ids]]of Object.entries(groups))for(const id of ids.split(' ').filter(Boolean)){if(result.has(id))throw Error('duplicate_manual_review:'+id);result.set(id,{code,name});}return result;}
export function prepareExplanation(question,present){
 const next=structuredClone(question.explanation),text=next.text||'',markers=text.match(/[①②③④]/g)||[];
 const match=/^(?:詳解|解析)?\s*[:：]?\s*([①②③④])\s*/.exec(text);
 let removed=null;
 if(present&&markers.length===1&&match){removed=match[1];next.text=text.replace(removed,'');let count=0;
  const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v.type==='text'&&typeof v.text==='string'&&v.text.includes(removed)){v.text=v.text.replace(removed,'');count++;}for(const[k,x]of Object.entries(v))if(k!=='text')visit(x);}};visit(next.layout);
  if(count>1)throw Error('explanation_layout_reference_mismatch');
 }
 const safe=Boolean(present&&next.text.trim()&&!/[①②③④]|選項\s*[1-4A-D]|故選\s*[1-4A-D]/.test(next.text));
 return {explanation:next,publisher_explanation:safe,status:!present?'publisher_not_provided':safe?(removed?'leading_original_option_number_removed':'verified_original'): 'position_dependent_original',removed};
}
export async function review(snapshot,publisherRoot){
 if(snapshot.pool.length!==1562||snapshot.courses.length!==5)throw Error('scope_changed');
 const groups=await read(path.join(here,'g4-reviewed-groups.json')),math=await read(path.join(here,'g4-math-review.json')),maps=Object.fromEntries(Object.entries(groups).map(([s,g])=>[s,index(g)])),mathOverrides=index(math.overrides);
 const ch=await read(path.join(publisherRoot,'kang-g4-ch/metadata.private.json')),nani=await read(path.join(publisherRoot,'discs/nani/metadata.private.json')),social=await read(path.join(publisherRoot,'hanlin-g4-social/catalog/native-records.json')),english=await read(path.join(publisherRoot,'hanlin-g4-english/catalog/grade4-catalog.private.json'));
 const socialSections=await read(path.join(publisherRoot,'hanlin-g4-social/catalog/sections.json')),englishSections=await read(path.join(publisherRoot,'hanlin-g4-english/catalog/sections.json'));
 const hashes={};for(const rel of ['kang-g4-ch/metadata.private.json','discs/nani/metadata.private.json','hanlin-g4-social/catalog/native-records.json','hanlin-g4-english/catalog/grade4-catalog.private.json','hanlin-g4-social/catalog/sections.json','hanlin-g4-english/catalog/sections.json'])hashes[rel]=createHash('sha256').update(await fs.readFile(path.join(publisherRoot,rel))).digest('hex');
 const assignments=[],used={chinese:new Set(),science:new Set(),social:new Set(),english:new Set()},held={'ECH1507001655':'原選項將成語印為「競競業業」，與通常寫法不符；保留原題，暫不作延伸來源或候選。'};
 for(const p of snapshot.pool){
  if(!courseIds.includes(p.course_id))throw Error('course_out_of_scope');let code,name,evidence,kind,match,present=p.publisher_explanation;
  if(p.course_id==='115-1-kang-g4-chinese'){
   const rs=ch.QuesMaster.filter(r=>r.QUES_NO===p.source_item_id);if(rs.length!==1)throw Error('chinese_source_not_unique');const r=rs[0];if(!p.unit_ids.includes(Number(r.LESN_NUM)))throw Error('chinese_unit_mismatch');
   evidence={publisher_knowledge:r.KNOW_SPOT.split(';').filter(Boolean).sort(),publisher_unit:r.LESN_NUM,publisher_type:r.QUES_TYPE};
   if(p.knowledge_reliable){code=p.knowledge_code;name=p.knowledge_name;evidence.method='retained_previous_verified_publisher_codes';}
   else{match=maps.chinese.get(p.source_item_id);if(!match)throw Error('missing_chinese_review:'+p.source_item_id);used.chinese.add(p.source_item_id);const chapter=ch.CodeChapter.find(c=>c.LESN_NUM===r.LESN_NUM);code='g4-reviewed-ch:'+r.LESN_NUM+':'+match.code;name=chapter.LESN_NAME.trim()+'：'+match.name;evidence.method='actual_question_and_options_reviewed; mixed_publisher_codes_not_used_for_pairing';}
  }else if(p.course_id.includes('nani')){
   kind=p.course_id.endsWith('math')?'math':'science';const rs=nani.Subject.filter(r=>String(r.Subject_No)===p.source_item_id);if(rs.length!==1)throw Error('nani_source_not_unique');const r=rs[0],d=nani.Directory.find(d=>d.Directory_No===r.Directory_No);
   if(!d||d.Course_No!==(kind==='math'?1155:1153)||p.unit_ids.length!==1||p.unit_ids[0]!==d.Section_1)throw Error('nani_unit_mismatch');
   if(kind==='math'){match=mathOverrides.get(p.source_item_id)||((x)=>x&&{code:x[0],name:x[1]})(math.directoryDefaults[d.Section12]);}
   else{match=maps.science.get(p.source_item_id);used.science.add(p.source_item_id);}if(!match)throw Error('missing_'+kind+'_review:'+p.source_item_id);
   code='g4-reviewed-'+kind+':'+match.code;name=match.name;evidence={publisher_directory:d.Directory_No,publisher_section:d.Section12,publisher_title:d.Directory_Name,publisher_outline:r.Outline_Con,method:'actual_question_options_and_required_diagram_reviewed_with_publisher_section'};
  }else{
   kind=p.course_id.endsWith('social')?'social':'english';match=maps[kind].get(p.source_item_id);if(!match)throw Error('missing_'+kind+'_review:'+p.source_item_id);used[kind].add(p.source_item_id);
   const r=(kind==='social'?social:english).find(r=>r.id===p.source_item_id);if(!r||r.unit&&r.unit!==p.unit_ids[0])throw Error('hanlin_source_mismatch');const sections=kind==='social'?socialSections:englishSections;
   if(r.sections.some(id=>!sections.some(s=>s.id===id)))throw Error('unknown_hanlin_section');
   if(kind==='social'){present=Boolean(r.publisher_explanation_present);if(fingerprint(r.single_choice.explanation)!==fingerprint(p.question.explanation)){
    // Media URL normalization is allowed only when all source text/layout remain identical.
    if(r.single_choice.explanation.text!==p.question.explanation.text||fingerprint(r.single_choice.explanation.layout)!==fingerprint(p.question.explanation.layout))throw Error('social_explanation_source_mismatch');}}
   code='g4-reviewed-'+kind+':'+match.code;name=match.name;evidence={publisher_sections:r.sections,method:'actual_question_options_and_required_diagram_reviewed_with_publisher_sections',publisher_explanation_present:present};
  }
  const prepared=prepareExplanation(p.question,present),next=structuredClone(p.question);next.explanation=prepared.explanation;
  assignments.push({question_id:p.question_id,source_item_id:p.source_item_id,course_id:p.course_id,source_version:p.source_version,question_sha256:fingerprint(p.question),updated_question_sha256:fingerprint(next),knowledge_code:code,knowledge_name:name,knowledge_reliable:!held[p.source_item_id],hold_reason:held[p.source_item_id]||null,publisher_explanation:prepared.publisher_explanation,explanation_review:{source_present:Boolean(present),status:prepared.status,removed_marker:prepared.removed},evidence});
 }
 for(const[k,m]of Object.entries(maps))if(used[k].size!==m.size)throw Error('unused_manual_review:'+k+':'+used[k].size+'/'+m.size);
 const updated=snapshot.pool.map(p=>{const a=assignments.find(a=>a.question_id===p.question_id),q=structuredClone(p.question);q.explanation=prepareExplanation(p.question,a.explanation_review.source_present).explanation;return {...p,...a,question:q};});
 return {schema:2,reviewed_at:'2026-11-01',review_method:'逐題題文選項與必要圖表對照書商章節／原代碼；保留已核分類；混雜原代碼依實題重分；僅移除可獨立成立解析的單一前導舊序號，不創作解析',source_metadata_sha256:hashes,assignments,coverage:coverage(updated)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const[source,publisherRoot,out]=process.argv.slice(2),result=await review(await read(source),publisherRoot);await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.coverage));
}
