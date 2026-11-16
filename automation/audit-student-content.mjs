// Offline only. Source exports, projected candidates and receipts stay private.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {convertChoiceQuestion} from '../shared/quiz-choice-conversion.mjs';
import {duplicateChoiceBanks,duplicateChoiceLines,importerInstructions} from '../shared/quiz-student-content.mjs';
import {fieldPresentation,fieldsPromptPresentation} from '../shared/quiz-fields-presentation.mjs';
import {validateDocument} from '../shared/quiz-document.mjs';
import {booleanChoicePresentation} from '../shared/quiz-boolean-choice.mjs';
import {sourceStream} from '../shared/quiz-content-slices.mjs';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const storage=q=>({id:q.id,type:q.type,answer:q.answer,fields:q.fields?.map(f=>({id:f.id,input:f.input,options:f.options?.map(o=>o.id)})),options:q.options?.map(o=>o.id)});
const media=q=>[...new Set([q.prompt,q.material,q.explanation,...(q.options||[]).map(o=>o.content),...(q.fields||[]).flatMap(f=>(f.options||[]).map(o=>o.content))].filter(Boolean).flatMap(c=>(c.media||[]).map(m=>m.url)))].sort();
const signature=(q,field=fieldPresentation,prompt=fieldsPromptPresentation)=>({...q,prompt:prompt(q),fields:q.fields?.map(f=>field(q,f))});
function sourceCoverage(q){
 const fields=q.type==='single'?[{id:'$single',options:q.options}]:q.fields||[];if(fields.length!==1||!fields[0].options?.length||booleanChoicePresentation(fields[0].options))return [];
 const f=fields[0],text=sourceStream(q.prompt)??q.prompt?.text??'',issues=[];
 const numeric=[...text.matchAll(/^[ \t　]*(?:[（(][ \t　]*[）)]|□)\s*[（(]([0-9０-９]+)[）)]/gmu)].map(m=>Number(m[1].normalize('NFKC')));
 const circles=[...text.matchAll(/[①②③④⑤⑥⑦⑧]/gu)].map(m=>m[0].codePointAt(0)-0x2460+1);
 for(const ns of [numeric,circles])if(ns.length>f.options.length&&ns.every((n,i)=>n===i+1))issues.push({code:'source_option_count_exceeds_stored',field:f.id,source_count:ns.length,stored_count:f.options.length});return issues;
}
function nativeIssues(g){
 const issues=[],information=[],add=(code,field)=>issues.push({code,field}),fields=g.fields||[],choices=g.choices||[],ids=choices.map(c=>String(c.id));
 if(new Set(ids).size!==ids.length)add('duplicate_choice_id');if(new Set(fields.map(f=>f.id)).size!==fields.length)add('duplicate_field_id');
 if(['single','code','sequence'].includes(g.kind)){
  if(!choices.length)add('missing_choice_bank');
  for(const f of fields){const values=Array.isArray(f.answer)?f.answer:[f.answer];if(values.some(v=>!ids.includes(String(v))))add('answer_not_in_choices',f.id);if(g.kind==='sequence'&&(values.length!==ids.length||new Set(values).size!==values.length))add('incomplete_sequence',f.id);}
 }
 if(g.kind==='set')for(const f of fields)if((f.answer||[]).some(v=>!g.codes?.includes(v)))add('answer_not_in_codes',f.id);
 for(const c of choices)if(!(c.content?.text||c.text||'').trim()&&!c.content?.media?.length){
  const imaged=g.kind==='code'&&JSON.stringify(g.codes)===JSON.stringify(ids)&&g.assets?.some(a=>{const v=a.viewBox;return /^[0-9a-f]{64}$/u.test(a.sha256||'')&&a.url?.endsWith(a.sha256)&&v&&v.x>=0&&v.y>=0&&v.width>0&&v.height>0&&v.x+v.width<=v.sourceWidth+1&&v.y+v.height<=v.sourceHeight+1;});
  if(imaged)information.push({code:'source_image_choice_retained',choice:c.id});else add('empty_choice',c.id);
 }
 return {issues,information};
}
export function auditStudentContent(rows,{baseline}={}){
 const detail=[],output=[],counts={};let pending=0,retired=0;
 for(const row of rows){const detailStart=detail.length,raw=row.question??row,source=row.source||'pool',key=source+':'+(raw.type||raw.kind||'partner_rich');counts[key]=(counts[key]||0)+1;
  const before=JSON.stringify(raw);let q=raw,partner=false,issues=[],information=[],changes=[];
  if(!raw.type&&raw.kind){const native=nativeIssues(raw);issues=native.issues;information=native.information;}
  else{
   if(!raw.type&&source==='partner_copy'&&raw.prompt&&Array.isArray(raw.options)){partner=true;q={id:String(row.doc_id),type:'single',prompt:raw.prompt,options:raw.options.map((content,i)=>({id:String(i),content}))};}
   if(!['single','fields','short','open'].includes(q.type))issues.push({code:'unsupported_content_contract'});
   else{
    const converted=convertChoiceQuestion(q),view=converted.question;issues.push(...converted.issues,...sourceCoverage(q));changes=converted.changes;
    if(hash(storage(q))!==hash(storage(view)))issues.push({code:'storage_or_answer_changed'});if(hash(media(q))!==hash(media(view)))issues.push({code:'media_changed'});
    if(!partner)try{validateDocument({schema:1,title:'內容驗收',catalog:{school_year:'115'},blocks:[{id:'b',material:{text:'',media:[]},questions:[view]}]});}catch(e){issues.push({code:'schema_error',error:e.message});}
    const student=signature(view),text=student.prompt?.text||'';
    for(const value of importerInstructions)if(text.includes(value))issues.push({code:'importer_instruction_visible'});
    if(/【(?:題目校訂|線上作答勘誤|線上題型調整)/u.test(text))issues.push({code:'editorial_rationale_visible'});
    if(duplicateChoiceBanks({...view,prompt:student.prompt}).length)issues.push({code:'duplicated_choice_bank'});
    if(duplicateChoiceLines({...view,prompt:student.prompt}).length)issues.push({code:'duplicated_choice_line'});
    const paragraphs=(student.prompt.layout||[]).filter(p=>p.type==='paragraph').map(p=>p.runs.filter(r=>r.type==='text').map(r=>r.text).join('').replace(/\s/gu,'')).filter(s=>s.length>=40);if(new Set(paragraphs).size!==paragraphs.length)issues.push({code:'repeated_paragraph_review_required'});
    if(hash(convertChoiceQuestion(view).question)!==hash(view))issues.push({code:'not_idempotent'});
    const baselineView=baseline?baseline.project(q):q,baselineStudent=baseline?signature(baselineView,baseline.field,baseline.prompt):q;
    if(baseline){const inputs=v=>(v.fields||[]).map(f=>[f.id,f.input]);if(hash(inputs(student))!==hash(inputs(baselineStudent)))issues.push({code:'effective_input_type_changed'});}
    information.push({code:partner?'partner_indices_preserved':'source_contract_preserved'});
    const updated=partner?{...raw,prompt:view.prompt,options:view.options.map(o=>o.content)}:view;
    const changed=hash(student)!==hash(baselineStudent);q=updated;
    detail.push({source,doc_id:row.doc_id,question_id:raw.id??String(row.doc_id),type:raw.type||'partner_rich',usable:row.usable,newly_changed:changed,changes,issues,information,source_sha256:hash(before),view_sha256:hash(q)});
   }
  }
  if(!raw.type&&raw.kind)detail.push({source,doc_id:row.doc_id,question_id:raw.id,type:raw.kind,usable:row.usable,newly_changed:false,changes,issues,information,source_sha256:hash(before),view_sha256:hash(raw)});
  if(detail.length===detailStart)detail.push({source,doc_id:row.doc_id,question_id:raw.id,usable:row.usable,newly_changed:false,changes,issues,information,source_sha256:hash(before)});
  if(JSON.stringify(raw)!==before)throw Error('original_source_mutated');
  if(issues.length){if(row.usable===false)retired++;else pending++;}
  output.push(row.question?{...row,question:q}:q);
 }
 return {rows:output,report:{schema:1,records:rows.length,counts,newly_changed:detail.filter(d=>d.newly_changed).length,pending,retained_disabled:retired,model_calls:0,detail}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1],input=get('--input'),report=get('--report'),output=args.includes('--output')?get('--output'):null,baselineRoot=args.includes('--baseline-root')?get('--baseline-root'):null;
 if(!args.includes('--input')||!args.includes('--report')||![input,report,output,baselineRoot].filter(Boolean).every(path.isAbsolute)||[report,output].filter(Boolean).some(p=>path.resolve(p)===path.resolve(input)))throw Error('distinct_absolute_private_paths_required');
 let baseline;if(baselineRoot){const module=await import(pathToFileURL(path.join(baselineRoot,'shared/quiz-choice-conversion.mjs'))),fields=await import(pathToFileURL(path.join(baselineRoot,'shared/quiz-fields-presentation.mjs')));baseline={project:module.choiceQuestionPresentation,field:fields.fieldPresentation,prompt:fields.fieldsPromptPresentation};}
 const bytes=await fs.readFile(input),result=auditStudentContent(JSON.parse(bytes),{baseline});result.report.input_sha256=hash(bytes.toString('utf8'));await fs.writeFile(report,JSON.stringify(result.report,null,2));if(output)await fs.writeFile(output,JSON.stringify(result.rows));console.log(JSON.stringify({...result.report,detail:undefined}));if(result.report.pending)process.exitCode=1;
}
