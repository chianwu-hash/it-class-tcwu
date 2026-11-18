import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {unitPracticeScope,paperPracticeScope} from '../shared/quiz-practice-scope.mjs';
import {convertChoiceQuestion} from '../shared/quiz-choice-conversion.mjs';
import {terminalOptionPeriodCandidate,optionPeriodGroups,finalOptionPeriodProjection} from '../shared/quiz-option-periods.mjs';
import {readingSignature} from '../shared/quiz-reading-signature.mjs';
import {reviewedReadingSources} from '../shared/quiz-reading-reviewed-sources.mjs';
export function auditFinalOptionPeriods({courses,pool,scopeRows=pool,copies=[],drafts=[],partner=[]}){
 const definitions=new Map(courses.map(c=>[c.id,{...c.definition,...c,course_id:c.id,school_year:'115'}]));
 const scope=r=>{const parts=r.unit_ids?.map(id=>unitPracticeScope(definitions.get(r.course_id)||{id:r.course_id},{id}))||[];return parts.length&&new Set(parts).size===1?parts[0]:'unknown';};
 const after=new Set(scopeRows.filter(r=>scope(r)==='after').map(r=>r.question_id||r.question.id));
 const excluded=new Set(scopeRows.filter(r=>scope(r)!=='after').map(r=>r.question_id||r.question.id));
 for(const r of [...copies,...drafts])if(paperPracticeScope({catalog:r.catalog})==='before')excluded.add(r.question.id);
 const registry={},findings=[],retained={},readingCompatibility=[];
 const rows=[...pool.map(r=>({...r,source:'pool',eligible:scope(r)==='after'})),...copies.map(r=>({...r,source:'versions',eligible:after.has(r.question.id)})),...drafts.map(r=>({...r,source:'drafts',eligible:after.has(r.question.id)}))];
 for(const r of partner){const q=r.normal||{id:String(r.id),type:'single',prompt:r.rich?.prompt||{text:r.text||'',media:[]},options:r.options.map((text,i)=>({id:String(i),content:r.rich?.options?.[i]||{text,media:[]}}))};rows.push({...r,question:q,source:'partner',eligible:after.has(r.source_question?.id||r.normal?.id)&&!excluded.has(r.source_question?.id||r.normal?.id)});}
 for(const row of rows){
  const original=row.question,before=JSON.stringify(original),q=convertChoiceQuestion(original,{preserveOptionPeriods:true}).question;
  for(const f of optionPeriodGroups(q)){
   const c=terminalOptionPeriodCandidate(q,f);
   if(c.status!=='candidate'){retained[c.reason]=(retained[c.reason]||0)+1;continue;}
   let reason=!row.eligible||excluded.has(q.id)?'outside_verified_final_range':c.optionId!==f.options.at(-1)?.id?'not_original_last_option':null;
   if(reason){retained[reason]=(retained[reason]||0)+1;continue;}
   const entry={field:f.id,guard:c.guard,optionId:c.optionId};registry[q.id]??=[];
   if(!registry[q.id].some(e=>JSON.stringify(e)===JSON.stringify(entry)))registry[q.id].push(entry);
   findings.push({source:row.source,id:q.id,field:f.id,optionId:c.optionId,kind:c.kind,course:row.course_id||row.catalog?.course_id,usable:row.usable});
  }
  if(JSON.stringify(original)!==before)throw Error('source_mutated');
 }
 let sourceMutations=0,responseContractChanges=0,idempotenceFailures=0,changedCopies=0;
 for(const row of rows){const q=convertChoiceQuestion(row.question,{preserveOptionPeriods:true}).question,before=JSON.stringify(q),view=finalOptionPeriodProjection(q,registry);if(view===q)continue;changedCopies++;
  if(JSON.stringify(q)!==before)sourceMutations++;
  const contract=v=>JSON.stringify({id:v.id,type:v.type,answer:v.answer,fields:v.fields?.map(f=>({id:f.id,input:f.input,options:f.options?.map(o=>o.id)})),options:v.options?.map(o=>o.id)});
  if(contract(q)!==contract(view))responseContractChanges++;
  if(finalOptionPeriodProjection(view,registry)!==view)idempotenceFailures++;
  const oldGuard=readingSignature(q),newGuard=readingSignature(view);
  if(reviewedReadingSources[q.id]?.some(p=>p.guard===oldGuard)&&!reviewedReadingSources[q.id].some(p=>p.guard===newGuard)&&!readingCompatibility.some(r=>r.id===q.id&&r.newGuard===newGuard))readingCompatibility.push({id:q.id,oldGuard,newGuard});
 }
 return {registry,report:{scanned:{scopeRows:scopeRows.length,pool:pool.length,versions:copies.length,drafts:drafts.length,partner:partner.length,courses:courses.length},eligibleFinalIds:after.size,registeredQuestionIds:Object.keys(registry).length,registeredBanks:Object.values(registry).reduce((n,x)=>n+x.length,0),changedCopies,sourceMutations,responseContractChanges,idempotenceFailures,retained,findings,readingCompatibility}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1],load=k=>JSON.parse(fs.readFileSync(value(k),'utf8'));
 const input={courses:load('--courses'),pool:load('--pool')};for(const k of ['copies','drafts','partner','scopeRows'])if(args.includes('--'+k))input[k]=load('--'+k);
 const result=auditFinalOptionPeriods(input);fs.writeFileSync(value('--out'),JSON.stringify(result,null,2));
 if(args.includes('--registry-out'))fs.writeFileSync(value('--registry-out'),'// Verified final-range IDs and display fingerprints only. No source text, answers or student data.\nexport const reviewedFinalOptionPeriods='+JSON.stringify(result.registry,null,2)+';\n');
 console.log(JSON.stringify({...result.report,findings:undefined}));
 if(result.report.sourceMutations||result.report.responseContractChanges||result.report.idempotenceFailures)process.exitCode=1;
}
