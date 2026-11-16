// Source conversion only. Fixed documents and saved responses are never rewritten.
import {convertChoiceQuestion} from './quiz-choice-conversion.mjs';
import {fieldPresentation,fieldsPromptPresentation} from './quiz-fields-presentation.mjs';
import {explanationReferenceContent,referenceChoiceGroups} from './quiz-explanation-references.mjs';

export function canonicalizeQuestion(source){
 const converted=convertChoiceQuestion(source);
 if(converted.issues.length)return {...converted,mapping:null};
 const orders=Object.fromEntries(referenceChoiceGroups(source).map(g=>[g.id,g.options.map(o=>o.id)]));
 const explanation=explanationReferenceContent(converted.question,converted.question.explanation,{orders});
 if(explanation!==converted.question.explanation){converted.question={...converted.question,explanation};converted.changes.push({kind:'stable_explanation_option_content'});}
 const q=converted.question;
 if(q.type!=='fields'||q.fields?.length!==1||q.answer?.tuples?.length)return {...converted,mapping:null};
 const original=q.fields[0],field=fieldPresentation(q,original),accepted=q.answer?.fields?.[field.id];
 if(field.input!=='single')return {...converted,mapping:null};
 if(Array.isArray(accepted)&&accepted.length>1&&accepted.every(v=>field.options?.some(o=>o.id===v)))return {...converted,mapping:null,retained_reason:'multiple_accepted_choices'};
 if(!Array.isArray(accepted)||accepted.length!==1||typeof accepted[0]!=='string'||!field.options?.some(o=>o.id===accepted[0]))return {question:source,changes:[],issues:[{code:'single_choice_answer_mapping_required'}],mapping:null};
 let prompt=fieldsPromptPresentation(q);
 const label=field.label?.trim()||'',compact=s=>s.replace(/\s/gu,'');
 // A meaningful field instruction can carry the actual question. Preserve it.
 if(label&&!/^(?:答案|第\s*1\s*(?:格|欄|題)(?:答案)?|依原題(?:判斷|選出答案))$/u.test(label)&&!compact(prompt.text).includes(compact(label))){
  prompt={...prompt,text:prompt.text+'\n'+label,layout:[...(prompt.layout||[{type:'paragraph',runs:[{type:'text',text:prompt.text}]}]),{type:'paragraph',runs:[{type:'text',text:label}]}]};
 }
 const {fields,answer,type,...rest}=q;
 const remap=field.options.some(o=>!/^[A-Za-z0-9_-]{1,80}$/.test(o.id));
 const option_map=Object.fromEntries(field.options.map((o,i)=>[o.id,remap?'c'+(i+1):o.id]));
 const options=field.options.map(o=>({...o,id:option_map[o.id]}));
 return {question:{...rest,type:'single',prompt,options,answer:{option_id:option_map[accepted[0]]}},changes:[...converted.changes,{kind:'single_field_to_single',field:field.id}],issues:[],mapping:{field_id:original.id,option_ids:field.options.map(o=>o.id),option_map}};
}

export function canonicalSingleResponse(raw,mapping){
 if(!mapping)return raw;
 let parsed;try{parsed=JSON.parse(raw);}catch{throw Error('invalid_response');}
 if(parsed?.v!==1||!parsed.f||Object.keys(parsed.f).length!==1||!mapping.option_ids.includes(parsed.f[mapping.field_id]))throw Error('invalid_response');
 return mapping.option_map[parsed.f[mapping.field_id]];
}
export function originalSingleResponse(value,mapping){
 const original=Object.keys(mapping.option_map).find(k=>mapping.option_map[k]===value);
 if(original===undefined)throw Error('invalid_response');
 return JSON.stringify({v:1,f:{[mapping.field_id]:original}});
}
