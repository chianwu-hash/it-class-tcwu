import {revealedPastChoice} from './answer-feedback.mjs?v=20261107-answer-feedback';
import {booleanChoicePresentation} from '../quiz-boolean-choice.mjs?v=20261107-boolean-choice';
import {renderManualResponse} from './quiz-past-manual.js';
import {attachPastInputKeyboard} from './quiz-past-input.js';
import {appendSingleChoiceOptions} from '../quiz-choice.mjs';
import {choiceReviewModel,decorateFieldReviewOption} from '../quiz-review-choices.mjs';
import {appendFieldReviewStatus} from '../quiz-fields-review.mjs';
import {isPastCorrection} from '../quiz-correction-presentation.mjs';
import {partnerMatchingPresentation} from '../quiz-matching-past.mjs';
import {renderMatchingBoard} from '../quiz-matching.mjs';
import {renderContent} from './past-content.js';
export function mountPastAnswers(root,{question,drafts,loadAsset}){
 for(const host of root.querySelectorAll('[data-past-answer]')){
  if(host.dataset.pastMounted)continue;host.dataset.pastMounted='true';
  const q=question(Number(host.dataset.pastAnswer)),m=q.past,k='answer-'+q.id;let saved;
  try{saved=JSON.parse(drafts.get(k)||'null');}catch{}
  const locked=host.hasAttribute('data-past-locked'),last=q.attempts?.at(-1);if(locked)saved=last?.value;
  const hidden=document.createElement('input');hidden.type='hidden';hidden.value=saved===undefined?'':JSON.stringify(saved);if(!locked)hidden.dataset.draft=k;host.append(hidden);const store=v=>{hidden.value=JSON.stringify(v);drafts.set(k,hidden.value);};
  const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const matching=partnerMatchingPresentation(q);
  if(matching){
   renderMatchingBoard(host,matching.board,{values:{answer:saved},locked,accepted:locked&&Object.hasOwn(q,'pastReference')?{answer:[q.pastReference]}:null,onChange:next=>{store(next.answer);hidden.dispatchEvent(new Event('input',{bubbles:true}));},renderContent:(box,c)=>renderContent(box,c,{mediaScope:{active:()=>host.isConnected,resolve:loadAsset}})});
  }else if(m.kind==='manual'){
   const value=saved&&typeof saved==='object'?saved:{text:'',strokes:[],confirmed:false};store(value);
   renderManualResponse({host,value,locked:false,asset:q.rich.material.media?.find(a=>a.kind==='image'),resolveAsset:loadAsset});
   host.querySelector('textarea').id='manual-'+q.id;host.querySelector('label').htmlFor='manual-'+q.id;
   for(const ev of ['input','change','pointermove','pointerup','click'])host.addEventListener(ev,()=>store(value));
  }else if(m.kind==='short'){
   const math=m.answerFormat==='math-v1',input=node('input');input.type='text';input.maxLength=math?250:2000;input.required=true;input.id='past-'+q.id;input.value=math?saved?.answer||'':typeof saved==='string'?saved:'';const correction=isPastCorrection({kind:m.kind,title:q.title,fields:[{}]});const label=node('label',correction?'正確的字':'我的答案');label.htmlFor=input.id;if(correction)host.append(node('p','找出這個作答位置的錯字，填入改正後的字。'));host.append(label,input);
   let work;if(math){const wl=node('label','計算或推想過程（可略過）');work=node('textarea');work.maxLength=5000;work.value=saved?.working||'';wl.append(work);host.append(wl);}
   const update=()=>store(math?{answer:input.value,working:work.value}:input.value);input.oninput=update;if(work)work.oninput=update;update();attachPastInputKeyboard(host,input,{bopomofo:true,punctuation:true});
  }else if(m.kind==='sequence'){
   host.append(node('p','依序輸入代號，以逗號分隔；順序會影響答案。'));const input=node('input');input.required=true;input.value=Array.isArray(saved)?saved.join(','):'';host.append(input,node('p',m.choices.map(c=>c.id+'：'+c.text).join('　')));input.oninput=()=>store(input.value.split(/[,，\s]+/).filter(Boolean));input.oninput();
  }else if(m.kind==='single'){
   const display=booleanChoicePresentation(m.choices,q.rich?.options);const fieldset=node('fieldset');fieldset.className='quiz-choices';fieldset.append(node('legend','選擇一個答案'));
   appendSingleChoiceOptions(fieldset,{name:'past-choice-'+q.id,options:m.choices.map(o=>({...o,value:JSON.stringify(o.id)})),selected:JSON.stringify(saved),locked,result:locked&&last&&typeof last.correct==='boolean'?{chosen:JSON.stringify(last.value),...(revealedPastChoice(q)?{correct:JSON.stringify(q.pastReference)}:{}),chosenCorrect:last.correct}:null,
    onSelect:v=>store(JSON.parse(v)),decorateInput:input=>{input.required=true;},badgeForOption:(o,i)=>display?.[i].badge??o.id,
    renderBody:(body,o,i)=>{if(display){body.textContent=display[i].text;return;}const span=node('span');span.dataset.richQ=q.id;span.dataset.richPart='option';span.dataset.richIndex=i;body.append(span);}});
   host.append(fieldset);if(!locked)store(saved??null);
  }else{
   const options=m.kind==='mark'?[{id:true,text:'打勾／是'},{id:false,text:'不打勾／否'}]:m.kind==='set'?m.codes.map(id=>({id,text:id})):m.choices;
   for(const [i,o]of options.entries()){
    const label=node('label');label.className='option';const input=node('input');input.type=m.kind==='set'?'checkbox':'radio';input.name='past-choice-'+q.id;input.value=JSON.stringify(o.id);if(input.type==='radio')input.required=true;input.checked=m.kind==='set'?Array.isArray(saved)&&saved.includes(o.id):saved===o.id;
    input.onchange=()=>store(m.kind==='set'?[...host.querySelectorAll('input[type=checkbox]:checked')].map(e=>JSON.parse(e.value)):o.id);
    label.append(input);const content=node('span');content.className='option-content';if(m.kind!=='mark'&&m.kind!=='set'){content.dataset.richQ=q.id;content.dataset.richPart='option';content.dataset.richIndex=i;}else content.textContent=o.text;label.append(content);host.append(label);
   }
   store(saved??(m.kind==='set'?[]:null));
  }
  [...host.querySelectorAll('input:not([type=hidden]),textarea')].forEach((e,i)=>{e.dataset.pastFocus=q.id+'-'+i;if(m.kind!=='manual')e.disabled=locked;});
  const model=choiceReviewModel({kind:m.kind,choices:m.choices,codes:m.codes,value:locked?last?.value:undefined,official:q.pastReference,correct:last?.correct,revealed:locked&&Object.hasOwn(q,'pastReference'),selfCheck:m.selfCheck});
  if(model&&!matching){host.classList.add('quiz-choice-review');appendFieldReviewStatus(host,model);host.querySelectorAll(':scope>label.option').forEach((row,i)=>decorateFieldReviewOption(row,model.options[i]));if(m.kind==='sequence'){const p=node('p','參考順序：'+q.pastReference.map(id=>m.choices.find(c=>c.id===id)?.text||id).join(' → '));p.className='quiz-field-review-reference';host.append(p);}}
 }
}
