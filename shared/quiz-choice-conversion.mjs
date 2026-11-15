// Deterministic source-to-choice conversion, shared by import and legacy views.
// Never reads answers, changes IDs, or mutates a fixed document.
import {booleanChoicePresentation} from './quiz-boolean-choice.mjs';
const circles='①②③④⑤⑥⑦⑧';
const instructions=['依原題完成全部答案欄，再一起送出。','依原題順序完成所有答案欄；同一份原題保留為一組。'];
const compact=s=>s.replace(/\s/gu,'');
const plain=text=>({text,media:[]});
function sourceStream(c){
 if(!c?.layout)return typeof c?.text==='string'&&!c.media?.length?c.text:null;
 if(c.layout.some(p=>p.type!=='paragraph'||!Array.isArray(p.runs)||p.runs.some(r=>!['text','image'].includes(r.type))))return null;
 // A placeholder gives each original image a stable source position.
 return c.layout.map(p=>p.runs.map(r=>r.type==='text'?r.text:'\ufffc').join('')).join('\n');
}
function sliceContent(c,start,end){
 if(!c.layout)return plain(c.text.slice(start,end).trim());
 let cursor=0;const layout=[],media=[],indices=new Map();
 for(const p of c.layout){const runs=[];
  for(const r of p.runs){const length=r.type==='text'?r.text.length:1,a=Math.max(start,cursor),b=Math.min(end,cursor+length);
   if(a<b){if(r.type==='text')runs.push({...r,text:r.text.slice(a-cursor,b-cursor)});
    else{if(!indices.has(r.media_index)){indices.set(r.media_index,media.length);media.push(c.media[r.media_index]);}runs.push({...r,media_index:indices.get(r.media_index)});}}
   cursor+=length;
  }
  if(runs.length)layout.push({...p,runs});cursor++;
 }
 const text=layout.map(p=>p.runs.filter(r=>r.type==='text').map(r=>r.text).join('')).join('\n').trim();
 return {text,media,layout};
}
function omitRanges(c,ranges){
 const text=sourceStream(c);if(text===null)return c;
 if(!c.layout){let result=text;for(const [a,b]of [...ranges].sort((a,b)=>b[0]-a[0]))result=result.slice(0,a)+result.slice(b);return plain(result.trim());}
 // Keep paragraph/run styles and source images. Adjacent retained slices are
 // complete paragraphs except at a choice boundary; empty pieces are harmless.
 const sorted=[...ranges].sort((a,b)=>a[0]-b[0]),parts=[];let pos=0;
 for(const [a,b]of sorted){if(a>pos)parts.push(sliceContent(c,pos,a));pos=Math.max(pos,b);}if(pos<text.length)parts.push(sliceContent(c,pos,text.length));
 const media=[],layout=[];for(const part of parts){const offset=media.length;media.push(...part.media);layout.push(...part.layout.map(p=>({...p,runs:p.runs.map(r=>r.type==='image'?{...r,media_index:r.media_index+offset}:r)})));}
 // Audio is attached to the content rather than an inline run. It stays with
 // the prompt, including when only an importer instruction is removed.
 const referenced=new Set(c.layout.flatMap(p=>p.runs.filter(r=>r.type==='image').map(r=>r.media_index)));
 media.push(...(c.media||[]).filter((_,i)=>!referenced.has(i)));
 return {text:layout.map(p=>p.runs.filter(r=>r.type==='text').map(r=>r.text).join('')).join('\n').trim(),media,layout};
}
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
export function convertChoiceQuestion(q){
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
export const choiceQuestionPresentation=q=>convertChoiceQuestion(q).question;
export function choiceAnswerLabel(q,value){const options=choiceQuestionPresentation(q).options||[],i=options.findIndex(o=>o.id===value);if(i<0)return '未選';const display=booleanChoicePresentation(options)?.[i];return display?display.badge+' '+display.text:String.fromCharCode(65+i);}
