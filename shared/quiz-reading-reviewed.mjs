import {sourceStream,sliceContent,omitRanges,replaceTextRange,compactParagraphs} from './quiz-content-slices.mjs';
import {numberedReadingPresentation} from './quiz-reading-numbered.mjs';
import {readingSignature} from './quiz-reading-signature.mjs';
import {reviewedReadingSources} from './quiz-reading-reviewed-sources.mjs';
const plain=text=>({text,media:[]}),compact=s=>s.replace(/\s/gu,'');
const sameBank=(a,b)=>a.length===b.length&&a.every((o,i)=>o.content.text===b[i].content.text);
const importerPrefixes=['本題保留原圖，改用下方選項作答。整個題組全部答對才計為一題。','本題線上改用選答，請用下方欄位完成原題，不必另外在原空格打字。','本題線上改用下方選項作答，原圖表保留，不必在原空格打字。','本題用下方選項作答，原圖表保留。','這裡請在下方逐項選擇對應的原代號，選完所有項目後再送出。','請在下方依原圖、原題逐項作答，完成全部項目後再送出。','請在下方依原圖、原表逐項作答，完成全部項目後再送出。','請依原圖與下方欄位完成全部小題，再送出。'];
function cleanImporterPrefix(content){const text=sourceStream(content);if(text===null)return content;const prefix=importerPrefixes.find(p=>text.startsWith(p));return prefix?compactParagraphs(omitRanges(content,[[0,prefix.length]])):content;}
function sentenceRange(text,start,end){
 let a=start;while(a>0&&!/[\n.!?。！？]/u.test(text[a-1]))a--;
 let b=end;while(b<text.length&&!/[\n.!?。！？]/u.test(text[b]))b++;if(b<text.length)b++;
 return [a,b];
}
function blankContexts(content,blanks){
 const text=sourceStream(content);return blanks.map((blank,i)=>{const [a,b]=sentenceRange(text,blank[0],blank[1]);let result=text.slice(a,b);
  for(let j=blanks.length-1;j>=0;j--){const [x,y]=blanks[j];if(x>=a&&y<=b)result=result.slice(0,x-a)+(j===i?`【第${j+1}空】`:`（第${j+1}空）`)+result.slice(y-a);}
  return plain(`第${i+1}空：${result.trim()}`);
 });
}
function numberedBlanks(text,count){
 const blanks=[...text.matchAll(/_*[（(]\s*([0-9]+)\s*[）)]\s*_+/gu)];
 if(blanks.length!==count||blanks.some((m,i)=>Number(m[1])!==i+1))return null;
 return blanks.map(m=>[m.index,m.index+m[0].length]);
}
function showBlanks(content,blanks){let result=content;for(let i=blanks.length-1;i>=0;i--)result=replaceTextRange(result,...blanks[i],`（第${i+1}空）`);return result;}
function cloze(q){
 const text=sourceStream(q.prompt);if(text===null||q.fields.some(f=>f.input!=='single'))return null;
 const found=[...text.matchAll(/[（(]([^（）()\n]*)[）)]/gu)],blanks=[];
 for(const m of found){const f=q.fields[blanks.length];if(!f)break;const parts=m[1].split(/[\/／、]/u).map(s=>s.trim());
  if(!m[1].trim()||parts.length===f.options.length&&parts.every((v,i)=>v===f.options[i].content.text.trim()))blanks.push([m.index,m.index+m[0].length]);
 }
 if(blanks.length!==q.fields.length)return null;
 const questions=blankContexts(q.prompt,blanks);let passage=showBlanks(q.prompt,blanks);
 if(q.fields.every(f=>sameBank(f.options,q.fields[0].options))){const stream=sourceStream(passage),bank=[...stream.matchAll(/[（(]([^（）()\n]*)[）)]/gu)].find(m=>m[1].trim().split(/\s+/u).join('|')===q.fields[0].options.map(o=>o.content.text.trim()).join('|'));if(bank)passage=omitRanges(passage,[[bank.index,bank.index+bank[0].length]]);}
 return {passage,questions,fields:q.fields,context:true};
}
function sharedCloze(q){
 const text=sourceStream(q.prompt);if(text===null)return null;
 const line=text.match(/^[ \t　]*A[.．][^\n]+/mu);if(!line)return null;
 const marks=[...line[0].matchAll(/([A-H])[.．]\s*/gu)],codes=q.fields[0].options.map(o=>o.content.text.trim());
 if(marks.length!==codes.length||marks.some((m,i)=>m[1]!==codes[i])||q.fields.some(f=>!sameBank(f.options,q.fields[0].options)))return null;
 const fields=q.fields.map(f=>({...f,options:f.options.map((o,i)=>({...o,content:plain(line[0].slice(marks[i].index+marks[i][0].length,marks[i+1]?.index??line[0].length).trim())}))}));
 const passage=omitRanges(q.prompt,[[line.index,line.index+line[0].length]]),stream=sourceStream(passage),blanks=numberedBlanks(stream,q.fields.length);if(!blanks)return null;
 return {passage:showBlanks(passage,blanks),questions:blankContexts(passage,blanks),fields,context:true};
}
function inlineCloze(q){
 const text=sourceStream(q.prompt),blanks=text===null?null:numberedBlanks(text,q.fields.length);if(!blanks)return null;
 const contexts=blankContexts(q.prompt,blanks),p=numberedReadingPresentation(q,{fieldIndices:q.fields.map((_,i)=>i),sourceNumbers:q.fields.map((_,i)=>i+1),inlineBanks:true,minimumPassage:0,contexts});
 if(!p)return null;const stream=sourceStream(p.passage),remaining=numberedBlanks(stream,q.fields.length);if(!remaining)return null;
 return {...p,passage:showBlanks(p.passage,remaining)};
}
function pictureBank(q){
 const text=sourceStream(q.prompt);if(text===null||q.prompt.media.length!==q.fields.length||q.fields.some(f=>f.input!=='single'))return null;
 const marks=[...text.matchAll(/[（(]([A-H])[）)]/gu)],codes=q.fields[0].options.map(o=>o.content.text.trim()),images=[...text.matchAll(/\ufffc/gu)];
 if(marks.length!==codes.length||marks.some((m,i)=>m[1]!==codes[i])||images.length!==q.fields.length||q.fields.some(f=>!sameBank(f.options,q.fields[0].options)))return null;
 const before=text.slice(0,images[0].index),blank=before.match(/[（(][ \t　]*[）)]\s*$/u);if(!blank)return null;const end=blank.index;
 const fields=q.fields.map((f,i)=>({...f,label:`第${i+1}圖`,options:f.options.map((o,j)=>({...o,content:sliceContent(q.prompt,marks[j].index+marks[j][0].length,marks[j+1]?.index??end)}))}));
 if(fields.some(f=>f.options.some(o=>!o.content.text.trim())))return null;
 const questions=images.map((m,i)=>{const image=sliceContent(q.prompt,m.index,m.index+1);return {...image,text:`第${i+1}圖`,layout:[{type:'paragraph',runs:[{type:'text',text:`第${i+1}圖`}]},...image.layout]};});
 return {passage:plain('看圖片，選出對應的句子。'),questions,fields,context:true,standalone:true};
}
function matching(q,firstCount){
 const text=sourceStream(q.prompt);if(text===null)return null;
 const tail=text.match(/^[ \t　]*[（(][２2][）)]([^\n]*)/mu);if(!tail)return null;
 const part=text.slice(tail.index),marks=[...part.matchAll(/[①②③④⑤⑥⑦⑧]/gu)],count=q.fields.length-firstCount;
 if(marks.length!==count||marks.some((m,i)=>m[0]!==String.fromCharCode(0x2460+i)))return null;
 const questions=q.fields.map((f,i)=>i<firstCount?plain(f.label+'：請選擇對應的'+(firstCount===3?'實施年份。':'英文簡稱。')):sliceContent(q.prompt,tail.index+marks[i-firstCount].index+1,tail.index+(marks[i-firstCount+1]?.index??part.length)));
 return {passage:compactParagraphs(omitRanges(q.prompt,[[tail.index,text.length]])),questions,fields:q.fields,context:true};
}
export function projectReviewedReading(q,plan){
 let result=null;
 if(plan.kind==='cloze')result=cloze(q);
 else if(plan.kind==='shared-cloze')result=sharedCloze(q);
 else if(plan.kind==='inline-cloze')result=inlineCloze(q);
 else if(plan.kind==='picture-bank')result=pictureBank(q);
 else if(plan.kind==='matching')result=matching(q,plan.firstCount);
 else if(['numbered','table','menu'].includes(plan.kind)){
  result=numberedReadingPresentation(q,{fieldIndices:plan.indices,sourceNumbers:plan.numbers,minimumPassage:0,inlineBanks:true,retainOtherQuestions:plan.kind==='table'});
  if(result&&plan.kind==='menu')for(const [i,name]of ['漢堡','三明治','披薩'].entries())result.questions[i]=plain(`原圖第${i+1}格：${name}的金額（元）`);
  if(result&&result.passage.text.length<60&&!result.passage.media.length)result.standalone=true;
 }else if(plan.kind==='context'){
  result=numberedReadingPresentation(q,{fieldIndices:q.fields.map((_,i)=>i),sourceNumbers:q.fields.map((_,i)=>i+1),minimumPassage:0,inlineBanks:true});
  if(!result)result={passage:q.prompt,questions:q.fields.map(()=>null),fields:q.fields,context:true};
 }
 if(!result)return null;
 return {...result,passage:cleanImporterPrefix(result.passage),reviewed:true,reviewKind:plan.kind,issues:result.issues||[]};
}
export function reviewedReadingPresentation(q){
 const plans=reviewedReadingSources[q.id];if(!plans)return null;
 const plan=plans.find(p=>p.guard===readingSignature(q));if(!plan)return null;
 return projectReviewedReading(q,plan);
}
