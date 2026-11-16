// Deterministic source-to-choice conversion, shared by import and legacy views.
// Never reads answers, changes IDs, or mutates a fixed document.
import {booleanChoicePresentation} from './quiz-boolean-choice.mjs';
import {convertCheckboxQuestion} from './quiz-checkbox-presentation.mjs';
import {sourceStream,sliceContent,omitRanges} from './quiz-content-slices.mjs';
const circles='①②③④⑤⑥⑦⑧';
const instructions=['依原題完成全部答案欄，再一起送出。','依原題順序完成所有答案欄；同一份原題保留為一組。'];
const compact=s=>s.replace(/\s/gu,'');
const plain=text=>({text,media:[]});
function codeOptions(options){
 if(!Array.isArray(options)||options.length<2||options.length>8)return false;
 return new Set(options.map(o=>o.content?.text?.trim())).size===options.length&&options.every(o=>o.content?.text?.trim().length===1&&circles.slice(0,options.length).includes(o.content.text.trim())&&!o.content.media?.length&&
  compact(sourceStream(o.content)??'')===compact(o.content.text)&&
  (!o.content.layout||o.content.layout.every(p=>p.type==='paragraph'&&p.runs.every(r=>r.type==='text'))));
}
function sourceHeaders(text){
 const header=/^[ \t　]*(?:[（(][\sˉ_　]*[）)]\s*(?:[（(]([0-9０-９]{1,2})[）)]|([0-9０-９]{1,2}))|[（(]([0-9０-９]{1,2})[）)]|([0-9０-９]{1,2})[.．、]|([０-９]{1,2})(?=[^0-9０-９.．、]))/gmu;
 return [...text.matchAll(header)].map(m=>({n:Number((m[1]||m[2]||m[3]||m[4]||m[5]).normalize('NFKC')),start:m.index}));
}
function numberedSegments(text,count){
 const matches=sourceHeaders(text);
 // Require an unambiguous complete numbered run, never guess by marker count.
 const candidates=[];for(let i=0;i<matches.length;i++)if(matches[i].n===1&&matches.slice(i,i+count).length===count&&matches.slice(i,i+count).every((m,j)=>m.n===j+1))candidates.push(matches.slice(i,i+count));
 if(candidates.length!==1)return null;const selected=candidates[0];
 return selected.map((m,i)=>[m.start,selected[i+1]?.start??text.length]);
}
function splitOptions(content,options,start,end){
 const text=sourceStream(content),segment=text.slice(start,end),marks=[...segment.matchAll(/[①②③④⑤⑥⑦⑧]/gu)];
 // Ignore references/annotations before the final complete option run.
 const runs=[];for(let i=0;i<marks.length;i++)if(marks[i][0]==='①'&&marks.slice(i,i+options.length).length===options.length&&marks.slice(i,i+options.length).every((m,j)=>m[0]===circles[j])&&i+options.length===marks.length)runs.push(marks.slice(i));
 if(runs.length!==1)return null;const chosen=runs[0];
 const converted=options.map(o=>{const i=circles.indexOf(o.content.text.trim());return {...o,content:sliceContent(content,start+chosen[i].index+1,start+(chosen[i+1]?.index??segment.length))};});
 if(converted.some(o=>!o.content.text.trim()&&!o.content.media.length))return null;
 return {options:converted,range:[start+chosen[0].index,end]};
}
function cleanInstruction(c){
 const stream=sourceStream(c);if(stream===null)return c;const ranges=[];
 for(const value of instructions){let from=0;while(true){const i=stream.indexOf(value,from);if(i<0)break;ranges.push([i,i+value.length]);from=i+value.length;}}
 return ranges.length?omitRanges(c,ranges):c;
}
function sharedOptions(content,fields,coded){
 const text=sourceStream(content);if(text===null||fields.length<2||!coded.length||!coded.every(i=>fields[i].options.length===fields[coded[0]].options.length))return null;
 const options=fields[coded[0]].options,n=options.length,marks=[...text.matchAll(/[①②③④⑤⑥⑦⑧]/gu)],banks=[];
 for(let i=0;i<marks.length;i++)if(marks[i][0]==='①'&&marks.slice(i,i+n).length===n&&marks.slice(i,i+n).every((m,j)=>m[0]===circles[j])&&(!marks[i+n]||marks[i+n][0]==='①'))banks.push(marks.slice(i,i+n));
 if(banks.length!==1)return null;const bank=banks[0],last=bank.at(-1).index;
 const nextHeader=sourceHeaders(text).find(h=>h.start>last)?.start;
 const arrow=[...text.matchAll(/^\s*→/gmu)].find(m=>m.index>last)?.index;
 const end=Math.min(nextHeader??Infinity,arrow??Infinity);
 if(!Number.isFinite(end))return null;
 return splitOptions(content,options,bank[0].index,end);
}
function convertSingleChoiceQuestion(q){
 const changes=[],issues=[];if(!q||!['fields','single'].includes(q.type))return {question:q,changes,issues};
 const fields=q.type==='single'?[{id:'$single',input:'single',options:q.options}]:q.fields;
 if(!Array.isArray(fields))return {question:q,changes,issues};
 const converted=fields.map(f=>f),ranges=[],text=sourceStream(q.prompt);
 const coded=fields.map((f,i)=>f.input==='single'&&codeOptions(f.options)?i:-1).filter(i=>i>=0);
 const segments=fields.length===1?[[0,text?.length??0]]:text!==null?numberedSegments(text,fields.length):null;
 const mixedSegments=!segments&&text!==null&&coded.length&&fields.filter(f=>f.input==='single').length===coded.length?numberedSegments(text,coded.length):null;
 const sharedBank=sharedOptions(q.prompt,fields,coded);
 for(const [i,f]of fields.entries()){
  if(f.input!=='single')continue;
  const display=booleanChoicePresentation(f.options);
  if(display){const options=f.options.map((o,j)=>({...o,content:plain(display[j].badge+' '+display[j].text)}));
   if(options.some((o,j)=>compact(o.content.text)!==compact(f.options[j].content.text)||f.options[j].content.layout)){converted[i]={...f,options};changes.push({field:f.id,kind:'boolean'});}continue;
  }
  if(!coded.includes(i))continue;
  const shared=sharedBank?{...sharedBank,options:f.options.map(o=>{const j=fields[coded[0]].options.findIndex(original=>original.content.text.trim()===o.content.text.trim());return {...o,content:sharedBank.options[j].content};})}:null;
  const segment=segments?.[i]??mixedSegments?.[coded.indexOf(i)];
  const part=shared??(text!==null&&segment?splitOptions(q.prompt,f.options,...segment):null);
  if(!part){issues.push({field:f.id,code:'choice_source_mapping_required'});continue;}
  converted[i]={...f,options:part.options};if(!ranges.some(r=>r[0]===part.range[0]&&r[1]===part.range[1]))ranges.push(part.range);changes.push({field:f.id,kind:shared?'shared_choice_bank':'inline_choices'});
 }
 let prompt=ranges.length?omitRanges(q.prompt,ranges):q.prompt;
 if(fields.length===1&&fields[0].input==='single'){const cleaned=cleanInstruction(prompt);if(cleaned!==prompt)changes.push({field:fields[0].id,kind:'instruction'});prompt=cleaned;}
 if(!changes.length)return {question:q,changes,issues};
 const question=q.type==='single'?{...q,prompt,options:converted[0].options}:{...q,prompt,fields:converted};
 return {question,changes,issues};
}
export function convertChoiceQuestion(q,options={}){
 const checkbox=convertCheckboxQuestion(q,options),single=convertSingleChoiceQuestion(checkbox.question);
 return {...single,changes:[...checkbox.changes,...single.changes],issues:[...checkbox.issues,...single.issues]};
}
export const choiceQuestionPresentation=q=>convertChoiceQuestion(q).question;
export function choiceAnswerLabel(q,value){const options=choiceQuestionPresentation(q).options||[],i=options.findIndex(o=>o.id===value);if(i<0)return '未選';const display=booleanChoicePresentation(options)?.[i];return display?display.badge+' '+display.text:String.fromCharCode(65+i);}
