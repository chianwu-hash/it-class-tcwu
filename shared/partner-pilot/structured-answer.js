import {renderFieldsInputs,renderFieldsChoices,fieldsResponseError,fieldsResponseSummary,fieldsAnswerSummary} from '../quiz-fields.mjs';
import {renderOpenInputs,openReferenceSummary,openResponseError,renderOpenSavedSketches,renderOpenReferences} from '../quiz-open-response.mjs';
import {renderContent} from './past-content.js';

export function structuredResponseError(q,raw){
 if(q.type==='open')return openResponseError(q,raw);
 if(q.type==='fields')return fieldsResponseError(q,raw);
 return typeof raw==='string'&&raw.trim()&&raw.length<=2000?'':'請填寫答案，最多2000字。';
}
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
// Reuse the original field controls inside the existing partner form and dock.
export function mountStructuredAnswers(root,{question,drafts,loadAsset,onChange}){
 for(const host of root.querySelectorAll('[data-structured-answer]')){
  const q=question(Number(host.dataset.structuredAnswer)),normal=q.normal,k='answer-'+q.id,locked=host.hasAttribute('data-structured-locked');
  const raw=(locked?q.attempts.at(-1)?.value:drafts.get(k))||'';
  const hidden=node('input');hidden.type='hidden';hidden.value=raw;if(!locked)hidden.dataset.draft=k;host.append(hidden);
  const store=value=>{hidden.value=value;drafts.set(k,value);onChange(q.id);};
  const render=(box,content)=>renderContent(box,content,{mediaScope:{active:()=>host.isConnected,resolve:loadAsset}});
  if(normal.type==='fields')renderFieldsInputs(host,normal,{raw,locked,onChange:store,renderContent:render,review:locked&&q.normalReference?{answer:q.normalReference,correct:q.attempts.at(-1)?.correct}:null});
  else if(normal.type==='open'){
   const group=renderOpenInputs(host,normal,{raw,locked,onChange:store,renderContent:render});
   group.firstElementChild.textContent='請依題意寫下答案。送出後，和參考內容核對；共同回顧時可與夥伴討論。';
  }else{
   const label=node('label','我的答案'),input=node('textarea');input.rows=2;input.maxLength=2000;input.required=true;input.disabled=locked;input.value=raw;input.setAttribute('aria-label','我的答案');input.oninput=()=>store(input.value);label.append(input);host.append(label);
  }
 }
 for(const host of root.querySelectorAll('[data-structured-reference]')){
  const q=question(Number(host.dataset.structuredReference));if(!q?.normalReference)continue;
  const normal=q.normal,last=q.attempts?.at(-1);
  if(normal.type==='open'&&renderOpenReferences(host,normal,q.normalReference,{raw:last?.value||''})){
   if(last&&!root.querySelector(`[data-structured-answer="${q.id}"]`))renderOpenSavedSketches(host,normal,last.value,{renderContent:(box,content)=>renderContent(box,content,{mediaScope:{active:()=>host.isConnected,resolve:loadAsset}})});
   continue;
  }
  if(normal.type==='fields'&&root.querySelector(`[data-structured-answer="${q.id}"] .quiz-has-answer-template`))continue;
  if(normal.type==='fields'&&last&&typeof last.correct==='boolean'){
   renderFieldsChoices(host,normal,{raw:last.value,showWork:!root.querySelector(`[data-structured-answer="${q.id}"]`),review:{answer:q.normalReference,correct:last.correct},renderContent:(box,content)=>renderContent(box,content,{mediaScope:{active:()=>host.isConnected,resolve:loadAsset}})});continue;
  }
  if(normal.type==='fields'){
   renderFieldsChoices(host,normal,{referenceAnswer:q.normalReference,renderContent:(box,content)=>renderContent(box,content,{mediaScope:{active:()=>host.isConnected,resolve:loadAsset}})});continue;
  }
  if(last){host.append(node('b','我這次留下的作答'),node('p',normal.type==='short'?last.value:fieldsResponseSummary(normal,last.value)));if(normal.type==='open'&&!root.querySelector(`[data-structured-answer="${q.id}"]`))renderOpenSavedSketches(host,normal,last.value,{renderContent:(box,content)=>renderContent(box,content,{mediaScope:{active:()=>host.isConnected,resolve:loadAsset}})});}
  const answer=normal.type==='open'?openReferenceSummary(normal,q.normalReference):normal.type==='fields'?fieldsAnswerSummary(normal,q.normalReference):q.normalReference.accepted.join(' 或 ');
  host.append(node('b',normal.type==='open'?'參考例答與檢核重點':'參考答案'),node('p',answer));
 }
}
