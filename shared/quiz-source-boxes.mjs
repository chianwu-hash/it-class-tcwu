import {sourceStream} from './quiz-content-slices.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';
import {numberedReadingPresentation} from './quiz-reading-numbered.mjs';
import {reviewedSourceBoxes} from './quiz-source-boxes-sources.mjs';
const context=Symbol('source-boxes');
// Ranges come from the original DOCX run borders, never from an answer key.
export function boxedContent(content,ranges){
 const text=sourceStream(content);if(text===null)return null;
 if(!ranges.length||ranges.some(([a,b],i)=>!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<=a||b>text.length||i&&a<ranges[i-1][1]))return null;
 let at=0;const layout=(content.layout||[{type:'paragraph',runs:[{type:'text',text}]}]).map(p=>{
  const runs=p.runs.flatMap(r=>{
   const start=at,end=at+(r.type==='text'?r.text.length:1);at=end;
   if(r.type!=='text')return [r];const cuts=[start,...ranges.flat().filter(n=>n>start&&n<end),end];
   return cuts.slice(0,-1).map((a,i)=>({...r,text:r.text.slice(a-start,cuts[i+1]-start),...(ranges.some(([x,y])=>a>=x&&cuts[i+1]<=y)?{boxed:true}:{})}));
  });at++;return {...p,runs};
 });
 return {...content,layout};
}
export function sourceBoxQuestion(q,registry=reviewedSourceBoxes){
 if(q?.[context])return q;const p=registry[q?.id]?.find(p=>p.guard===presentationSignature(q));if(!p)return q;
 const prompt=boxedContent(q.prompt,p.ranges);return prompt?{...q,prompt,[context]:p}:q;
}
export function sourceBoxReading(q){
 const view=sourceBoxQuestion(q),plan=view?.[context];if(!plan?.paired)return null;
 const result=numberedReadingPresentation(view,{minimumPassage:0});
 if(!result||result.questions.length!==plan.ranges.length||result.questions.some(c=>c.layout?.flatMap(p=>p.runs).filter(r=>r.boxed).length!==1))return null;
 return {...result,passage:{text:'選出各句框內詞語的意思。',media:[]},standalone:true,reviewed:true,reviewKind:'source-boxed-meaning'};
}
