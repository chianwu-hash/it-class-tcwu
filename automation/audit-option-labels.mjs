import fs from 'node:fs';
import {optionLabelProjection,optionLabelReferenceText} from '../shared/quiz-option-labels.mjs';
import {choiceQuestionPresentation} from '../shared/quiz-choice-conversion.mjs';
export function auditOptionLabels(rows){
 const findings=[];let mutated=0,residual=0;
 for(const row of rows){const q=row.question??row,before=JSON.stringify(q),view=choiceQuestionPresentation(q),groups=q.type==='single'?[{id:'$single',input:'single',options:q.options}]:q.fields||[];
  for(const f of groups){const p=optionLabelProjection(f.options,{referenceText:optionLabelReferenceText(q)});if(p.status==='unchanged')continue;findings.push({source:row.source??'input',id:q.id,field:f.id,input:f.input,status:f.input==='single'?p.status:'retained_non_single',family:p.family??null,reason:p.reason??null});}
  for(const f of view.type==='single'?[{input:'single',options:view.options}]:view.fields||[])if(f.input==='single'&&optionLabelProjection(f.options,{referenceText:optionLabelReferenceText(view)}).status==='projected')residual++;
  if(JSON.stringify(q)!==before)mutated++;
 }
 const counts={};for(const f of findings){const key=f.input+':'+f.status;counts[key]=(counts[key]||0)+1;}
 return {scanned:rows.length,counts,sourceMutations:mutated,residual,findings};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/audit-option-labels.mjs')){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];if(!args.includes('--input')||!args.includes('--out'))throw Error('Use --input <private JSON> [--copies <private JSON>] [--past <private JSON>] --out <private report> [--check | --presentation-check]');
 const rows=[];for(const [flag,source]of [['--input','pool'],['--copies','copies']])if(args.includes(flag))rows.push(...JSON.parse(fs.readFileSync(value(flag),'utf8')).map(r=>({...r,source})));
 const report=auditOptionLabels(rows);report.past={versions:0,groups:0,eligible:0,retained:0};
 if(args.includes('--past')){const versions=JSON.parse(fs.readFileSync(value('--past'),'utf8'));report.past.versions=versions.length;for(const v of versions)for(const g of v.document.groups||[]){report.past.groups++;if(g.kind!=='single')continue;const p=optionLabelProjection(g.choices?.map(o=>({...o,content:o.content||{text:o.text||'',media:[]}})),{referenceText:optionLabelReferenceText(g)});if(p.status==='projected')report.past.eligible++;if(p.status==='retained')report.past.retained++;}}
 fs.writeFileSync(value('--out'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,findings:undefined}));
 if(report.sourceMutations||report.residual||report.past.eligible||args.includes('--check')&&report.findings.some(f=>f.input==='single'&&f.status==='projected'))process.exitCode=1;
}
