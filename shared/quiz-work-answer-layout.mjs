import {workAnswerSources,answerTemplateSources} from './quiz-answer-template-sources.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';
import {sliceContent} from './quiz-content-slices.mjs';
import {deriveAnswerTemplate} from './quiz-answer-templates.mjs';

// Reviewed response roles only. Never infer an answer, field, or work area.
export function workAnswerPresentation(q,registry=workAnswerSources){
 const p=registry[q?.id];if(!p||q.type!=='fields'||!q.fields?.length||q.fields.some(f=>f.input!=='math'))return null;
 if(![p.guard,p.partnerGuard].includes(presentationSignature(q))||q.work?.input!==p.work?.input||q.work?.label!==p.work?.label)return null;
 if(!Number.isInteger(p.initialChars)||p.initialChars<2||p.initialChars>12)return null;
 if(p.passageEnd!==undefined&&(!Number.isInteger(p.passageEnd)||p.passageEnd<=0||p.passageEnd>=q.prompt.text.length))return null;
 if(p.workPosition!==undefined){
  const template=answerTemplateSources[q.id];
  if(p.workPosition!=='before-template'||p.work.input!=='expression'||p.groups||!Number.isInteger(p.passageEnd)||!q.prompt.text.slice(p.passageEnd).startsWith(p.work.label+'：')||template?.model?.mode!=='blanks'||![template.guard,template.partnerGuard].includes(presentationSignature(q)))return null;
  const model=deriveAnswerTemplate(q);if(!model||JSON.stringify(model)!==JSON.stringify(template.model)||model.start!==p.passageEnd+p.work.label.length+2)return null;
 }
 if(p.groups&&(!Array.isArray(p.groups)||p.work.input!=='expression'||p.groups.length<2||p.groups.length>8||p.groups.some(s=>typeof s!=='string'||!s.trim()||s.length>60)||new Set(p.groups).size!==p.groups.length))return null;
 return p;
}
export function workAnswerPassage(q){
 const p=workAnswerPresentation(q);return p&&Number.isInteger(p.passageEnd)?sliceContent(q.prompt,0,p.passageEnd):null;
}
export function encodeWorkGroups(values){if(!Array.isArray(values)||values.length<2||values.length>8||values.some(s=>typeof s!=='string'))throw Error('invalid_work_groups');return JSON.stringify({v:1,parts:values});}
export function decodeWorkGroups(raw,count){
 try{const d=JSON.parse(raw);return d&&Object.keys(d).length===2&&d.v===1&&Array.isArray(d.parts)&&d.parts.length===count&&d.parts.every(s=>typeof s==='string')?d.parts:null;}catch{return null;}
}
export function mountWorkAnswerInputs(host,q){
 const p=workAnswerPresentation(q);if(!p)return false;host.classList.add('quiz-work-answer-layout');
 if(p.workPosition==='before-template'){
  const template=host.querySelector(':scope > .quiz-answer-templates');
  if(template){host.classList.add('quiz-work-before-template');for(const work of host.querySelectorAll(':scope > .quiz-work-input,:scope > .quiz-saved-work,:scope > .quiz-pending-work'))if(!(work.compareDocumentPosition(template)&4))host.insertBefore(work,template);
   const rows=answerTemplateSources[q.id].model.rows;for(const[i,row]of [...template.querySelectorAll(':scope > .quiz-answer-template-row')].entries()){const label=q.prompt.text.slice(rows[i].start,rows[i].end).match(/^([^：\n]+)：/u)?.[1];if(label)row.setAttribute('aria-label',label);}
  }
 }
 const ids=new Set(q.fields.map(f=>'field-'+q.id+'-'+f.id));
 for(const input of host.querySelectorAll('input[type=text]')){
  if(!ids.has(input.id)||input.dataset.workAnswerSized)continue;
  input.dataset.workAnswerSized='true';input.placeholder='';
  const resize=()=>{const chars=Math.min(250,Math.max(p.initialChars,Array.from(input.value).length));input.style.setProperty('--work-answer-chars',String(chars));if(p.workPosition==='before-template')input.closest('.quiz-answer-template-slot')?.style.setProperty('--answer-slot-width',`calc(${chars}em + 1em)`);};
  input.addEventListener('input',resize);input.addEventListener('compositionend',resize);resize();
 }
 return true;
}
