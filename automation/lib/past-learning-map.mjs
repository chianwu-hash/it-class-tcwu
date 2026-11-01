import {createHash} from 'node:crypto';
export const learningEntries=map=>map?.schema===2?map.questions:[map];
export function learningConcepts(map,entry){
 return map.schema===2?entry.conceptIds.map(id=>map.concepts.find(c=>c.id===id)):entry.concepts;
}
export function validateLearningMap({bundle,map}){
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 if(![1,2].includes(map.schema)||map.paperId!==bundle.paperId||map.documentSha256!==bundle.sha256||hash(bundle.document)!==bundle.sha256)throw Error('learning_source_version_mismatch');
 const entries=learningEntries(map),seen=new Set();
 if(map.schema===2&&(!Array.isArray(entries)||entries.length!==bundle.document.groups.flatMap(g=>g.fields).length||new Set(map.concepts.map(c=>c.id)).size!==map.concepts.length))throw Error('learning_incomplete_coverage');
 for(const entry of entries){
  const group=bundle.document.groups.find(g=>g.id===entry.groupId),field=group?.fields.find(f=>f.id===entry.questionId);
  if(!field||seen.has(field.id)||hash(field.answer)!==hash(entry.expectedAnswer)||typeof entry.explanation!=='string'||!entry.explanation.trim())throw Error('learning_source_question_mismatch');seen.add(field.id);
  if(map.schema===2&&entry.selfCheck!==['annotation','manual'].includes(group.kind))throw Error('learning_self_check_mismatch');
  const source=bundle.provenance.entries.find(p=>p.id===field.id);
  if(map.schema===1){
   if(group.kind!=='single'||source?.source?.sha256!==entry.source.paperSha256||source?.answerSource?.sha256!==entry.source.keySha256||source.answerSource.raw!==entry.source.officialRaw)throw Error('learning_provenance_mismatch');
  }else if(hash(source)!==hash(entry.source))throw Error('learning_provenance_mismatch');
  const concepts=learningConcepts(map,entry);
  if(!Array.isArray(concepts)||!concepts.length||!concepts.every(c=>c&&/^[a-z0-9-]{1,80}$/.test(c.id)&&typeof c.title==='string'&&typeof c.connection==='string'&&Array.isArray(c.points)&&c.points.every(p=>typeof p==='string')))throw Error('learning_concept_mismatch');
 }
 return entries;
}
