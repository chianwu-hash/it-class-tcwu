import {fieldsReviewPresentation,appendFieldReviewStatus,decorateFieldReviewOption} from './quiz-fields-review.mjs';
// Presentation adapter for already revealed original-paper references. No
// question-key lookup, score calculation, ID remapping or persistence.
export function choiceReviewModel({kind,choices=[],codes=[],value,official,correct,revealed=false,selfCheck=false}){
 if(!revealed||selfCheck||!['single','code','mark','set','sequence'].includes(kind))return null;
 const options=kind==='mark'?[{id:true,text:'打勾／是'},{id:false,text:'不打勾／否'}]:kind==='set'?codes.map(id=>choices.find(c=>c.id===id)||{id,text:String(id)}):choices;
 const has=id=>options.some(o=>o.id===id),array=['set','sequence'].includes(kind);
 if(array? !Array.isArray(official)||!official.every(has):!has(official))return null;
 const input=kind==='set'?'set':kind==='sequence'?'sequence':'single',hasValue=value!==undefined;
 if(hasValue&&typeof correct!=='boolean')return null;
 const q={type:'fields',fields:[{id:'answer',input,options}]},raw=JSON.stringify({v:1,f:{answer:hasValue?value:array?[]:''}});
 const model=fieldsReviewPresentation(q,raw,{correct:correct===true,answer:{format:'fields-v1',fields:{answer:[official]}}})?.[0];if(!model)return null;
 if(!hasValue){model.state='reference';model.options=model.options.map(o=>({...o,selected:false,state:(array?official.includes(o.id):official===o.id)?'answer':'neutral',text:(array?official.includes(o.id):official===o.id)?'✓ 正確答案':''}));}
 else if(correct===false&&model.state==='correct'){model.state='reference';model.options=model.options.map(o=>({...o,state:'neutral',text:o.selected?'你的選擇':''}));}
 return {...model,choices:options,official,hasValue};
}
export function appendChoiceReview(host,model,{renderContent}={}){
 if(!model)return;host.classList.add('quiz-choice-review');appendFieldReviewStatus(host,model);
 for(const [i,o]of model.choices.entries()){
  if(model.options[i].state==='neutral')continue;
  const row=document.createElement('div');row.className='preview-option';const codeOnly=!o.content?.media?.length&&(o.content?.text||o.text||'').trim()===String(o.id);
  if(codeOnly)row.append(document.createTextNode(String(o.id)));
  else{const label=document.createElement('strong');label.textContent=typeof o.id==='boolean'?(o.id?'○　':'×　'):String(o.id)+'　';row.append(label);if(renderContent&&o.content)renderContent(row,o.content);else row.append(document.createTextNode(o.text||o.content?.text||'代號 '+o.id));}
  decorateFieldReviewOption(row,model.options[i]);host.append(row);
 }
 if(model.input==='sequence'||model.input==='set'&&!model.official.length){const p=document.createElement('p');p.className='quiz-field-review-reference';p.textContent='參考答案：'+(model.official.length?model.official.join(' → '):'這些選項都不選');host.append(p);}
}
export {decorateFieldReviewOption};
