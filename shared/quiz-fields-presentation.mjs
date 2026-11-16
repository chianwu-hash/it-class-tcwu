import {choiceQuestionPresentation} from './quiz-choice-conversion.mjs';
// Compatibility for the reviewed Chinese import's circled-code choice fields.
// Only the view changes: the original field ID, circled values and fields-v1
// response envelope remain exactly as stored. Never read or infer an answer.
export function fieldPresentation(q,field){
 const converted=choiceQuestionPresentation(q),presented=converted.fields?.find(f=>f.id===field.id)??field;if(presented!==field)return presented;
 if(q.type!=='fields'||!q.id?.startsWith('kg6ch_')||q.fields?.length!==1||field.input!=='text'||
  !/^選擇題(?:[\s\-－—:：]|$)/u.test(q.prompt?.text||'')||q.prompt?.media?.length||
  q.prompt?.layout?.some(p=>p.type!=='paragraph'||p.runs.some(r=>r.type!=='text')))return field;
 const source=field.label.trim(),marks=[...source.matchAll(/[①②③④⑤⑥⑦⑧]/gu)];
 if(marks.length<2||marks.length>8||marks[0].index!==0||marks.some((m,i)=>m[0]!==String.fromCodePoint(0x2460+i)))return field;
 const compact=s=>s.replace(/\s/gu,'');
 if(!compact(q.prompt.text).endsWith(compact(source)))return field;
 const options=marks.map((m,i)=>({id:m[0],content:{text:source.slice(m.index+1,marks[i+1]?.index??source.length).trim(),media:[]}}));
 if(options.some(o=>!o.content.text))return field;
 return {...field,input:'single',label:'答案',options};
}

export const fieldsAreSingleChoice=q=>q.type==='fields'&&q.fields?.length===1&&fieldPresentation(q,q.fields[0]).input==='single';

export function fieldsPromptPresentation(q){
 const converted=choiceQuestionPresentation(q);q=converted;
 if(q.fields?.length!==1||fieldPresentation(q,q.fields[0])===q.fields[0])return q.prompt;
 const label=q.fields[0].label.trim(),text=q.prompt.text.trimEnd();
 // Retain the complete original prompt in storage and full-paper review. Only
 // remove duplicated options/importer instructions beside the actual controls.
 if(!text.endsWith(label))return q.prompt;
 return {text:text.slice(0,-label.length).replace('依原題順序完成所有答案欄；同一份原題保留為一組。','').replace(/\n{3,}/gu,'\n\n').trim(),media:[]};
}
