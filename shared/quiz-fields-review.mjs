// Compare saved values with an already revealed server reference. Never score,
// persist, infer hidden keys, or read a question's private answer property.
import {workAnswerPresentation} from './quiz-work-answer-layout.mjs';
const literalInteger=value=>{if(typeof value!=='string')return null;const text=value.trim().replace(/[０-９]/gu,c=>String(c.charCodeAt(0)-0xff10)).replace(/＋/gu,'+').replace(/[－−]/gu,'-');return /^[+-]?[0-9]{1,12}$/u.test(text)?BigInt(text):null;};
const same=(a,b,input)=>Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&(input==='set'?[...a].sort().every((v,i)=>v===[...b].sort()[i]):a.every((v,i)=>v===b[i])):a===b;
export function fieldsReviewPresentation(q,raw,review){
 if(q?.type!=='fields'||typeof review?.correct!=='boolean'||review.answer?.format!=='fields-v1'||!review.answer.fields)return null;
 let values;try{const p=JSON.parse(raw);if(p.v!==1||!p.f||Array.isArray(p.f))return null;values=p.f;}catch{return null;}
 const integerReview=workAnswerPresentation(q)?.workPosition==='before-template';
 return q.fields.map(f=>{
  const value=values[f.id],accepted=review.answer.fields[f.id];if(!Object.hasOwn(values,f.id)||!Array.isArray(accepted)||!accepted.length)return null;
  const matched=accepted.findIndex(a=>same(value,a,f.input)),choice=['single','set','sequence'].includes(f.input);
  const tuples=(review.answer.tuples||[]).filter(t=>t.fields.includes(f.id));
  const paired=tuples.some(t=>!t.accepted.some(a=>t.fields.every(id=>same(values[id],a[id],q.fields.find(f=>f.id===id)?.input))));
  let state=matched>=0?'correct':choice?'incorrect':review.correct?'correct':'reference';
  if(integerReview&&f.input==='math'&&state==='reference'){const number=literalInteger(value),references=accepted.map(literalInteger);if(number!==null&&references.every(n=>n!==null))state=references.some(n=>n===number)?'correct':'incorrect';}
  if(paired&&!review.correct)state='paired';
  const target=matched>=0?[accepted[matched]]:accepted;
  const options=(f.options||[]).map(o=>{
   const selected=f.input==='set'?Array.isArray(value)&&value.includes(o.id):value===o.id;
   if(!['single','set'].includes(f.input)||state==='paired')return {id:o.id,selected,state:'neutral',text:selected?'你的選擇':''};
   const hits=target.map(a=>Array.isArray(a)?a.includes(o.id):a===o.id),any=hits.some(Boolean),all=hits.every(Boolean);
   const status=selected?((f.input==='single'?any:all)?'correct':!any?'wrong':'selected'):(f.input==='single'?any:all)?(f.input==='set'?'missing':'answer'):'neutral';
   return {id:o.id,selected,state:status,text:status==='correct'?'✓ 你選對了':status==='wrong'?'✕ 這項選錯了':status==='missing'?'＋ 這項漏選了':status==='answer'?(accepted.length>1?'✓ 可接受的答案':'✓ 正確答案'):status==='selected'?'你的選擇；請核對可接受選法':''};
  });
  let none=null;if(f.input==='set'&&Array.isArray(value)&&accepted.every(Array.isArray)){
   const selected=value.length===0,allEmpty=target.every(a=>a.length===0),anyEmpty=target.some(a=>a.length===0);
   const status=state==='paired'?'neutral':selected?(allEmpty?'correct':!anyEmpty?'wrong':'selected'):allEmpty?'missing':'neutral';
   none={selected,state:status,text:status==='correct'?'✓ 你選對了':status==='wrong'?'✕ 這題有需要勾選的項目':status==='missing'?'＋ 正確答案是「這些選項都不選」':''};
  }
  return {id:f.id,input:f.input,state,value,accepted,options,none,tuples:tuples.filter(()=>paired)};
 });
}
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function appendFieldReviewStatus(host,feedback){
 if(!feedback)return;host.dataset.fieldReview=feedback.state;
 const p=node('p',({correct:'✓ 這小題答對了',incorrect:'✕ 這小題需要修正',reference:'請核對這一格的答案',paired:'這幾格需要一起核對'})[feedback.state]);p.className='quiz-field-review-status';host.append(p);
}
export function decorateFieldReviewOption(row,feedback){
 if(!feedback||feedback.state==='neutral')return;
 row.dataset.fieldResult=feedback.state;row.dataset.result=feedback.state==='correct'||feedback.state==='answer'?'correct':feedback.state==='wrong'?'incorrect':feedback.state;
 row.classList.add('quiz-field-review-option');
 if(feedback.text){const body=row.querySelector('.option-body,.option-content,.rv-option')||row.querySelector('input+span')||row,note=node('span',feedback.text);note.className='quiz-field-review-note';body.append(note);}
}
export function appendFieldReviewReference(host,feedback,format,formatPair){
 if(!feedback)return;
 if(['reference','paired'].includes(feedback.state)||!['single','set'].includes(feedback.input)||feedback.accepted.length>1&&feedback.state!=='correct'){
  const box=node('div');box.className='quiz-field-review-reference';
  box.append(node('p','你的答案：'+format(feedback.value)),node('p','參考答案：'+feedback.accepted.map(format).join(' 或 ')));
  if(feedback.state==='paired'){
   box.append(node('p','這些欄位的配對須同時符合，請和其他配對欄一起核對。'));
   for(const tuple of feedback.tuples.filter(t=>t.fields[0]===feedback.id)){
    box.append(node('strong','可接受的完整配對'));
    for(const accepted of tuple.accepted)box.append(node('p',tuple.fields.map(id=>formatPair(id,accepted[id])).join('；')));
   }
  }
  host.append(box);
 }
}
