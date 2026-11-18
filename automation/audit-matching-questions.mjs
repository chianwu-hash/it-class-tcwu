// Read private exports; never write to a question bank or call an AI service.
// Usage: node automation/audit-matching-questions.mjs --pool <private.json>
//        [--past <private.json>] [--partner <private.json>] [--out <private.json>]
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {choiceQuestionPresentation} from '../shared/quiz-choice-conversion.mjs';
import {fieldPresentation} from '../shared/quiz-fields-presentation.mjs';
import {readingPresentation} from '../shared/quiz-reading-presentation.mjs';
import {matchingPresentation} from '../shared/quiz-matching-presentation.mjs';
import {pastMatchingPresentation,partnerMatchingPresentation} from '../shared/quiz-matching-past.mjs';
import {matchingReference} from '../shared/quiz-matching-model.mjs';
export function auditMatchingQuestions({pool=[],past=[],partner=[]}={}){
 const rows=[],issues=[];
 for(const row of pool){const stored=row.question??row;if(stored.type!=='fields')continue;const before=JSON.stringify(stored),q=choiceQuestionPresentation(stored),reading=readingPresentation(q),shown=q.fields.map((f,i)=>reading?.fields[i]??fieldPresentation(q,f)),plan=matchingPresentation(q,shown);
  if(!plan){if(/連連看|連一連|畫線連|連出正確|請用線連起來/u.test(q.prompt?.text||''))issues.push({source:'pool',id:q.id,reason:'source_plan_missing_or_changed'});continue;}
  for(const board of plan.boards)for(const left of board.left){const accepted=stored.answer?.fields?.[left.id];if(accepted?.some(value=>!matchingReference(left,value,accepted)?.correct||!matchingReference(left,value,accepted)?.selected.length))issues.push({source:'pool',id:q.id,field:left.id,reason:'original_value_has_no_card'});}
  if(before!==JSON.stringify(stored))issues.push({source:'pool',id:q.id,reason:'source_mutated'});
  rows.push({source:'pool',id:q.id,boards:plan.boards.length,fields:plan.boards.flatMap(b=>b.left.map(l=>l.id))});
 }
 for(const row of past)for(const g of row.document?.groups??[row.group??row]){const plan=pastMatchingPresentation(g);if(plan)rows.push({source:'past',version:row.id??row.version,id:g.id,fields:g.fields.map(f=>f.id)});else if(['code','set'].includes(g.kind)&&/連連看|連一連|聽力・連線|請連出/u.test(g.title+'\n'+g.material))issues.push({source:'past',version:row.id??row.version,id:g.id,reason:'source_plan_missing_or_changed'});}
 for(const q of partner){const plan=partnerMatchingPresentation(q);if(plan)rows.push({source:'partner',id:q.id});else if(q.past_meta&&['code','set'].includes(q.past_meta.kind)&&/連連看|連一連|聽力・連線/u.test(q.title))issues.push({source:'partner',id:q.id,reason:'source_plan_missing_or_changed'});}
 return {ok:issues.length===0,counts:{pool:rows.filter(r=>r.source==='pool').length,past:rows.filter(r=>r.source==='past').length,partner:rows.filter(r=>r.source==='partner').length},rows,issues};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=Object.fromEntries(process.argv.slice(2).reduce((out,arg,i,a)=>i%2===0?[...out,[arg,a[i+1]]]:out,[])),input={};for(const key of ['pool','past','partner'])if(args['--'+key])input[key]=JSON.parse(await fs.readFile(args['--'+key],'utf8'));
 if(!Object.keys(input).length)throw Error('請提供私有題庫匯出檔。');if(args['--out']&&Object.entries(args).some(([k,p])=>k!=='--out'&&resolve(p)===resolve(args['--out'])))throw Error('報告不可覆蓋原始匯出檔。');const report=auditMatchingQuestions(input);if(args['--out'])await fs.writeFile(args['--out'],JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,counts:report.counts,issues:report.issues.length}));if(!report.ok)process.exitCode=1;
}
