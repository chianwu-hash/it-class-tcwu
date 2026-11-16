// Deterministic new-version candidates; never use this output to overwrite a fixed document.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {canonicalizeQuestion} from '../shared/quiz-question-contract.mjs';
export function canonicalizeQuestions(rows){
 const detail=[],output=[];
 for(const row of rows){const source=row.question??row,result=canonicalizeQuestion(source);detail.push({question_id:source.id,changes:result.changes,issues:result.issues,mapping:result.mapping,retained_reason:result.retained_reason});output.push(row.question?{...row,question:result.question}:result.question);}
 return {rows:output,report:{records:rows.length,type_changes:detail.filter(r=>r.mapping).length,issues:detail.filter(r=>r.issues.length).length,model_calls:0,detail}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1],input=arg('--input'),output=arg('--output'),report=arg('--report'),check=args.includes('--check');
 if(!args.includes('--input')||!path.isAbsolute(input)||(!check&&(!['--output','--report'].every(k=>args.includes(k))||![output,report].every(path.isAbsolute)||new Set([input,output,report].map(p=>path.resolve(p).toLowerCase())).size!==3)))throw Error('distinct_absolute_private_paths_required');
 const bytes=await fs.readFile(input),result=canonicalizeQuestions(JSON.parse(bytes));result.report.input_sha256=createHash('sha256').update(bytes).digest('hex');
 if(!check){await fs.writeFile(output,JSON.stringify(result.rows));await fs.writeFile(report,JSON.stringify(result.report,null,2));}
 console.log(JSON.stringify({...result.report,detail:undefined,check_only:check}));if(result.report.issues||(check&&result.report.type_changes))process.exitCode=1;
}
