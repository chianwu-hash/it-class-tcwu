import {choiceQuestionPresentation} from '../quiz-choice-conversion.mjs';
import {partnerImageChoicePresentation} from '../quiz-image-choices.mjs';
import {fieldsPromptPresentation} from '../quiz-fields-presentation.mjs';
// Partner responses are zero-based indices. Their order and all stored values
// remain unchanged; only rich prompt/option content is adapted.
export function partnerChoicePresentation(q){
 if(partnerImageChoicePresentation(q))return q;
 if(q.normal){const normal=choiceQuestionPresentation(q.normal),prompt=normal.type==='fields'?fieldsPromptPresentation(normal):normal.prompt;return {...q,normal,text:prompt.text,...(normal.type==='single'?{options:normal.options.map(o=>o.content.text)}:{}),rich:{...q.rich,prompt,normal,...(normal.type==='single'?{options:normal.options.map(o=>o.content)}:{})}};}
 if(q.past||!Array.isArray(q.options)||!q.options.length)return q;
 const source={id:String(q.id),type:'single',prompt:q.rich?.prompt||{text:q.text||'',media:[]},options:q.options.map((text,i)=>({id:String(i),content:q.rich?.options?.[i]||{text,media:[]}}))};
 const view=choiceQuestionPresentation(source);if(view===source)return q;
 return {...q,text:view.prompt.text,options:view.options.map(o=>o.content.text),rich:{...q.rich,prompt:view.prompt,options:view.options.map(o=>o.content)}};
}
