import {choiceQuestionPresentation} from '../quiz-choice-conversion.mjs';
// Partner responses are zero-based indices. Their order and all stored values
// remain unchanged; only rich prompt/option content is adapted.
export function partnerChoicePresentation(q){
 if(q.past||!Array.isArray(q.options)||!q.options.length)return q;
 const source={id:String(q.id),type:'single',prompt:q.rich?.prompt||{text:q.text||'',media:[]},options:q.options.map((text,i)=>({id:String(i),content:q.rich?.options?.[i]||{text,media:[]}}))};
 const view=choiceQuestionPresentation(source);if(view===source)return q;
 return {...q,text:view.prompt.text,options:view.options.map(o=>o.content.text),rich:{...q.rich,prompt:view.prompt,options:view.options.map(o=>o.content)}};
}
