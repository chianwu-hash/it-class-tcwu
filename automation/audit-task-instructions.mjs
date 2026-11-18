import fs from 'node:fs';import {pathToFileURL} from 'node:url';
import {convertChoiceQuestion} from '../shared/quiz-choice-conversion.mjs';
import {presentationSignature} from '../shared/quiz-presentation-signature.mjs';
import {readingPresentation} from '../shared/quiz-reading-presentation.mjs';
import {taskRules,taskInstructionPlan,taskQuestionPresentation} from '../shared/quiz-task-instructions.mjs';
const contract=q=>JSON.stringify({id:q.id,type:q.type,answer:q.answer,work:q.work,fields:q.fields?.map(({label,...f})=>f),options:q.options});
const sourceView=q=>convertChoiceQuestion(q,{taskInstructions:false}).question;
export function auditTaskInstructions({pool,native,copies=[]}){
 const sources=new Map(native.map(n=>[n.id,n])),registry={},matrix={},findings=[],issues=[],unresolved=[];
 for(const row of pool){const n=sources.get(row.source_item_id);if(!n||!/^[a-f0-9]{64}$/u.test(n.sha256))throw Error('NAS_source_evidence_required');
  const raw=row.question,q=sourceView(raw),code=n.type_code,plan=taskInstructionPlan(q,code,n.type_name);
  const status=plan?'source-reviewed-display':q.type==='single'||q.fields?.some(f=>['single','set','sequence'].includes(f.input))?'existing-choice-or-reading':readingPresentation(q)?'existing-reading-plan':/[?？]|請|填|選|寫|算|求|判斷|連|比較|畫|塗|讀|找|幾|多少|回答|下列|哪|依|完成|聽|排序|估|造詞|造句|接寫/u.test(q.prompt.text)?'explicit-task':'source-review-required';
  const k=code+' '+n.type_name;matrix[k]??={sourceType:code,name:n.type_name,count:0,states:{}};matrix[k].count++;matrix[k].states[status]=(matrix[k].states[status]||0)+1;
  if(status==='source-review-required')unresolved.push({id:q.id,code,prompt:q.prompt.text,fields:q.fields});
  if(!plan)continue;
  if(code==='41'){
   const keys=n.key.replace(/^《答案》/u,'').trim().split('，').map(x=>x.trim());
   if(q.type!=='fields'||keys.length!==q.fields.length||q.fields.some((f,i)=>!q.answer.fields[f.id]?.includes(keys[i]))){issues.push({id:q.id,code:'redundant_word_key_mapping_required'});continue;}
  }
  const entry={...plan,guard:presentationSignature(q),sourceSha256:n.sha256};registry[q.id]??=[];if(!registry[q.id].some(p=>p.guard===entry.guard))registry[q.id].push(entry);
  findings.push({id:q.id,source:n.id,code,kind:q.type,fields:q.fields.length,addInstruction:!!plan.instruction,labels:plan.labels.filter(x=>x!==null).length});
 }
 let changedCopies=0;
 for(const row of [...pool,...copies]){const original=row.question,before=JSON.stringify(original),q=sourceView(original),view=taskQuestionPresentation(q,registry);if(view===q)continue;changedCopies++;
  if(contract(q)!==contract(view)||JSON.stringify(original)!==before||JSON.stringify(q.prompt.media)!==JSON.stringify(view.prompt.media))issues.push({id:q.id,code:'response_or_source_changed'});
  const reading=readingPresentation(q),after=readingPresentation(view);if(reading&&(!after||reading.reviewKind!==after.reviewKind||JSON.stringify(reading.questions)!==JSON.stringify(after.questions)))issues.push({id:q.id,code:'reading_source_plan_changed'});
  if(taskQuestionPresentation(view,registry)!==view)issues.push({id:q.id,code:'not_idempotent'});
 }
 return {registry,report:{pool:pool.length,copies:copies.length,registered:Object.keys(registry).length,changedCopies,addInstructions:findings.filter(r=>r.addInstruction).length,captionFields:findings.reduce((s,r)=>s+r.labels,0),byCode:Object.fromEntries(Object.keys(taskRules).map(code=>[code,findings.filter(r=>r.code===code).length])),matrix,issues,unresolved,findings}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=auditTaskInstructions(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2));if(process.argv[4])fs.writeFileSync(process.argv[4],'// NAS-reviewed task labels, instructions and display guards. No source questions or keys.\nexport const reviewedTaskInstructions='+JSON.stringify(result.registry,null,2)+';\n');console.log(JSON.stringify({...result.report,matrix:undefined,unresolved:result.report.unresolved.length,findings:undefined}));if(result.report.issues.length||result.report.unresolved.length)process.exitCode=1;}
