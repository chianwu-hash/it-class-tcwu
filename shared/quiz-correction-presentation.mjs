import {readingSignature} from './quiz-reading-signature.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';
import {sourceStream,omitRanges} from './quiz-content-slices.mjs';
import {reviewedCorrectionSources} from './quiz-correction-reviewed-sources.mjs';

export const correctionInstruction=count=>count===1?'找出句子中的錯字，在下方填入正確的字。':`找出文中的 ${count} 個錯字，依出現順序填入正確的字。`;
export const correctionLabel=(index,count)=>count===1?'正確的字':`第${index+1}個正確的字`;

// Source type, field order and teacher key were checked offline. Never infer
// a correction exercise from spelling, the stored answer or a loose keyword.
export function correctionQuestionPresentation(q,registry=reviewedCorrectionSources){
 const plans=registry[q?.id];if(q?.type!=='fields'||!plans?.some(p=>p.guard===readingSignature(q)||p.guard===presentationSignature(q)))return q;
 if(!q.fields?.length||q.fields.some(f=>f.input!=='text'))return q;
 const stream=sourceStream(q.prompt);if(stream===null)return q;
 const ranges=[];let pos=0;
 for(const line of stream.split('\n')){
  if(/^\s*改錯字(?:-短文式)?\s*$/u.test(line)||/^\s*依原題順序完成所有答案欄；同一份原題保留為一組。\s*$/u.test(line))ranges.push([pos,pos+line.length]);
  pos+=line.length+1;
 }
 const body=ranges.length?omitRanges(q.prompt,ranges):q.prompt,instruction=correctionInstruction(q.fields.length);
 // Retain the source sentence (including intended misspellings) and all media.
 const prompt={...body,text:instruction+'\n'+body.text,layout:[{type:'paragraph',runs:[{type:'text',text:instruction}]},...(body.layout||[{type:'paragraph',runs:[{type:'text',text:body.text}]}])]};
 return {...q,prompt,fields:q.fields.map((f,i)=>({...f,label:correctionLabel(i,q.fields.length)}))};
}

// Past-paper schema has an explicit group title and source instructions.
// Do not treat choice questions or ordinary passages mentioning a typo as this type.
export const isPastCorrection=g=>g?.kind==='short'&&/改錯(?:別)?字/u.test(g.title||'')&&g.fields?.length>0;
export function pastCorrectionFieldLabel(g,f,index){
 if(!isPastCorrection(g))return null;
 if(g.fields.length===1)return '正確的字';
 if(/^第\s*\d+\s*格$/u.test(f.text||''))return correctionLabel(index,g.fields.length);
 if(/正確(?:的)?字/u.test(f.text||''))return f.text;
 return `${f.text}（填入正確的字）`;
}
export function pastCorrectionPrompt(g){
 if(!isPastCorrection(g))return null;
 const source=[g.material,g.materialContent?.text,g.promptContent?.text,...g.fields.map(f=>f.text)].join('\n');
 if(/(?:填|寫)[^。\n]{0,35}(?:正確|改正)[^。\n]{0,8}字|(?:正確|改正)[^。\n]{0,8}字[^。\n]{0,12}填/u.test(source))return null;
 return {text:'找出錯字，在各欄填入改正後的字。原題有指定段落或順序時，請依原題作答。',media:[]};
}
