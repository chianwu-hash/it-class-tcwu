// Offline only. Source material and before/after records must stay private.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {convertChoiceQuestion} from '../shared/quiz-choice-conversion.mjs';
export function convertChoiceBatch(rows,{check=false}={}){
 if(!Array.isArray(rows))throw Error('choice_batch_array_required');const changes=[],issues=[],output=[];
 for(const row of rows){const raw=row.question??row;
  if(!raw||!['fields','single','short','open'].includes(raw.type)){issues.push({question_id:raw?.id??row.doc_id??null,code:'unsupported_question_format'});output.push(row);continue;}
  const result=convertChoiceQuestion(raw);
  if(JSON.stringify(result.question.answer)!==JSON.stringify(raw.answer))throw Error('choice_answer_changed');
  const fields=q=>q.type==='single'?[{id:'$single',options:q.options}]:q.fields||[];
  const ids=q=>fields(q).map(f=>[f.id,f.options?.map(o=>o.id)]);
  if(JSON.stringify(ids(result.question))!==JSON.stringify(ids(raw)))throw Error('choice_ids_changed');
  changes.push(...result.changes.map(c=>({question_id:raw.id,...c})));issues.push(...result.issues.map(c=>({question_id:raw.id,...c})));
  if(check&&result.changes.length)issues.push({question_id:raw.id,code:'choice_conversion_required'});
  output.push(row.question?{...row,question:result.question}:result.question);
 }
 return {rows:output,report:{schema:1,source_rows:rows.length,changed_sources:new Set(changes.map(c=>c.question_id)).size,changes,issues,passed:issues.length===0,model_calls:0}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),option=n=>{const i=args.indexOf(n);return i<0?null:args[i+1];};
 const input=option('--input'),output=option('--output'),report=option('--report'),check=args.includes('--check');
 if(!input||!report||(!check&&!output))throw Error('usage: --input <private.json> [--output <private.json>] --report <private.json> [--check]');
 if([input,output,report].filter(Boolean).some(p=>!path.isAbsolute(p)))throw Error('absolute_private_paths_required');
 if(output&&path.resolve(input)===path.resolve(output))throw Error('source_must_not_be_overwritten');
 const bytes=await fs.readFile(input),result=convertChoiceBatch(JSON.parse(bytes),{check});
 if(output)await fs.writeFile(output,JSON.stringify(result.rows,null,2)+'\n','utf8');
 await fs.writeFile(report,JSON.stringify({...result.report,input_sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n','utf8');
 console.log(JSON.stringify({passed:result.report.passed,source_rows:result.report.source_rows,changed_sources:result.report.changed_sources,issues:result.report.issues.length,model_calls:0}));
 if(!result.report.passed)process.exitCode=1;
}
