import {sourceStream,replaceTextRange,omitRanges,compactParagraphs} from './quiz-content-slices.mjs';
import {convertStudentContent} from './quiz-student-content.mjs';
import {optionLabelProjection} from './quiz-option-labels.mjs';
const reviewed=new Map([
 ['kxg3ch_ECH1505002732_v12068ec9562d',6],['kxg3ch_ECH1505003949_v2c211131ffdd',5],
 ['kxg3ch_ECH1505004122_v29cbe919c9ab',5],['kxg3ch_ECH1505004444_v677084c12fb1',6],
 ['kxg3ch_ECH1505004619_v62a5cf14a90e',7],['ng6so_1504552_v6c3404290567',3],
 ['ng6so_1504680_vd65a21489543',4],['ng6so_1504681_v37d142b64dc2',3],['ng6so_1504682_v896e25d416a2',5]
]);
export const reviewedSequenceQuestion=q=>q?.type==='fields'&&q.fields?.length===1&&q.fields[0].input==='sequence'&&reviewed.get(q.id)===q.fields[0].options?.length;
export function sequenceFieldPresentation(q,field){
 if(!reviewedSequenceQuestion(q)||field.id!==q.fields[0].id)return field;
 const projected=optionLabelProjection(field.options);
 if(projected.status==='projected')return {...field,label:'排列順序',options:projected.options};
 const streams=field.options.map(o=>sourceStream(o.content));
 const marks=streams.map((s,i)=>s?.match(new RegExp('^\\s*'+String.fromCharCode(65+i)+'[.．、]?\\s+','u')));
 if(marks.every(Boolean))return {...field,label:'排列順序',options:field.options.map((o,i)=>({...o,content:replaceTextRange(o.content,0,marks[i][0].length,'')}))};
 return {...field,label:'排列順序'};
}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function sequencePromptPresentation(q){
 if(!reviewedSequenceQuestion(q))return null;
 let content=convertStudentContent(q).question.prompt,stream=sourceStream(content);if(stream===null)return content;
 const field=sequenceFieldPresentation(q,q.fields[0]),matches=field.options.map((o,i)=>{
  const body=sourceStream(o.content);if(body===null)return [];
  const code=String.fromCodePoint(0x2460+i)+'|'+String.fromCharCode(65+i)+'[.．、]?';
  const pattern=new RegExp('(?:'+code+')\\s*'+[...body.replace(/\s/gu,'')].map(escape).join('\\s*'),'gu');
  return [...stream.matchAll(pattern)];
 });
 if(matches.every(m=>m.length===1))content=omitRanges(content,matches.map(([m])=>[m.index,m.index+m[0].length]));
 const replacements=[[/[（(]寫代號[）)]/gu,''],[/，?將代號填入[（(]\s*[）)]裡/gu,''],[/在時間軸的[（(]\s*[）)]裡填入適當的代號/gu,'排列卡片']];
 for(const [pattern,value]of replacements){stream=sourceStream(content);for(const m of [...stream.matchAll(pattern)].reverse())content=replaceTextRange(content,m.index,m.index+m[0].length,value);}
 stream=sourceStream(content);const ranges=[];let start=0;
 for(const line of stream.split('\n')){
  const bare=line.replace(/^\s*答[:：]/u,'').trim();
  if(line.trim()==='填充題'||/[（(]/u.test(bare)&&/^[↓→↑↘（）()\s_－-]+$/u.test(bare))ranges.push([start,start+line.length]);
  start+=line.length+1;
 }
 return compactParagraphs(ranges.length?omitRanges(content,ranges):content);
}
// Source letters identify options, not the student's current card positions.
export function sequenceExplanationChanges(q,text){
 if(!reviewedSequenceQuestion(q))return [];
 const field=q.fields[0],view=sequenceFieldPresentation(q,field),mapping=new Map();
 for(const [i,o]of field.options.entries()){
  const code=sourceStream(o.content)?.match(/^\s*([①②③④⑤⑥⑦⑧A-H])(?:[.．、]?\s*)/u)?.[1];
  if(code&&view.options[i].content.text.trim())mapping.set(code,view.options[i].content.text.trim());
 }
 const changes=[];
 for(const m of text.matchAll(/[（(]([A-H])[）)]/gu))if(mapping.has(m[1]))changes.push({start:m.index,end:m.index+m[0].length,replacement:'',kind:'sequence_reference',field:field.id});
 for(const m of text.matchAll(/(?<![A-Za-z0-9])([①②③④⑤⑥⑦⑧A-H])(?:\s*→\s*[①②③④⑤⑥⑦⑧A-H])+(?![A-Za-z0-9])/gu)){
  const codes=m[0].split(/\s*→\s*/u);if(codes.every(code=>mapping.has(code)))changes.push({start:m.index,end:m.index+m[0].length,replacement:codes.map(code=>'「'+mapping.get(code)+'」').join('→'),kind:'sequence_reference',field:field.id});
 }
 return changes.sort((a,b)=>a.start-b.start);
}
