import {appendSingleChoiceOptions} from './quiz-choice.mjs';
import {attachPastInputKeyboard} from './quiz-past-input.mjs';

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
 for(const f of q.fields){
  const v=d.f[f.id];if(!own(d.f,f.id))return '請完成每個答案欄。';
  if(['math','text','single'].includes(f.input)){
   if(typeof v!=='string'||!v.trim()||v.length>250)return `請完成「${f.label}」，每格最多250字。`;
   if(f.input==='single'&&!f.options.some(o=>o.id===v))return `請選擇「${f.label}」的答案。`;
  }else if(!Array.isArray(v)||v.some(x=>typeof x!=='string'||!f.options.some(o=>o.id===x))||new Set(v).size!==v.length||f.input==='sequence'&&v.length!==f.options.length)return `請完成「${f.label}」的${f.input==='sequence'?'排列':'選擇'}。`;
 }
 return '';
}

export function renderFieldsInputs(host,q,{raw='',locked=false,onChange,renderContent}){
 const values=fieldsValues(q,raw),group=make('div');group.className='quiz-fields';
 const changed=()=>onChange(JSON.stringify({v:1,f:values}));
 group.append(make('p','依照題目順序填好每格，再一起送出。'));
 for(const f of q.fields){
  const slot=make('fieldset'),legend=make('legend',f.label),id='field-'+q.id+'-'+f.id;slot.className='quiz-field';slot.append(legend);
  if(['math','text'].includes(f.input)){
   const input=make('input');input.id=id;input.type='text';input.maxLength=250;input.value=typeof values[f.id]==='string'?values[f.id]:'';input.disabled=locked;input.autocomplete='off';input.setAttribute('aria-label',f.label);
   if(f.input==='math')input.placeholder='分數可以用 / 表示';
   input.addEventListener('input',()=>{values[f.id]=input.value;changed()});slot.append(input);
   if(f.input==='math')attachPastInputKeyboard(slot,input,{math:true});
  }else if(f.input==='single'){
   appendSingleChoiceOptions(slot,{name:id,options:f.options.map(o=>({...o,value:o.id})),selected:values[f.id],locked,onSelect:v=>{values[f.id]=v;changed()},renderBody:(box,o)=>renderContent(box,o.content)});
  }else if(f.input==='set'){
   const checks=[];const update=()=>{values[f.id]=checks.filter(x=>x.input.checked).map(x=>x.id);none.checked=values[f.id].length===0;changed()};
   for(const o of f.options){const label=make('label'),input=make('input');input.type='checkbox';input.disabled=locked;input.checked=Array.isArray(values[f.id])&&values[f.id].includes(o.id);const body=make('span');renderContent(body,o.content);label.append(input,body);slot.append(label);checks.push({id:o.id,input});input.addEventListener('change',update)}
   const label=make('label'),none=make('input');none.type='checkbox';none.disabled=locked;none.checked=Array.isArray(values[f.id])&&values[f.id].length===0;none.addEventListener('change',()=>{if(none.checked)checks.forEach(x=>x.input.checked=false);values[f.id]=none.checked?[]:null;changed()});label.append(none,document.createTextNode('這些選項都不選'));slot.append(label);
  }else if(f.input==='sequence'){
   f.options.forEach((_,i)=>{const label=make('label',`第${i+1}個：`),select=make('select');select.disabled=locked;select.id=id+'-'+i;const empty=make('option','請選擇');empty.value='';select.append(empty);f.options.forEach((o,n)=>{const option=make('option',o.content.text||`選項${n+1}`);option.value=o.id;select.append(option)});select.value=values[f.id]?.[i]||'';select.addEventListener('change',()=>{const next=Array.isArray(values[f.id])?[...values[f.id]]:Array(f.options.length).fill('');next[i]=select.value;values[f.id]=next;changed()});label.append(select);slot.append(label)});
   // Keep the complete original option content, including diagrams, beside the ordering controls.
   f.options.forEach((o,i)=>{const row=make('div');row.append(make('strong',`選項${i+1}　`));renderContent(row,o.content);slot.append(row)});
  }
  group.append(slot);
 }
 host.append(group);return group;
}
const formatted=(f,v)=>{
 const one=id=>{const i=f.options?.findIndex(o=>o.id===id)??-1;return i<0?String(id):f.options[i].content.text||`選項${i+1}`};
 return Array.isArray(v)?v.map(one).join(f.input==='sequence'?' → ':'、')||'都不選':['single'].includes(f.input)?one(v):String(v??'未填');
};
export function fieldsResponseSummary(q,raw){const v=fieldsValues(q,raw);return q.fields.map(f=>`${f.label}：${formatted(f,v[f.id])}`).join('；');}
export function fieldsAnswerSummary(q,answer){
 const parts=q.fields.map(f=>`${f.label}：${(answer.fields[f.id]||[]).map(v=>formatted(f,v)).join(' 或 ')}`);
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
