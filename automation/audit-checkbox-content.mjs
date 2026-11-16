// Offline inspection only. Pass private exports; never overwrite the source.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {convertChoiceQuestion} from '../shared/quiz-choice-conversion.mjs';
import {checkboxPresentationIssues} from '../shared/quiz-checkbox-presentation.mjs';
import {sourceStream} from '../shared/quiz-content-slices.mjs';
export function auditCheckboxContent(rows){
 const detail=[],output=[];for(const row of rows){const q=row.question??row;if(!q.fields?.some(f=>f.input==='set'))continue;
  const original=JSON.stringify(q),r=convertChoiceQuestion(q),issues=[...r.issues,...checkboxPresentationIssues(q,r.question)];
  if(JSON.stringify(q)!==original)throw Error('source_mutated');
  if(q.fields.length===1){const headers=[...(sourceStream(q.prompt)||'').matchAll(/^[ \t　]*(?:[（(][ \t　]*[）)]|□)[（(]([0-9０-９]+)[）)]/gmu)];if(headers.length>q.fields[0].options.length)issues.push({code:'checkbox_original_option_missing'});}
  const repeat=convertChoiceQuestion(r.question);if(JSON.stringify(repeat.question)!==JSON.stringify(r.question))issues.push({code:'checkbox_not_idempotent'});
  const media=x=>[...new Set([x.prompt,...x.fields.flatMap(f=>(f.options||[]).map(o=>o.content))].flatMap(c=>(c.media||[]).map(m=>m.url)))].sort();
  if(JSON.stringify(media(q))!==JSON.stringify(media(r.question)))issues.push({code:'checkbox_media_changed'});
  detail.push({question_id:q.id,source:row.source??'pool',doc_id:row.doc_id,usable:row.usable,changed:r.changes.length>0,changes:r.changes,issues,source_sha256:createHash('sha256').update(original).digest('hex')});output.push(row.question?{...row,question:r.question}:r.question);
 }
 return {rows:output,report:{sources:detail.length,changed:detail.filter(d=>d.changed).length,pending:detail.filter(d=>d.issues.length&&d.usable!==false).length,retained_disabled:detail.filter(d=>d.issues.length&&d.usable===false).length,model_calls:0,detail}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1],input=get('--input'),report=get('--report'),output=args.includes('--output')?get('--output'):null;
 if(!args.includes('--input')||!args.includes('--report')||![input,report,output].filter(Boolean).every(path.isAbsolute)||[report,output].filter(Boolean).some(p=>path.resolve(p)===path.resolve(input)))throw Error('distinct_absolute_private_paths_required');
 const result=auditCheckboxContent(JSON.parse(await fs.readFile(input,'utf8')));await fs.writeFile(report,JSON.stringify(result.report,null,2));if(output)await fs.writeFile(output,JSON.stringify(result.rows));console.log(JSON.stringify({...result.report,detail:undefined}));if(result.report.pending)process.exitCode=1;
}
