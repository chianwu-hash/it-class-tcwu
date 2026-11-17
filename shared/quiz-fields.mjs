import {appendSingleChoiceOptions} from './quiz-choice.mjs';
import {attachPastInputKeyboard} from './quiz-past-input.mjs';
import {fieldPresentation,fieldsAreSingleChoice} from './quiz-fields-presentation.mjs';
import {booleanChoicePresentation} from './quiz-boolean-choice.mjs';
import {choiceQuestionPresentation} from './quiz-choice-conversion.mjs';
import {readingPresentation} from './quiz-reading-presentation.mjs';
import {fieldsReviewPresentation,appendFieldReviewStatus,decorateFieldReviewOption,appendFieldReviewReference} from './quiz-fields-review.mjs';
export {fieldsAreSingleChoice,fieldsPromptPresentation} from './quiz-fields-presentation.mjs';

const own=(o,k)=>o&&Object.hasOwn(o,k);
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function fieldsValues(q,raw){
 try{const d=JSON.parse(raw);if(d.v===1&&object(d.f))return d.f;}catch{}
 return Object.fromEntries(q.fields.map(f=>[f.id,['set','sequence'].includes(f.input)?null:'']));
}
export function fieldsResponseError(q,raw){
 if(typeof raw!=='string'||!raw||raw.length>2000)return '請完成每個答案欄；整組答案請保持在2000字以內。';
 let d;try{d=JSON.parse(raw)}catch{return '答案格式不完整，請更新儲存狀態後再試。'}
 if(!object(d)||d.v!==1||!object(d.f)||Object.keys(d).some(k=>!['v','f'].includes(k))||Object.keys(d.f).length!==q.fields.length)return '請完成每個答案欄。';
 const reading=readingPresentation(choiceQuestionPresentation(q));
 for(const [i,storedField] of q.fields.entries()){
  const f=reading?.fields?.[i]??fieldPresentation(q,storedField);
  const v=d.f[f.id];if(!own(d.f,f.id))return '請完成每個答案欄。';
  if(['math','text','single'].includes(f.input)){
   if(typeof v!=='string'||!v.trim()||v.length>250)return `請完成「${f.label}」，每格最多250字。`;
   if(f.input==='single'&&!f.options.some(o=>o.id===v))return `請選擇「${f.label}」的答案。`;
  }else if(!Array.isArray(v)||v.some(x=>typeof x!=='string'||!f.options.some(o=>o.id===x))||new Set(v).size!==v.length||f.input==='sequence'&&v.length!==f.options.length)return `請完成「${f.label}」的${f.input==='sequence'?'排列':'選擇'}。`;
 }
 return '';
}

export function renderFieldsInputs(host,q,{raw='',locked=false,onChange,renderContent,textInputAids={},review=null}){
 const values=fieldsValues(q,raw),group=make('div');group.className='quiz-fields';group.classList.toggle('quiz-fields-single',q.fields.length===1);
 const reading=readingPresentation(choiceQuestionPresentation(q));group.classList.toggle('quiz-reading-fields',Boolean(reading));
 const shown=q.fields.map((f,i)=>reading?.fields?.[i]??fieldPresentation(q,f)),feedback=locked?fieldsReviewPresentation({...q,fields:shown},raw,review):null;
 const formatPair=(id,value)=>{const f=shown.find(f=>f.id===id);return f.label+'：'+formatted(f,value)};
 const changed=()=>onChange(JSON.stringify({v:1,f:values}));
 if(!fieldsAreSingleChoice(q))group.append(make('p',feedback?'你原本的作答已保留；請看各小題旁的核對結果。':q.fields.length===1?'填好答案後送出。':'依照題目順序填好每格，再一起送出。'));
 for(const [fieldIndex,storedField] of q.fields.entries()){
  const f=reading?.fields?.[fieldIndex]??fieldPresentation(q,storedField);
  const slot=make('fieldset'),legend=make('legend',f.label),id='field-'+q.id+'-'+f.id;slot.className='quiz-field';slot.append(legend);
  if(reading?.questions[fieldIndex]){const question=reading.questions[fieldIndex];
   if(question.media.length){legend.textContent=reading.numbered?`第${reading.numbers[fieldIndex]}小題`:f.label;const material=make('div');material.className='quiz-field-material';renderContent(material,reading.reviewKind==='picture-bank'?{...question,text:'',layout:question.layout.slice(1)}:question);slot.append(material);}
   else{legend.textContent=reading.numbered?`(${reading.numbers[fieldIndex]}) `:'';renderContent(legend,question);}
   slot.append(make('p',feedback?.[fieldIndex]?(f.input==='set'?'核對你的勾選結果。':f.input==='single'?'核對你的選擇。':'核對這一格的答案。'):f.input==='set'?'勾選所有正確選項。':f.input==='single'?'選擇一個答案。':'請填寫答案。'));
  }
  appendFieldReviewStatus(slot,feedback?.[fieldIndex]);
  if(['math','text'].includes(f.input)){
   const input=make('input');input.id=id;input.type='text';input.maxLength=250;input.value=typeof values[f.id]==='string'?values[f.id]:'';input.disabled=locked;input.autocomplete='off';input.setAttribute('aria-label',f.label);
   if(f.input==='math')input.placeholder='分數可以用 / 表示';
   input.addEventListener('input',()=>{values[f.id]=input.value;changed()});slot.append(input);
   if(f.input==='math')attachPastInputKeyboard(slot,input,{math:true});
   if(f.input==='text')attachPastInputKeyboard(slot,input,{bopomofo:textInputAids.bopomofo===true,punctuation:textInputAids.punctuation===true});
  }else if(f.input==='single'){
   appendSingleChoiceOptions(slot,{name:id,options:f.options.map(o=>({...o,value:o.id})),selected:values[f.id],locked,badgeForOption:storedField.input==='text'&&f!==storedField?o=>o.id:undefined,onSelect:v=>{values[f.id]=v;changed()},renderBody:(box,o)=>renderContent(box,o.content)});
   if(feedback?.[fieldIndex])slot.querySelectorAll(':scope > .student-option').forEach((row,i)=>decorateFieldReviewOption(row,feedback[fieldIndex].options[i]));
  }else if(f.input==='set'){
   const checks=[];const update=()=>{values[f.id]=checks.filter(x=>x.input.checked).map(x=>x.id);none.checked=values[f.id].length===0;changed()};
   for(const [i,o]of f.options.entries()){const label=make('label'),input=make('input');input.type='checkbox';input.disabled=locked;input.checked=Array.isArray(values[f.id])&&values[f.id].includes(o.id);const body=make('span');renderContent(body,o.content);label.append(input,body);slot.append(label);decorateFieldReviewOption(label,feedback?.[fieldIndex]?.options[i]);checks.push({id:o.id,input});input.addEventListener('change',update)}
   const label=make('label'),none=make('input');none.type='checkbox';none.disabled=locked;none.checked=Array.isArray(values[f.id])&&values[f.id].length===0;none.addEventListener('change',()=>{if(none.checked)checks.forEach(x=>x.input.checked=false);values[f.id]=none.checked?[]:null;changed()});label.append(none,make('span','這些選項都不選'));slot.append(label);decorateFieldReviewOption(label,feedback?.[fieldIndex]?.none);
  }else if(f.input==='sequence'){
   f.options.forEach((_,i)=>{const label=make('label',`第${i+1}個：`),select=make('select');select.disabled=locked;select.id=id+'-'+i;const empty=make('option','請選擇');empty.value='';select.append(empty);f.options.forEach((o,n)=>{const option=make('option',o.content.text||`選項${n+1}`);option.value=o.id;select.append(option)});select.value=values[f.id]?.[i]||'';select.addEventListener('change',()=>{const next=Array.isArray(values[f.id])?[...values[f.id]]:Array(f.options.length).fill('');next[i]=select.value;values[f.id]=next;changed()});label.append(select);slot.append(label)});
   // Keep the complete original option content, including diagrams, beside the ordering controls.
   f.options.forEach((o,i)=>{const row=make('div');row.append(make('strong',`選項${i+1}　`));renderContent(row,o.content);slot.append(row)});
  }
  appendFieldReviewReference(slot,feedback?.[fieldIndex],v=>formatted(f,v),formatPair);group.append(slot);
 }
 host.append(group);return group;
}
export function renderFieldsChoices(host,q,{renderContent,raw='',review=null,referenceAnswer=null}){
 const reading=readingPresentation(choiceQuestionPresentation(q));
 const shown=(q.fields||[]).map((f,i)=>reading?.fields?.[i]??fieldPresentation(q,f)),feedback=fieldsReviewPresentation({...q,fields:shown},raw,review),formatPair=(id,v)=>{const f=shown.find(f=>f.id===id);return f.label+'：'+formatted(f,v)};
 for(const [index,stored] of (q.fields||[]).entries()){const f=shown[index],reference=referenceAnswer?.format==='fields-v1'?referenceAnswer.fields?.[f.id]:null;if(!f.options&&!reading?.questions[index]&&!feedback?.[index]&&!reference)continue;
  const section=make('section');section.className='quiz-field-preview';const question=reading?.questions[index],hasMedia=question?.media.length;const title=make('h5',question&&!hasMedia?(reading.numbered?`(${reading.numbers[index]}) `:''):f.label);if(question&&!hasMedia)renderContent(title,question);section.append(title);if(hasMedia)renderContent(section,reading.reviewKind==='picture-bank'?{...question,text:'',layout:question.layout.slice(1)}:question);const display=f.input==='single'?booleanChoicePresentation(f.options):null;
  appendFieldReviewStatus(section,feedback?.[index]);
  if(f.options)f.options.forEach((o,i)=>{const row=make('div');row.className='preview-option';row.append(make('strong',(display?.[i].badge??String.fromCharCode(65+i))+' '));if(display)row.append(make('span',display[i].text));else renderContent(row,o.content);decorateFieldReviewOption(row,feedback?.[index]?.options[i]);section.append(row);});
  if(feedback?.[index]?.none&&feedback[index].none.state!=='neutral'){const row=make('div','這些選項都不選');row.className='preview-option';decorateFieldReviewOption(row,feedback[index].none);section.append(row);}
  appendFieldReviewReference(section,feedback?.[index],v=>formatted(f,v),formatPair);host.append(section);
  if(!feedback?.[index]&&Array.isArray(reference)){const box=make('div');box.className='quiz-field-review-reference';box.append(make('p','參考答案：'+reference.map(v=>formatted(f,v)).join(' 或 ')));section.append(box);}
  if(!feedback?.[index])for(const tuple of referenceAnswer?.tuples||[])if(tuple.fields[0]===f.id){const box=make('div');box.className='quiz-field-review-reference';box.append(make('strong','這些欄位須同時符合的完整配對'));for(const accepted of tuple.accepted)box.append(make('p',tuple.fields.map(id=>formatPair(id,accepted[id])).join('；')));section.append(box);}
 }
}
const formatted=(f,v)=>{
 if(f.input==='sketch')return v?.strokes?.length?'已儲存手寫內容（'+v.strokes.length+'筆）':'未填';
 const one=id=>{const i=f.options?.findIndex(o=>o.id===id)??-1;return i<0?String(id):f.options[i].content.text||`選項${i+1}`};
 return Array.isArray(v)?v.map(one).join(f.input==='sequence'?' → ':'、')||'都不選':['single'].includes(f.input)?one(v):String(v??'未填');
};
export function fieldsResponseSummary(q,raw){const v=fieldsValues(q,raw),reading=readingPresentation(choiceQuestionPresentation(q));return q.fields.map((storedField,i)=>{const f=reading?.fields?.[i]??fieldPresentation(q,storedField);return `${f.label}：${formatted(f,v[f.id])}`}).join('；');}
export function fieldsAnswerSummary(q,answer){
 const reading=readingPresentation(choiceQuestionPresentation(q));
 const parts=q.fields.map((storedField,i)=>{const f=reading?.fields?.[i]??fieldPresentation(q,storedField);return `${f.label}：${(answer.fields[f.id]||[]).map(v=>formatted(f,v)).join(' 或 ')}`});
 for(const tuple of answer.tuples||[])parts.push('可接受的完整配對：'+tuple.accepted.map(a=>tuple.fields.map(id=>{const f=q.fields.find(f=>f.id===id);return `${f.label} ${formatted(f,a[id])}`}).join('、')).join('；'));
 return parts.join('；');
}

// The browser checks structure before import; the SQL validator independently
// checks canonical math values, tuple consistency and every nested key again.
export function validateFieldsQuestion(q,checkContent){
 const fail=()=>{throw Error('題庫格式錯誤：多格題組的欄位或答案不完整。')};
 const keys=(o,allowed)=>object(o)&&Object.keys(o).every(k=>allowed.includes(k));
 if('options'in q||!Array.isArray(q.fields)||q.fields.length<1||q.fields.length>20||!keys(q.answer,['format','fields','tuples'])||q.answer.format!=='fields-v1'||!object(q.answer.fields))fail();
 const ids=new Set();
 for(const f of q.fields){
  if(!keys(f,['id','label','input','options'])||typeof f.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(f.id)||['constructor','prototype','__proto__'].includes(f.id)||ids.has(f.id)||typeof f.label!=='string'||!f.label.trim()||f.label.length>120||!['math','text','single','set','sequence'].includes(f.input))fail();ids.add(f.id);
  const opts=new Set();
  if(['math','text'].includes(f.input)){if('options'in f)fail()}
  else{if(!Array.isArray(f.options)||f.options.length<2||f.options.length>8)fail();for(const o of f.options){if(!keys(o,['id','content'])||typeof o.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(o.id)||opts.has(o.id))fail();opts.add(o.id);checkContent(o.content)}}
  const accepted=q.answer.fields[f.id];if(!Array.isArray(accepted)||accepted.length<1||accepted.length>20)fail();
  for(const value of accepted){if(['math','text','single'].includes(f.input)){if(typeof value!=='string'||!value.trim()||value.length>250||f.input==='single'&&!opts.has(value))fail()}else if(!Array.isArray(value)||new Set(value).size!==value.length||value.some(x=>typeof x!=='string'||!opts.has(x))||f.input==='sequence'&&value.length!==opts.size)fail()}
 }
 if(Object.keys(q.answer.fields).length!==ids.size||Object.keys(q.answer.fields).some(id=>!ids.has(id)))fail();
 if('tuples'in q.answer){if(!Array.isArray(q.answer.tuples)||q.answer.tuples.length<1||q.answer.tuples.length>20)fail();for(const t of q.answer.tuples){if(!keys(t,['fields','accepted'])||!Array.isArray(t.fields)||t.fields.length<2||t.fields.length>20||new Set(t.fields).size!==t.fields.length||t.fields.some(id=>!ids.has(id))||!Array.isArray(t.accepted)||!t.accepted.length||t.accepted.length>20)fail();for(const a of t.accepted)if(!keys(a,t.fields)||Object.keys(a).length!==t.fields.length||t.fields.some(id=>!own(a,id)))fail()}}
 return q;
}
