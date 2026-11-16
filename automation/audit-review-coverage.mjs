import fs from 'node:fs';
import {choiceReviewModel} from '../shared/quiz-review-choices.mjs';
import {fieldsReviewPresentation} from '../shared/quiz-fields-review.mjs';
import {choiceQuestionPresentation} from '../shared/quiz-choice-conversion.mjs';
export function auditReviewCoverage(rows,versions=[],courseRows=[]){
 const courses=new Map(courseRows.map(r=>[r.question_id,r.course_id])),normal={},past={},unsupported=[];let normalFields=0,pastFields=0,mutated=0;
 for(const row of rows){const source=row.question??row,before=JSON.stringify(source),q=choiceQuestionPresentation(source),key=(courses.get(q.id)||'historical_unmapped')+'|'+q.type+'|'+(q.type==='fields'?[...new Set(q.fields.map(f=>f.input))].sort().join('+'):q.type);normal[key]=(normal[key]||0)+1;
  if(q.type==='single'&&!choiceReviewModel({kind:'single',choices:q.options,value:q.answer?.option_id,official:q.answer?.option_id,correct:true,revealed:true}))unsupported.push({id:q.id,kind:'single'});
  if(q.type==='fields'&&q.answer?.format==='fields-v1'){const raw=JSON.stringify({v:1,f:Object.fromEntries(q.fields.map(f=>[f.id,q.answer.fields[f.id][0]]))}),model=fieldsReviewPresentation(q,raw,{correct:true,answer:q.answer});normalFields+=q.fields.length;if(!model||model.some(f=>!f)||fieldsReviewPresentation(q,raw,null)!==null)unsupported.push({id:q.id,kind:'fields'});}
  if(JSON.stringify(source)!==before)mutated++;
 }
 for(const version of versions)for(const g of version.document.groups){const before=JSON.stringify(g);past[g.kind]=(past[g.kind]||0)+1;if(['single','mark','code','set','sequence'].includes(g.kind))for(const f of g.fields){const args={kind:g.kind,choices:g.choices,codes:g.codes,value:f.answer,official:f.answer,correct:true,revealed:true};pastFields++;if(!choiceReviewModel(args)||choiceReviewModel({...args,revealed:false})!==null)unsupported.push({id:f.id,kind:g.kind});}if(JSON.stringify(g)!==before)mutated++;}
 return {scanned:rows.length,courses:new Set(courseRows.map(r=>r.course_id)).size,normalFamilies:Object.keys(normal).length,normalFields,pastVersions:versions.length,past,pastFields,sourceMutations:mutated,unsupported,normal};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/audit-review-coverage.mjs')){
 const a=process.argv.slice(2),read=k=>a.includes(k)?JSON.parse(fs.readFileSync(a[a.indexOf(k)+1],'utf8')):[];if(!a.includes('--input')||!a.includes('--out'))throw Error('Use --input <private pool> --copies <private copies> --past <private versions> [--courses <private index>] --out <private report> [--check]');const report=auditReviewCoverage([...read('--input'),...read('--copies')],read('--past'),read('--courses'));fs.writeFileSync(a[a.indexOf('--out')+1],JSON.stringify(report,null,2));console.log(JSON.stringify({...report,normal:undefined}));if(a.includes('--check')&&(report.sourceMutations||report.unsupported.length))process.exitCode=1;
}
