import {sourceStream,sliceContent,omitRanges,compactParagraphs} from './quiz-content-slices.mjs';
import {booleanChoicePresentation} from './quiz-boolean-choice.mjs';
const compact=s=>s.normalize('NFKC').replace(/\s/gu,'');
const marker=/^[ \t　]*(?:[（(][ˉ_　 \t]*[）)][ \t]*(?:[（(]([0-9０-９]{1,2})[）)]|([0-9０-９]{1,2}))|[（(]([0-9０-９]{1,2})[）)]|([0-9０-９]{1,2})[.．、]|([０-９]{1,2})(?=[^0-9０-９.．、]))/gmu;
const labelNumber=s=>{const m=s.normalize('NFKC').trim().match(/^(?:第(\d+)(?:小題|題|格|欄)|閱讀第(\d+)題|\((\d+)\)|(\d+))(?:\s*|\(選出全部正確項,未選表示不正確\))$/u);return m?Number(m[1]||m[2]||m[3]||m[4]):null;};

// Other publishers use blank-before-number / fullwidth numbers and append
// glossaries. Only a complete one-to-one source run is projected. IDs, types,
// stored answers and source content are never changed or inferred.
export function numberedReadingPresentation(q){
 if(q.type!=='fields'||q.fields.length<2||q.prompt.media?.some(m=>m.kind==='audio'))return null;
 const text=sourceStream(q.prompt);if(text===null)return null;
 if(q.prompt.layout){const anchored=new Set(q.prompt.layout.flatMap(p=>p.runs.filter(r=>r.type==='image').map(r=>r.media_index)));if(q.prompt.media?.some((_,i)=>!anchored.has(i)))return null;}
 const suffixes=q.fields.map((_,i)=>i).filter(i=>q.fields.length-i>=2&&q.fields.slice(i).every((f,j)=>labelNumber(f.label)===j+1));
 if(suffixes.length!==1)return null;const first=suffixes[0],targets=q.fields.slice(first),ns=targets.map(f=>labelNumber(f.label));
 if(targets.some(f=>!['single','set','text','math'].includes(f.input)||['single','set'].includes(f.input)&&(!Array.isArray(f.options)||f.options.length<2)))return null;
 const marks=[...text.matchAll(marker)].map(m=>({start:m.index,end:m.index+m[0].length,n:Number((m[1]||m[2]||m[3]||m[4]||m[5]).normalize('NFKC'))}));
 const runs=marks.map((_,i)=>marks.slice(i,i+ns.length)).filter(a=>a.length===ns.length&&a.every((m,i)=>m.n===i+1));
 if(runs.length!==1)return null;const selected=runs[0];
 // Extra numbered source questions cannot silently be omitted.
 if(marks.some(m=>m.start>selected.at(-1).start))return null;
 const ranges=[],questions=q.fields.map(()=>null),fields=[...q.fields],numbers=q.fields.map(()=>null),issues=[];
 for(let i=0;i<selected.length;i++){
  const m=selected[i],end=selected[i+1]?.start??text.length,raw=text.slice(m.end,end);
  const notes=i===selected.length-1?raw.search(/^\s*(?:\*[^\n]|【(?:注釋|詞彙|單字)】)/mu):-1;
  const stop=notes<0?end:m.end+notes;
  let body=sliceContent(q.prompt,m.end,stop),field=targets[i];
  const s=sourceStream(body),options=field.options||[];
  const coded=options.length>=2&&options.every(o=>!o.content.media?.length&&/^(?:[A-H]|[①②③④⑤⑥⑦⑧])$/u.test(o.content.text.trim()));
  if(coded){
   const codes=options.map(o=>o.content.text.trim()),bank=[...s.matchAll(/^[ \t　]*(?:[（(]([A-H])[）)]|([①②③④⑤⑥⑦⑧]))[ \t]*/gmu)];
   if(bank.length!==options.length||bank.some((b,j)=>(b[1]||b[2])!==codes[j]))return null;
   const converted=options.map((o,j)=>({...o,content:sliceContent(body,bank[j].index+bank[j][0].length,bank[j+1]?.index??s.length)}));
   if(converted.some(o=>!o.content.text.trim()&&!o.content.media.length))return null;
   field={...field,options:converted};body=sliceContent(body,0,bank[0].index);
  }else{
   // Source option banks may remain in legacy full-choice imports. Remove only
   // a verbatim bank, otherwise retain its complete context beside the control.
   const bank=[...s.matchAll(/^[ \t　]*(?:[（(]([A-H])[）)]|([①②③④⑤⑥⑦⑧]))[ \t]*/gmu)];
   if(bank.length&&bank.length===options.length){
    const pieces=bank.map((b,j)=>sliceContent(body,b.index+b[0].length,bank[j+1]?.index??s.length));
    const equal=pieces.every((c,j)=>compact(c.text)===compact(options[j].content.text.replace(/^[①②③④⑤⑥⑦⑧]\s*/u,''))&&JSON.stringify(c.media)===JSON.stringify(options[j].content.media||[]));
    if(equal)body=sliceContent(body,0,bank[0].index);else issues.push({field:field.id,code:'source_bank_retained'});
   }
  }
  if(options.length&&booleanChoicePresentation(field.options)){
   const s=sourceStream(body),prefix=s.match(/^\s*[（(]\s*T\s+F\s*[）)]\s*/u);if(prefix)body=omitRanges(body,[[0,prefix[0].length]]);
  }
  if(!body.text.trim()&&!body.media.length)return null;
  // Preserve styled text and inline image anchors; number is a UI label.
  questions[first+i]=body;fields[first+i]=field;numbers[first+i]=i+1;ranges.push([m.start,stop]);
 }
 let passage=compactParagraphs(omitRanges(q.prompt,ranges));
 if(passage.text.length<30&&!passage.media.length&&!q.material?.text)return null;
 return {passage,questions,fields,issues,numbered:true,numbers};
}
