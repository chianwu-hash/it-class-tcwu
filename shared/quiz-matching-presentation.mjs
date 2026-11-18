import {matchingSources,matchingVariants} from './quiz-matching-sources.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';
import {sliceContent,omitRanges,compactParagraphs} from './quiz-content-slices.mjs';
const plain=text=>({text,media:[]});
const imageContent=(q,crop,label)=>({text:label||'',media:[{...q.prompt.media[crop.index],viewBox:crop.viewBox}],layout:[...(label?[{type:'paragraph',runs:[{type:'text',text:label}]}]:[]),{type:'paragraph',runs:[{type:'image',media_index:0,width:crop.viewBox.width}]}]});
// Explicit source plans and full prompt/field fingerprints. A title containing
// "Match" alone never turns cloze, geometry or a mixed section into matching.
export function matchingPresentation(q,shown=q.fields){
 const plan=matchingSources[q?.id];if(!plan)return null;
 const signature=presentationSignature(q);if(signature!==plan.signature&&!matchingVariants[q.id]?.includes(signature))return null;
 const covered=new Set(),boards=[];
 for(const spec of plan.boards){
  const fields=spec.indices.map(i=>shown[i]);if(fields.some(f=>!f))return null;
  const first=fields[0],options=first.options??(spec.rightRanges?spec.rightRanges.map((r,i)=>{const c=sliceContent(q.prompt,...r);return{id:'source-'+i,content:c,value:c.text};}):spec.textValues?.map(value=>({id:value,value,content:plain(value)})));
  if(!options?.length)return null;
  const right=options.map((o,i)=>({id:o.id,content:spec.rightCrops?.[i]?imageContent(q,spec.rightCrops[i],o.content.text):o.content}));
  const left=fields.map((f,i)=>{
   const sourceOptions=f.options??options,label=spec.leftRanges?sliceContent(q.prompt,...spec.leftRanges[i]):plain(f.label),crop=spec.leftCrops?.[i];
   return {id:f.id,content:crop?imageContent(q,crop,label.text):label,multiple:f.input==='set',trimSpaces:f.input==='text',caseInsensitive:spec.caseInsensitive===true,options:sourceOptions.map((o,j)=>({id:right[j].id,value:o.value??o.id,content:right[j].content}))};
  });
  spec.indices.forEach(i=>covered.add(i));boards.push({indices:spec.indices,left,right,unique:spec.unique===true,equalScale:spec.equalScale===true,...(Number.isInteger(spec.materialIndex)?{material:{text:'',media:[q.prompt.media[spec.materialIndex]]}}:{})});
 }
 return {boards,covered,passage:compactParagraphs(omitRanges(q.prompt,plan.omit)),original:q.prompt.media?.length?{...q.prompt,text:'',layout:q.prompt.layout?.map(p=>({...p,runs:p.runs.filter(r=>r.type==='image')})).filter(p=>p.runs.length)}:null};
}
