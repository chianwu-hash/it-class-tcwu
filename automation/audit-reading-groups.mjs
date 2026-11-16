import fs from 'node:fs';
import crypto from 'node:crypto';
import {choiceQuestionPresentation} from '../shared/quiz-choice-conversion.mjs';
import {readingPresentation} from '../shared/quiz-reading-presentation.mjs';
import {sourceStream} from '../shared/quiz-content-slices.mjs';
import {reviewedReadingSources} from '../shared/quiz-reading-reviewed-sources.mjs';

export function auditReadingRows(rows){
 const findings=[];let mutated=0;
 for(const row of rows){const original=row.question??row,before=JSON.stringify(original),q=choiceQuestionPresentation(original);
  if(q.type!=='fields'||q.fields.length<2)continue;
  const text=sourceStream(q.prompt)??q.prompt?.text??'',reading=/閱讀|短文|文章|下文|讀一讀|read|passage|story/iu.test(text),numbers=[...text.matchAll(/^[ \t　]*(?:[（(][0-9０-９]{1,2}[）)]|[0-9０-９]{1,2}[.．、])/gmu)].length;
  const terse=q.fields.filter(f=>/^\s*(?:[（(]?[0-9０-９]{1,2}[）)]?|第?[0-9０-９]+[題欄格])(?:\s|[（(]|$)/u.test(f.label)||f.label.length<20).length;
  const projected=readingPresentation(q);
  if(!(projected||reading||numbers>=2&&terse||text.length>500&&terse))continue;
  const choices=q.fields.filter(f=>['single','set'].includes(f.input));
  const explicit=/閱讀理解|閱讀測驗|Reading Comprehension|閱讀下[文列]|閱讀以下文章/iu.test(text);
  let status=projected?'projected':!choices.length?'reference_fields':/^(?:hg6math|hlg3m)_/u.test(q.id)&&!explicit?'math_reference':'needs_review';
  const reasons=[];
  if(reviewedReadingSources[q.id]&&!projected?.reviewed){status='needs_review';reasons.push('reviewed_source_signature_mismatch');}
  if(status==='needs_review'){
   if(sourceStream(q.prompt)===null)reasons.push('table_or_unanchored_media');
   if(q.fields.some(f=>!['single','set'].includes(f.input)))reasons.push('mixed_fields');
   if(choices.some(f=>f.options.every(o=>/^[A-H①②③④⑤⑥⑦⑧]$/u.test(o.content.text.trim())&&!o.content.media.length)))reasons.push('code_only_options');
   if(!reasons.length)reasons.push('nonstandard_numbering_or_context');
  }
  if(JSON.stringify(original)!==before)mutated++;
  findings.push({source:row.source??'input',docId:row.doc_id??null,id:q.id,active:row.usable??null,hash:crypto.createHash('sha256').update(before).digest('hex'),status,mode:projected?(projected.context?'context':projected.numbered?'numbered':'strict'):null,sourceReviewed:projected?.reviewed===true,reviewKind:projected?.reviewKind??null,reasons,fields:q.fields.length,issues:projected?.issues??[]});
 }
 const counts={};for(const f of findings)counts[f.status]=(counts[f.status]??0)+1;
 return {scanned:rows.length,candidates:findings.length,uniqueCandidates:new Set(findings.map(f=>f.hash)).size,mutated,counts,findings};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/audit-reading-groups.mjs')){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
 if(!args.includes('--input')||!args.includes('--out'))throw Error('Use --input <private JSON> [--copies <private JSON>] --out <private JSON> [--check]');
 const rows=[];for(const [flag,source]of [['--input','pool'],['--copies','copies']])if(args.includes(flag))for(const r of JSON.parse(fs.readFileSync(value(flag),'utf8')))rows.push({...r,source});
 const report=auditReadingRows(rows);fs.writeFileSync(value('--out'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({scanned:report.scanned,candidates:report.candidates,uniqueCandidates:report.uniqueCandidates,counts:report.counts,mutated:report.mutated}));
 if(report.mutated||args.includes('--check')&&(report.counts.needs_review||report.findings.some(f=>f.issues.length)))process.exitCode=1;
}
