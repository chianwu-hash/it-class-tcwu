import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {presentationSignature} from '../shared/quiz-presentation-signature.mjs';
import {sourceStream} from '../shared/quiz-content-slices.mjs';
import {correctionQuestionPresentation,isPastCorrection,pastCorrectionPrompt} from '../shared/quiz-correction-presentation.mjs';

// Inputs remain private. `native` must come from SHA-checked original DOCX and
// publisher type metadata, not an AI guess or spelling-based classifier.
export function auditCorrectionInstructions({pool,native,copies=[],past=[],partner=[],reviewedKeys={}}){
 const source=new Map(native.map(n=>[n.id,n])),registry={},findings=[],issues=[];
 for(const row of pool){
  const n=source.get(row.source_item_id);if(!n)continue;const q=row.question;
  if(!['06','07'].includes(n.type_code)||!/^改錯字/u.test(n.type_name)||!/^[a-f0-9]{64}$/u.test(n.sha256))throw Error('original_type_evidence_required');
  const key=n.key.replace(/^《答案》/u,'').trim().split('，').map(s=>s.trim());
  for(const [field,fix]of Object.entries(reviewedKeys[q.id]||{})){const i=q.fields.findIndex(f=>f.id===field);if(i<0||fix.sourceSha256!==n.sha256||key[i]!==fix.original||!fix.evidence)throw Error('reviewed_key_evidence_required');key[i]=fix.corrected;}
  if(q.type!=='fields'||!q.fields?.length||q.fields.some(f=>f.input!=='text')||sourceStream(q.prompt)===null||key.length!==q.fields.length||q.fields.some((f,i)=>!q.answer?.fields?.[f.id]?.includes(key[i]))){issues.push({id:q.id,code:'original_field_mapping_required'});continue;}
  const entry={guard:presentationSignature(q),sourceSha256:n.sha256};registry[q.id]??=[];
  if(!registry[q.id].some(e=>e.guard===entry.guard))registry[q.id].push(entry);
  findings.push({id:q.id,source:n.id,fields:q.fields.length,type:n.type_code});
 }
 let changed=0;const contract=q=>JSON.stringify({id:q.id,type:q.type,answer:q.answer,fields:q.fields?.map(({label,...f})=>f)});
 for(const row of [...pool,...copies,...partner]){const q=row.question||row.normal_question;if(!q)continue;const before=JSON.stringify(q),view=correctionQuestionPresentation(q,registry);if(view===q)continue;changed++;
  if(JSON.stringify(q)!==before||contract(view)!==contract(q)||JSON.stringify(view.prompt.media)!==JSON.stringify(q.prompt.media))issues.push({id:q.id,code:'source_or_response_contract_changed'});
  if(correctionQuestionPresentation(view,registry)!==view)issues.push({id:q.id,code:'not_idempotent'});
 }
 const old=past.flatMap(v=>(v.document?.groups||[]).map(group=>({version:v.id,group}))).filter(r=>isPastCorrection(r.group));
 return {registry,report:{pool:pool.length,copies:copies.length,partner:partner.length,registered:Object.keys(registry).length,changedCopies:changed,fields:findings.reduce((n,f)=>n+f.fields,0),pastVersions:past.length,pastCorrectionGroups:old.length,pastNeedsInstruction:old.filter(r=>pastCorrectionPrompt(r.group)).map(r=>({version:r.version,id:r.group.id})),issues,findings}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),result=auditCorrectionInstructions(input);fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2));
 if(process.argv[4])fs.writeFileSync(process.argv[4],'// NAS-reviewed source IDs, display guards and original DOCX hashes only. No answers.\nexport const reviewedCorrectionSources='+JSON.stringify(result.registry,null,2)+';\n');
 console.log(JSON.stringify({...result.report,findings:undefined,pastNeedsInstruction:result.report.pastNeedsInstruction.length}));if(result.report.issues.length)process.exitCode=1;
}
