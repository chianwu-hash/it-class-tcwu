import fs from 'node:fs/promises';
import {referenceChoiceGroups,choiceReferenceTokens,explanationReferencePresentation} from '../shared/quiz-explanation-references.mjs';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
const files=args.filter((v,i)=>args[i-1]==='--input'),orders=new Map(),conflicts=new Set(),records=[];if(!files.length)throw Error('private_inputs_required');
for(const file of files)for(const row of JSON.parse(await fs.readFile(file,'utf8'))){const q=row.question;const mapping=Object.fromEntries(referenceChoiceGroups(q).map(g=>[g.id,g.options.map(o=>o.id)]));if(orders.has(q.id)&&JSON.stringify(orders.get(q.id))!==JSON.stringify(mapping))conflicts.add(q.id);else orders.set(q.id,mapping);for(const [origin,text]of [['study',row.student_explanation],['source',q.explanation?.text]])if(text&&choiceReferenceTokens(text).length)records.push({id:q.id,q,text,origin,usable:row.usable,source:row.source});}
const selected={},report=[];
for(const r of records){const order=conflicts.has(r.id)?undefined:orders.get(r.id),result=explanationReferencePresentation(r.q,r.text,{orders:order});if(result.changes.length)selected[r.id]=order;report.push({id:r.id,origin:r.origin,usable:r.usable,source:r.source,changes:result.changes,issues:result.issues,retained:result.retained});}
if(args.includes('--check')){if(report.some(r=>r.changes.length||r.issues.length))process.exitCode=1;}
else{
 await fs.writeFile(arg('--report'),JSON.stringify({records:records.length,conflicting_source_ids:[...conflicts],changed_records:report.filter(r=>r.changes.length).length,changed_sources:new Set(report.filter(r=>r.changes.length).map(r=>r.id)).size,unresolved:report.filter(r=>r.issues.length),detail:report},null,2));
 await fs.writeFile(arg('--registry'),'// Source option IDs only; no questions, answers, student data or display order.\nexport const reviewedOptionOrders=Object.freeze('+JSON.stringify(Object.fromEntries(Object.entries(selected).sort()),null,1)+');\n');
}
console.log(JSON.stringify({records:records.length,changed_sources:Object.keys(selected).length,unresolved_sources:[...new Set(report.filter(r=>r.issues.length).map(r=>r.id))]}));
