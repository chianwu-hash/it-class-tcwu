import {fieldsValues,fieldsResponseError,validateFieldsQuestion} from './quiz-fields.mjs';
import {attachPastInputKeyboard} from './quiz-past-input.mjs';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const only=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k));
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export const openResponseError=fieldsResponseError;
export const openReferenceSummary=(q,answer=q.answer)=>q.fields.map(f=>{
 const ref=answer.fields[f.id];return `${f.label}：參考例答 ${ref.examples.join('／')}；檢核 ${ref.criteria.join('、')}`;
}).join('；');

// Examples are review material, never an accepted-answer list for grading.
export function validateOpenQuestion(q,checkContent){
 const fail=()=>{throw Error('題庫格式錯誤：開放作答的欄位、參考例答或檢核重點不完整。');};
 if(!Array.isArray(q.fields)||q.fields.some(f=>f.input!=='text')||!only(q.answer,['format','fields'])||q.answer.format!=='self-review-v1'||!object(q.answer.fields))fail();
 const placeholders=Object.fromEntries(q.fields.map(f=>[f.id,['validation-only']]));
 validateFieldsQuestion({...q,type:'fields',answer:{format:'fields-v1',fields:placeholders}},checkContent);
 if(Object.keys(q.answer.fields).length!==q.fields.length||Object.keys(q.answer.fields).some(id=>!q.fields.some(f=>f.id===id)))fail();
 for(const field of q.fields){
  const ref=q.answer.fields[field.id];if(!only(ref,['examples','criteria']))fail();
  for(const [key,maxCount,maxLength]of[['examples',3,500],['criteria',4,150]]){
   const values=ref[key];if(!Array.isArray(values)||values.length<1||values.length>maxCount||values.some(v=>typeof v!=='string'||!v.trim()||v.length>maxLength))fail();
  }
 }
 return q;
}

export function renderOpenInputs(host,q,{raw='',locked=false,onChange}){
 const values=fieldsValues(q,raw),group=make('div',undefined,'quiz-fields quiz-open-inputs');
 group.append(make('p','請依原題寫下自己的答案。儲存後可以查看參考例答與檢核重點，再完成自評。'));
 for(const field of q.fields){
  const slot=make('fieldset',undefined,'quiz-field'),legend=make('legend',field.label),input=make('textarea');
  input.id='open-'+q.id+'-'+field.id;input.maxLength=250;input.rows=3;input.disabled=locked;input.autocomplete='off';input.setAttribute('aria-label',field.label);input.value=typeof values[field.id]==='string'?values[field.id]:'';
  input.addEventListener('input',()=>{values[field.id]=input.value;onChange(JSON.stringify({v:1,f:values}));});slot.append(legend,input);
  if(field.label.includes('注音'))attachPastInputKeyboard(slot,input,{bopomofo:true});
  group.append(slot);
 }
 host.append(group);return group;
}

export function renderOpenReview(host,q,review,{busy=false,pending=false,draftNote='',onNoteChange=()=>{},onSelfCheck}){
 const box=make('section',undefined,'answer-preview quiz-open-review');box.tabIndex=-1;
 box.append(make('h4','開放作答・核對自己的想法'));
 box.append(make('p','這題不以單一例答判對錯。請對照原題要求與下方重點，確認自己的答案。'));
 for(const field of q.fields){
  const ref=review.answer.fields[field.id],section=make('section',undefined,'quiz-open-reference');section.append(make('h5',field.label),make('p','參考例答（其他合理答案也可以）：'));
  const examples=make('ul');for(const text of ref.examples)examples.append(make('li',text));section.append(examples,make('p','檢核重點：'));const criteria=make('ul');for(const text of ref.criteria)criteria.append(make('li',text));section.append(criteria);box.append(section);
 }
 if(review.assessment?.status==='self_checked'){
  box.append(make('p',review.assessment.rating==='understood'?'已完成自評：我的答案符合檢核重點。':'已完成自評：我還想再練習或修改。','notice'));
  if(review.assessment.note)box.append(make('p','我的想法：'+review.assessment.note));
 }else{
  const label=make('label','想修改或再練習的地方（選填）'),note=make('textarea');note.maxLength=250;note.rows=2;note.value=draftNote;note.disabled=busy||pending;note.setAttribute('aria-label','自評想法（選填）');label.append(note);box.append(label);
  note.addEventListener('input',()=>onNoteChange(note.value));
  const actions=make('div',undefined,'toolbar quiz-open-self-check');
  for(const [rating,text]of[['understood','我的答案符合重點'],['practice','我還想再練習']]){
   const button=make('button',text,rating==='understood'?'quiz-primary':'secondary');button.type='button';button.disabled=busy||pending;button.addEventListener('click',()=>onSelfCheck(rating,note.value));actions.append(button);
  }
  box.append(actions);
 }
 host.append(box);return box;
}
