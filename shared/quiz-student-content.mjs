// Pure content projection. No DOM, response types, control flow, IDs or grading.
import {sourceStream,sliceContent,omitRanges,replaceTextRange,compactParagraphs} from './quiz-content-slices.mjs';
import {reviewedEditorialVersions} from './quiz-reviewed-editorial-versions.mjs';
import {correctionQuestionPresentation} from './quiz-correction-presentation.mjs';
const norm=s=>s.normalize('NFKC').replace(/\s/gu,'');
const labelBody=s=>s.replace(/^[①②③④⑤⑥⑦⑧]\s*/u,'');
export const importerInstructions=[
 '依原題完成全部答案欄，再一起送出。',
 '依原題順序完成所有答案欄；同一份原題保留為一組。',
 '依原題順序完成下方所有答案欄；整組全部答對才計為一題。',
 '依原題完整作答；參考例答不作唯一正解，儲存後再自評。',
 '依原題保留開放作答；儲存後看參考例答與檢核重點，再完成自評。',
 '以原題代號填答，保留原填答要求。'
];
function linesOf(c){const s=sourceStream(c);if(s===null)return null;let pos=0;return s.split('\n').map(text=>{const start=pos;pos+=text.length+1;return {text,start,end:pos-1}});}
export function duplicateChoiceLines(q){
 const lines=linesOf(q.prompt);if(!lines)return [];const fields=q.type==='single'?[{id:'$single',options:q.options}]:q.fields||[],found=[];
 const marker=/^\s*(?:(?:[（(][ \t　]*[）)]|□)\s*)?(?:[①②③④⑤⑥⑦⑧]|[（(][0-9０-９]+[）)])\s*/u;
 for(const f of fields){if(!['single','sequence',undefined].includes(f.input)||!f.options?.length)continue;
  let scope=lines;const n=f.label?.match(/(?:第)?[（(]([0-9０-９]+)[）)]|第([0-9０-９]+)(?:小)?題/u),num=n?.[1]||n?.[2];
  if(num){const roots=lines.filter(l=>/^\s*[（(]([0-9０-９]+)[）)](?=[^（(])/u.test(l.text)),starts=roots.filter(l=>Number(l.text.match(/[0-9０-９]+/u)[0].normalize('NFKC'))===Number(num.normalize('NFKC')));if(starts.length===1){const start=starts[0].start,end=roots.find(l=>l.start>start)?.start??Infinity;scope=lines.filter(l=>l.start>start&&l.start<end);}}
  const candidates=f.options.map(o=>{const target=sourceStream(o.content);if(target===null)return [];return scope.filter(l=>{const m=l.text.match(marker);if(!m||norm(l.text.slice(m[0].length))!==norm(target.replace(marker,'')))return false;const source=sliceContent(q.prompt,l.start+m[0].length,l.end),urls=c=>(c.media||[]).map(m=>m.url).sort();return JSON.stringify(urls(source))===JSON.stringify(urls(o.content));});});
  if(candidates.every(c=>c.length===1)&&new Set(candidates.map(c=>c[0].start)).size===f.options.length)found.push(...candidates.map(([l])=>({field:f.id,start:l.start,end:l.end})));
 }
 return found;
}
export function duplicateChoiceBanks(q){
 const lines=linesOf(q.prompt);if(!lines)return [];
 const fields=q.type==='single'?[{id:'$single',options:q.options}]:q.fields||[],banks=[];
 for(const f of fields){if(!f.options?.length)continue;
  for(const l of lines){const marks=[...l.text.matchAll(/[①②③④⑤⑥⑦⑧]/gu)];if(marks.length<2||marks.length!==f.options.length||marks.some((m,i)=>m[0]!==String.fromCodePoint(0x2460+i)))continue;
   // Every full visible choice, including an inline image placeholder, must match.
   const options=f.options.map(o=>sourceStream(o.content));if(options.some(v=>v===null))continue;
   if(!marks.every((m,i)=>{
    if(norm(l.text.slice(m.index+1,marks[i+1]?.index??l.text.length))!==norm(labelBody(options[i])))return false;
    const source=sliceContent(q.prompt,l.start+m.index+1,l.start+(marks[i+1]?.index??l.text.length)),urls=c=>(c.media||[]).map(m=>m.url).sort();return JSON.stringify(urls(source))===JSON.stringify(urls(f.options[i].content));
   }))continue;
   banks.push({field:f.id,start:l.start+marks[0].index,end:l.end});
  }
 }
 return banks;
}
function correction(q){
 const lines=linesOf(q.prompt),notes=lines?.filter(l=>/^【(?:題目校訂|線上作答勘誤)】/u.test(l.text))||[];
 if(!notes.length)return {question:q,changes:[],issues:[]};
 if(reviewedEditorialVersions.has(q.id))return {question:{...q,prompt:omitRanges(q.prompt,notes.map(l=>[l.start,l.end]))},changes:[{kind:'reviewed_editorial_rationale'}],issues:[]};
 const mathIds=new Set(['hg6math_0115e07c_v87a7ba2ef5cc','hg6math_01aa7fd4_v452b94eb1e7d','hg6math_04aaa7b3_v8a4e00da731c']);
 if(mathIds.has(q.id)){
  let prompt=omitRanges(q.prompt,notes.map(l=>[l.start,l.end]));const text=sourceStream(prompt);let old,value;
  const quoted=notes[0].text.match(/原題「([^」]+)」.*本題線上按「([^」]+)」作答/u);
  if(quoted){old=quoted[1];value=quoted[2];}
  else if(q.id==='hg6math_04aaa7b3_v8a4e00da731c'){old='45';value='50';}
  if(!old||text.split(old).length!==2)return {question:q,changes:[],issues:[{code:'editorial_source_mapping_required'}]};
  prompt=replaceTextRange(prompt,text.indexOf(old),text.indexOf(old)+old.length,value);return {question:{...q,prompt},changes:[{kind:'stored_explicit_correction'}],issues:[]};
 }
 if(q.id==='ng6so_1423928_v30febebb3cd6'){
  const match=notes[0].text.match(/本次請判斷以下修訂句：(.+)$/u);if(!match)return {question:q,changes:[],issues:[{code:'editorial_source_mapping_required'}]};
  return {question:{...q,prompt:{text:match[1],media:q.prompt.media||[]}},changes:[{kind:'stored_explicit_correction'}],issues:[]};
 }
 if(q.id==='ng6so_1504424_v728e4b1b0327'){
  const m=notes[0].text.match(/^【題目校訂】選項④改為：(.+)原題仍問哪個選項錯誤。$/u),f=q.fields?.[0];if(!m||f?.options?.length!==4)return {question:q,changes:[],issues:[{code:'editorial_source_mapping_required'}]};
  return {question:{...q,prompt:omitRanges(q.prompt,notes.map(l=>[l.start,l.end])),fields:[{...f,options:f.options.map((o,i)=>i===3?{...o,content:{text:m[1].trim(),media:[]}}:o)}]},changes:[{kind:'stored_explicit_correction',field:f.id}],issues:[]};
 }
 return {question:q,changes:[],issues:[{code:'editorial_source_mapping_required'}]};
}
export function studentPromptContent(content){
 if(typeof content?.text!=='string')return content;
 let text=content.text,count=0,match;
 const heading=/^\s*(?:是非題|選擇題)[ \t　]*[:：]?[ \t　]*(?:\r?\n|$)/u;
 while((match=text.match(heading))){text=text.slice(match[0].length);count++;}
 if(!count||!text.trim())return content;
 if(!content.layout)return {...content,text:text.trimStart()};
 // Drop text-only heading paragraphs; keep all media indices, tables and runs.
 const layout=[...content.layout];let removed=0;
 while(layout.length){const p=layout[0];if(p.type!=='paragraph'||p.runs.some(r=>r.type!=='text'))break;
  const line=p.runs.map(r=>r.text).join('').trim();if(!line){layout.shift();continue;}
  if(removed<count&&/^(?:是非題|選擇題)[ \t　]*[:：]?$/u.test(line)){layout.shift();removed++;continue;}break;
 }
 return removed===count?{...content,text:text.trimStart(),layout}:content;
}
export function convertStudentContent(q){
 const original=q,changes=[],issues=[];if(!q||!['single','fields','short','open'].includes(q.type))return {question:q,changes,issues};
 const correctionView=correctionQuestionPresentation(q);if(correctionView!==q){q=correctionView;changes.push({kind:'source_reviewed_correction_instruction'});}
 const revised=correction(q);q=revised.question;changes.push(...revised.changes);issues.push(...revised.issues);
 if(issues.length)return revised;
 const lines=linesOf(q.prompt);if(!lines)return {question:q,changes,issues};const ranges=[];
 for(const l of lines){for(const instruction of importerInstructions)if(l.text.trimStart().startsWith(instruction)){const start=l.start+l.text.indexOf(instruction);ranges.push([start,start+instruction.length]);changes.push({kind:'importer_instruction'});}
  if(q.id==='kg6ch_ECH1511000865_v54da29360bed'&&(/^【線上題型調整：/u.test(l.text)||l.text.startsWith('原句：'))){ranges.push([l.start,l.end]);changes.push({kind:'superseded_source_note'});}
  // Only complete field-label lines are duplicated controls. Substrings in a
  // passage, unit labels and formulas with additional conditions stay intact.
  if(q.fields?.some(f=>f.label.length>12&&!/[①②③④⑤⑥⑦⑧]/u.test(f.label)&&norm(f.label)===norm(l.text))&&!l.text.includes('\ufffc')){ranges.push([l.start,l.end]);changes.push({kind:'repeated_field_label'});}
 }
 for(const b of duplicateChoiceBanks(q)){if(!ranges.some(([a,z])=>a===b.start&&z===b.end))ranges.push([b.start,b.end]);changes.push({kind:'duplicated_choice_bank',field:b.field});}
 for(const b of duplicateChoiceLines(q)){if(!ranges.some(([a,z])=>a===b.start&&z===b.end))ranges.push([b.start,b.end]);changes.push({kind:'duplicated_choice_line',field:b.field});}
 if(ranges.length)q={...q,prompt:omitRanges(q.prompt,ranges)};
 if(q.fields){const stem=norm(q.prompt.text);const fields=q.fields.map((f,i)=>{
  if(!['text','math'].includes(f.input)||/[①②③④⑤⑥⑦⑧]/u.test(f.label)||norm(f.label).length<=12||!stem.includes(norm(f.label)))return f;
  const unit=f.label.match(/[（(]([^（）()]{1,12})[）)]$/u)?.[0]||'';changes.push({kind:'repeated_field_caption',field:f.id});return {...f,label:(q.fields.length===1?'答案':`第${i+1}欄答案`)+unit};
 });if(fields.some((f,i)=>f!==q.fields[i]))q={...q,fields};}
 if(changes.length){q={...q,prompt:compactParagraphs(q.prompt)};return {question:q,changes,issues};}
 return {question:original,changes,issues};
}
