// Student content only: outer controls, response types, IDs and answers stay put.
import {sourceStream,sliceContent,omitRanges,replaceTextRange,compactParagraphs} from './quiz-content-slices.mjs';
const plain=text=>({text,media:[]});
const normalize=s=>s.normalize('NFKC').replace(/\s/gu,'').replace(/\$|\\[()]/gu,'').replace(/\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}/gu,'$1/$2').replace(/\(([0-9]+\/[0-9]+)\)/gu,'$1');
const marker=/^\s*(?:(?:[（(][ \t　]*[）)]|[□☐])\s*)?(?:[（(]([0-9０-９]+)[）)]|([①②③④⑤⑥⑦⑧⑨⑩])|([0-9０-９]+)(?=[^0-9０-９]))\s*|^\s*[□☐]\s*/u;
const body=s=>s.replace(marker,'').trim();
const instructions=['依原題完成全部答案欄，再一起送出。','原本逐項打ˇ／╳者：每小題選出所有正確敘述，未選表示不正確；若全部不正確，勾選「這些選項都不選」。'];
const typeCaptions=['是的打ˇ．不是的打╳','對的畫○．不對的打╳'];
// Existing source-reviewed immutable versions, not newly generated corrections.
const reviewedEditorialIds=new Set(['ng6so_1504928_vffac738473bf','ng6so_1504971_v65b768e66af1']);
function storedReview(q){
 if(!reviewedEditorialIds.has(q.id)||q.fields.length!==1||q.fields[0].input!=='set')return null;
 const notes=q.prompt.text.split('\n').filter(s=>s.startsWith('【')),edits=notes.filter(s=>s.startsWith('【題目校訂】'));
 if(edits.length!==1)return null;const m=edits[0].match(/^【題目校訂】第[（(]([0-9０-９]+)[）)]項改為[：:](.+)$/u);if(!m)return null;
 const field=q.fields[0],option=field.options[Number(m[1].normalize('NFKC'))-1];if(!option)return null;
 return {questionId:q.id,removeNotes:notes,contextNote:notes.filter(s=>s.startsWith('【用語說明】')).map(s=>s.replace('【用語說明】','')).join('\n'),optionRevisions:[{fieldId:field.id,optionId:option.id,expectedText:body(option.content.text),text:m[2]}]};
}
function sourceLines(content){const text=sourceStream(content);if(text===null)return null;let pos=0;return text.split('\n').map(text=>{const start=pos;pos+=text.length+1;return {text,start,end:pos-1,match:text.match(marker)}});}
function inlineBank(line,f){
 const marks=[...line.text.matchAll(/[①②③④⑤⑥⑦⑧]/gu)];if(marks.length!==f.options.length||marks.some((m,i)=>m[0]!==String.fromCodePoint(0x2460+i)))return null;
 const texts=marks.map((m,i)=>line.text.slice(m.index+1,marks[i+1]?.index??line.text.length));
 return texts.every((s,i)=>normalize(s)===normalize(body(f.options[i].content.text)))?{line,marks}:null;
}
function fieldLines(lines,f){
 const n=f.label?.match(/(?:第)?[（(]([0-9０-９]+)[）)]/u)?.[1];if(!n)return lines;
 const roots=lines.filter(l=>/^\s*[（(]([0-9０-９]+)[）)](?=[^（(])/u.test(l.text));
 const starts=roots.filter(l=>Number(l.text.match(/[0-9０-９]+/u)[0].normalize('NFKC'))===Number(n.normalize('NFKC')));
 if(starts.length!==1)return lines;const start=starts[0].start,end=roots.find(l=>l.start>start)?.start??Infinity;return lines.filter(l=>l.start>start&&l.start<end);
}
export function checkboxPresentationIssues(source,view){
 const issues=[],fail=code=>issues.push({code});
 if(source.type!==view.type||source.fields?.length!==view.fields?.length||JSON.stringify(source.answer)!==JSON.stringify(view.answer))fail('checkbox_contract_changed');
 for(const [i,f]of(source.fields||[]).entries()){
  const v=view.fields?.[i];if(!v||f.id!==v.id||f.input!==v.input||JSON.stringify(f.options?.map(o=>o.id))!==JSON.stringify(v.options?.map(o=>o.id)))fail('checkbox_contract_changed');
  if(f.input==='set'){
   const lines=fieldLines(sourceLines(view.prompt)||[],v);
   for(const o of v?.options||[]){const text=normalize(body(o.content.text));if(text.length>3&&lines.some(l=>l.match&&normalize(l.text.slice(l.match[0].length))===text))fail('checkbox_duplicate_statement');}
   if(lines.some(l=>inlineBank(l,v)))fail('checkbox_duplicate_statement');
  }
 }
 if(instructions.some(s=>view.prompt.text.includes(s))||/【題目校訂】/u.test(view.prompt.text))fail('checkbox_importer_text_visible');return issues;
}
export function convertCheckboxQuestion(q,{reviewedPresentation}={}){
 const result={question:q,changes:[],issues:[]};if(q?.type!=='fields'||!q.fields?.some(f=>f.input==='set'))return result;
 const lines=sourceLines(q.prompt);if(!lines)return result;
 const ranges=[],fields=q.fields.map(f=>f.options?{...f,options:f.options.map(o=>({...o}))}:{...f}),review=reviewedPresentation??storedReview(q);let matched=false;
 for(const [fi,f]of q.fields.entries()){
  if(f.input!=='set')continue;
  const scope=fieldLines(lines,f),banks=scope.map(l=>inlineBank(l,f)).filter(Boolean);
  if(banks.length===1){const {line,marks}=banks[0];ranges.push([line.start+marks[0].index,line.end]);matched=true;result.changes.push({field:f.id,kind:'checkbox_inline_choices'});continue;}
  const candidates=f.options.map(o=>{const target=normalize(body(o.content.text));if(!target||o.content.media?.length)return [];const exact=scope.filter(l=>l.match&&normalize(l.text.slice(l.match[0].length))===target);if(exact.length)return exact;const n=o.content.text.match(marker)?.[1];return n?scope.filter(l=>l.match?.[1]?.normalize('NFKC')===n.normalize('NFKC')&&l.text.slice(l.match[0].length).trim()==='\ufffc'):[];});
  if(!candidates.every(c=>c.length===1)||new Set(candidates.map(c=>c[0]?.start)).size!==f.options.length){if(candidates.some(c=>c.length))result.issues.push({field:f.id,code:'checkbox_source_mapping_required'});continue;}
  matched=true;for(const [line]of candidates)ranges.push([line.start,line.end]);
  fields[fi]={...f,options:f.options.map((o,i)=>{const content=sliceContent(q.prompt,candidates[i][0].start+candidates[i][0].match[0].length,candidates[i][0].end);if(content.media.length&&!content.text.trim()){content.text=body(o.content.text);content.layout.push({type:'paragraph',runs:[{type:'text',text:content.text}]});}return {...o,content}})};result.changes.push({field:f.id,kind:'checkbox_student_view'});
 }
 for(const line of lines){for(const instruction of instructions){const i=line.text.indexOf(instruction);if(i>=0)ranges.push([line.start+i,line.start+i+instruction.length]);}if(typeCaptions.includes(line.text.trim()))ranges.push([line.start,line.end]);}
 if(!matched&&!ranges.length)return result;
 if(!matched)result.changes.push({field:null,kind:'checkbox_importer_instruction'});
 if(review){
  if(review.questionId!==q.id)return {question:q,changes:[],issues:[{code:'checkbox_revision_source_mismatch'}]};
  for(const note of review.removeNotes||[]){const found=lines.filter(l=>l.text===note);if(found.length!==1)return {question:q,changes:[],issues:[{code:'checkbox_revision_note_mismatch'}]};ranges.push([found[0].start,found[0].end]);}
  for(const revision of review.optionRevisions||[]){const f=fields.find(f=>f.id===revision.fieldId),o=f?.options.find(o=>o.id===revision.optionId);if(!o||normalize(body(o.content.text))!==normalize(revision.expectedText)||!revision.text?.trim())return {question:q,changes:[],issues:[{code:'checkbox_revision_source_mismatch'}]};o.content=plain(revision.text.trim());}
 }
 let prompt=omitRanges(q.prompt,ranges);
 if(q.id==='ng6so_1504678_vfd75a4210e3c'){
  const note='【題目校訂】第(4)小題所指援助國家，請依第(3)小題判斷。',stream=sourceStream(prompt),noteAt=stream.indexOf(note),line=sourceLines(prompt).find(l=>/^\(４\)依據第\(１\)題的答案/u.test(l.text));
  if(noteAt>=0&&line){const old='依據第(１)題的答案',at=line.start+line.text.indexOf(old);prompt=replaceTextRange(prompt,at,at+old.length,'依據第(３)題的答案');const current=sourceStream(prompt),n=current.indexOf(note);prompt=omitRanges(prompt,[[n,n+note.length]]);}
 }
 if(/【題目校訂】/u.test(prompt.text))return {question:q,changes:[],issues:[...result.issues,{code:'checkbox_editorial_review_required'}]};
 const suffix=/依題意回答下列問題，正確的，請在（\s*）裡打ˇ，錯誤的打╳：/u,stream=sourceStream(prompt),m=stream?.match(suffix);if(m)prompt=omitRanges(prompt,[[m.index,m.index+m[0].length]]);
 if(review?.contextNote){const note=plain(review.contextNote);prompt={...prompt,text:(prompt.text+'\n'+note.text).trim(),layout:[...(prompt.layout??[{type:'paragraph',runs:[{type:'text',text:prompt.text}]}]),{type:'paragraph',runs:[{type:'text',text:note.text}]}]};}
 prompt=compactParagraphs(prompt);for(const f of fields)if(f.input==='set')f.options=f.options.map(o=>({...o,content:compactParagraphs(o.content)}));
 result.question={...q,prompt,fields};return result;
}
