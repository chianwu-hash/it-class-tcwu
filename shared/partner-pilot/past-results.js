import {booleanChoicePresentation} from '../quiz-boolean-choice.mjs?v=20261107-boolean-choice';
import {choiceReviewModel,appendChoiceReview,decorateFieldReviewOption} from '../quiz-review-choices.mjs';
import {revealedPastChoice} from './answer-feedback.mjs';
import {renderContent} from './past-content.js';
import {partnerMatchingPresentation} from '../quiz-matching-past.mjs';
import {renderMatchingBoard} from '../quiz-matching.mjs';
import {partnerWritingGuide} from '../quiz-writing-past.mjs';
import {renderWritingSupplement} from '../quiz-open-response.mjs';
export function mountPastResults(root,{question,loadAsset}){
 for(const host of root.querySelectorAll('[data-past-result]')){
  const q=question(Number(host.dataset.pastResult)),value=q.attempts.at(-1)?.value;if(value===undefined&&(!Object.hasOwn(q,'pastReference')||q.past.selfCheck||['manual','annotation','short'].includes(q.past.kind)))continue;
  const matching=partnerMatchingPresentation(q);if(matching){if(!root.querySelector(`[data-past-answer="${q.id}"][data-past-locked]`))renderMatchingBoard(host,matching.board,{values:{answer:value},locked:true,referenceOnly:value===undefined,accepted:Object.hasOwn(q,'pastReference')?{answer:[q.pastReference]}:null,renderContent:(box,c)=>renderContent(box,c,{mediaScope:{active:()=>host.isConnected,resolve:loadAsset}})});continue;}
  const title=document.createElement('b');title.textContent=value===undefined?'本小題參考答案':'我這次留下的作答';host.append(title);const text=document.createElement('p');text.className='reply';
  const display=q.past.kind==='single'?booleanChoicePresentation(q.past.choices,q.rich?.options):null;
  const label=v=>{const i=q.past.choices.findIndex(c=>c.id===v),c=q.past.choices[i];return display&&i>=0?display[i].badge+' '+display[i].text:typeof v==='boolean'?(v?'打勾／是':'不打勾／否'):c&&c.text&&c.text!==v?v+'・'+c.text:String(v);};
  if(value!==undefined){text.textContent=q.past.kind==='manual'?value.text:typeof value==='object'&&!Array.isArray(value)?value.answer+(value.working?'\n過程：'+value.working:''):Array.isArray(value)?value.map(label).join(q.past.kind==='sequence'?' → ':'、'):label(value);host.append(text);}
  if(q.past.kind==='manual'&&value!==undefined)renderWritingSupplement(host,partnerWritingGuide(q),{family:/短語/u.test(q.title)?'phrase':'sentence',explain:true});
  const model=choiceReviewModel({kind:q.past.kind,choices:q.past.choices,codes:q.past.codes,value,official:q.pastReference,correct:q.attempts.at(-1)?.correct,revealed:Object.hasOwn(q,'pastReference'),selfCheck:q.past.selfCheck});
  if(model&&!root.querySelector(`[data-past-answer="${q.id}"][data-past-locked]`))appendChoiceReview(host,model,{renderContent:(box,c)=>renderContent(box,c,{mediaScope:{active:()=>host.isConnected,resolve:loadAsset}})});
  if(q.past.kind==='manual'&&value?.strokes?.length){
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1 1');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','drawing-board');svg.setAttribute('role','img');svg.setAttribute('aria-label','我留下的畫圖作答（唯讀）');const asset=q.rich.material.media?.find(m=>m.kind==='image'),ratio=asset?.renderWidth/asset?.renderHeight;
   svg.style.aspectRatio=String(Number.isFinite(ratio)?Math.min(ratio,1.5):1.4);
   if(asset){const image=document.createElementNS(ns,'image');image.setAttribute('width','1');image.setAttribute('height',String(ratio>1.5?1.5/ratio:1));image.setAttribute('preserveAspectRatio','none');svg.append(image);loadAsset(asset.url).then(src=>{if(svg.isConnected)image.setAttribute('href',src);}).catch(()=>{if(svg.isConnected){const note=document.createElement('p');note.textContent='底圖暫時無法讀取，筆跡與作答仍已保留。';host.append(note);}});}
   for(const stroke of value.strokes){const line=document.createElementNS(ns,'polyline');line.setAttribute('points',stroke.map(point=>point.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#155e75');line.setAttribute('stroke-width','.006');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');svg.append(line);}host.append(svg);
  }
 }
 for(const host of root.querySelectorAll('[data-review-choice]')){
  // Ordinary single choices are decorated by review-layout, including its
  // reveal gate and backend/reference consistency check. Do not decorate twice.
  const q=question(Number(host.dataset.reviewChoice));if(!q?.past)continue;const last=q.attempts?.at(-1),past=q.past,choices=past.choices,official=revealedPastChoice(q)?.id;
  const model=choiceReviewModel({kind:'single',choices,value:past?last?.value:last?.choice,official,correct:last?.correct,revealed:past?Boolean(revealedPastChoice(q)):Number.isInteger(q.correct),selfCheck:past?.selfCheck});if(!model)continue;host.classList.add('quiz-choice-review');host.querySelectorAll('[data-review-option-index]').forEach(row=>decorateFieldReviewOption(row,model.options[Number(row.dataset.reviewOptionIndex)]));
 }
}
