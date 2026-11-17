import {validateSketch} from './sketch/contract.mjs';
import {createSketchEditor,sketchImage} from './sketch/editor.mjs';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function validWorkSpec(q){
 const w=q.work;
 return q.type==='fields'&&object(w)&&Object.keys(w).length===2&&Object.keys(w).every(k=>['input','label'].includes(k))
  &&['expression','sketch'].includes(w.input)&&typeof w.label==='string'&&w.label.trim().length>0&&w.label.length<=120;
}
export function workValue(raw){try{return JSON.parse(raw).w;}catch{return undefined;}}
export function workResponseError(q,value){
 if(!Object.hasOwn(q,'work'))return value===undefined?'':'作答格式不完整。';
 if(!validWorkSpec(q))return '題目的計算過程格式不完整。';
 if(q.work.input==='expression')return typeof value==='string'&&value.trim()&&value.length<=250?'':'請輸入算式或計算過程，最多250字。';
 try{validateSketch(value);return '';}catch{return '請在直式作答區寫下計算過程，每張紙最多80筆。';}
}
export function renderSavedWork(host,q,raw,{saved=true}={}){
 if(!q.work)return;
 const section=make('section');section.className=saved?'quiz-saved-work':'quiz-pending-work';section.append(make('strong',q.work.label));
 const value=workValue(raw);
 if(workResponseError(q,value))section.append(make('p','這份舊作答沒有可顯示的計算過程。'));
 else if(q.work.input==='expression')section.append(make('p',value));
 else{const image=sketchImage(value);image.setAttribute('aria-label',saved?'已保存的直式作答':'待確認保存的直式作答');section.append(image);}
 section.append(make('p',saved?'計算過程已保存，請對照參考解法核對；系統只判分答案欄。':'正在確認保存結果，請使用原送答按鈕重試。'));host.append(section);return section;
}
export function renderWorkInput(host,q,{raw,locked,saved=locked,onChange}){
 if(!q.work)return null;
 if(!validWorkSpec(q))throw Error('invalid_work_spec');
 if(locked){renderSavedWork(host,q,raw,{saved});return null;}
 const section=make('section');section.className='quiz-work-input';const label=make('label',q.work.label);section.append(label);
 let editor=null;
 if(q.work.input==='sketch'){
  const board=make('div');section.append(board);
  editor=createSketchEditor(board,{value:workValue(raw),onChange});
 }else{
  const input=make('input');input.id='work-'+q.id;input.type='text';input.maxLength=250;input.autocomplete='off';input.value=typeof workValue(raw)==='string'?workValue(raw):'';label.htmlFor=input.id;
  input.addEventListener('input',()=>onChange(input.value));section.append(input);
  const keys=make('div');keys.className='quiz-work-keys';keys.setAttribute('role','group');keys.setAttribute('aria-label','算式輸入按鍵');
  const insert=value=>{if(input.disabled)return;const a=input.selectionStart??input.value.length,b=input.selectionEnd??a;if(input.value.length-b+a+value.length>250)return;input.setRangeText(value,a,b,'end');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});};
  for(const key of ['7','8','9','＋','−','4','5','6','×','÷','1','2','3','＝','餘','0','（','）','.','；']){const button=make('button',key);button.type='button';button.setAttribute('aria-label','輸入'+key);button.addEventListener('click',()=>insert(key));keys.append(button);}
  const erase=make('button','刪除');erase.type='button';erase.onclick=()=>{let a=input.selectionStart??input.value.length,b=input.selectionEnd??a;if(a===b)a=Math.max(0,a-1);input.setSelectionRange(a,b);insert('');};keys.append(erase);section.append(keys);
 }
 section.append(make('p','填好計算過程與答案後，一起送出。'));host.append(section);return editor;
}
