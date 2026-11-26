import {validateSketch} from './sketch/contract.mjs';
import {createSketchEditor,sketchImage} from './sketch/editor.mjs';
import {workAnswerPresentation,encodeWorkGroups,decodeWorkGroups} from './quiz-work-answer-layout.mjs';
import {splitWorkSketch,mergeWorkSketch} from './quiz-work-sketch-groups.mjs';
import {groupingDrawingPlan,renderGroupingDrawing} from './quiz-grouping-drawing.mjs';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const savedSketch=value=>{try{validateSketch(value);return true;}catch{return false;}};
export function validWorkSpec(q){
 const w=q.work;
 return q.type==='fields'&&object(w)&&Object.keys(w).length===2&&Object.keys(w).every(k=>['input','label'].includes(k))
  &&['expression','sketch'].includes(w.input)&&typeof w.label==='string'&&w.label.trim().length>0&&w.label.length<=120;
}
export function workValue(raw){try{return JSON.parse(raw).w;}catch{return undefined;}}
export function workResponseError(q,value){
 if(!Object.hasOwn(q,'work'))return value===undefined?'':'作答格式不完整。';
 if(!validWorkSpec(q))return '題目的計算過程格式不完整。';
 if(q.work.input==='expression'){
  if(typeof value!=='string'||!value.trim())return '請輸入算式或計算過程，最多250字。';
  const groups=workAnswerPresentation(q)?.groups,parts=groups&&decodeWorkGroups(value,groups.length);
  if(value.length>250)return parts?'這些算式合併後太長，請縮短後再儲存。':'請輸入算式或計算過程，最多250字。';
  return parts?.some(s=>!s.trim())?'請完成每一項算式紀錄。':'';
 }
 try{validateSketch(value);const labels=workAnswerPresentation(q)?.sketchGroups,parts=labels&&splitWorkSketch(value,labels.length);return parts?.some(p=>!p.strokes.length)?'請完成每一小題的直式紀錄。':'';}catch{return groupingDrawingPlan(q)?'請先在原圖圈畫，再填答案。':'請在直式作答區寫下計算過程，每張紙最多80筆。';}
}
export function renderSavedWork(host,q,raw,{saved=true,renderContent}={}){
 if(!q.work)return;
 const section=make('section');section.className=saved?'quiz-saved-work':'quiz-pending-work';section.append(make('strong',q.work.label));
 const value=workValue(raw);
 const grouping=renderContent&&groupingDrawingPlan(q);
 if(grouping){
  renderGroupingDrawing(section,grouping,{value,locked:true,renderContent});
  if(saved)section.append(make('p','圈畫已保存，請對照教師參考圖。系統核對下方兩個數字。'));
  host.append(section);return section;
 }
 if(q.work.input==='expression'&&typeof value==='string'&&value.trim()){
  const groups=workAnswerPresentation(q)?.groups,parts=groups&&decodeWorkGroups(value,groups.length);
  if(parts){const list=make('dl');groups.forEach((label,i)=>list.append(make('dt',label),make('dd',parts[i]||'（原作答未填寫）')));section.append(list);}else section.append(make('p',value));
 }
 else if(workResponseError(q,value)&&!(q.work.input==='sketch'&&savedSketch(value)))section.append(make('p','這份舊作答沒有可顯示的計算過程。'));
 else{const labels=workAnswerPresentation(q)?.sketchGroups,parts=labels&&splitWorkSketch(value,labels.length);
  if(parts){parts.forEach((part,i)=>{const box=make('section');box.className='quiz-work-sketch-part';box.append(make('strong',labels[i]));if(part.strokes.length){const image=sketchImage(part);image.setAttribute('aria-label',labels[i]+(saved?'已保存的直式作答':'待確認保存的直式作答'));box.append(image);}else box.append(make('p','這一小題原作答未留下筆跡。'));section.append(box);});}
  else{const image=sketchImage(value);image.setAttribute('aria-label',saved?'已保存的直式作答':'待確認保存的直式作答');section.append(image);}}
 section.append(make('p',saved?'計算過程已保存，請對照參考解法核對；系統只判分答案欄。':'正在確認保存結果，請使用原送答按鈕重試。'));host.append(section);return section;
}
export function renderWorkInput(host,q,{raw,locked,saved=locked,onChange,renderContent}){
 if(!q.work)return null;
 if(!validWorkSpec(q))throw Error('invalid_work_spec');
 if(locked){renderSavedWork(host,q,raw,{saved,renderContent});return null;}
 const section=make('section');section.className='quiz-work-input';const label=make('label',q.work.label);section.append(label);
 const grouping=renderContent&&groupingDrawingPlan(q);
 if(grouping){
  const editor=renderGroupingDrawing(section,grouping,{value:workValue(raw),onChange,locked:false,renderContent});
  if(editor){host.append(section);return editor;}
 }
 let editor=null;
 if(q.work.input==='sketch'){
  const labels=workAnswerPresentation(q)?.sketchGroups,parts=labels&&splitWorkSketch(workValue(raw),labels.length);
  if(parts){const editors=[];labels.forEach((text,i)=>{const box=make('section'),board=make('div');box.className='quiz-work-sketch-part';box.append(make('strong',text),board);section.append(box);editors.push(createSketchEditor(board,{value:parts[i],canAddStroke:()=>editors.reduce((n,e)=>n+e.getValue().strokes.length,0)<80,canRestore:next=>editors.reduce((n,e,j)=>n+(j===i?next.strokes.length:e.getValue().strokes.length),0)<=80,messages:{boardLabel:text+'，請寫直式',fullHint:'各小題合計最多80筆，可擦除或復原後繼續。'},onChange:()=>onChange(mergeWorkSketch(editors.map(e=>e.getValue())))}));});editor={setDisabled:next=>editors.forEach(e=>e.setDisabled(next)),getValue:()=>mergeWorkSketch(editors.map(e=>e.getValue())),destroy:()=>editors.forEach(e=>e.destroy())};}
  else{const board=make('div');section.append(board);editor=createSketchEditor(board,{value:workValue(raw),onChange});}
 }else{
  const input=make('input');input.id='work-'+q.id;input.type='text';input.maxLength=250;input.autocomplete='off';input.value=typeof workValue(raw)==='string'?workValue(raw):'';label.htmlFor=input.id;
  input.addEventListener('input',()=>onChange(input.value));section.append(input);
  let active=input;
  const plan=workAnswerPresentation(q),parts=plan?.groups&&(input.value?decodeWorkGroups(input.value,plan.groups.length):plan.groups.map(()=>''));
  if(parts){
   input.type='hidden';const controls=[];section.classList.add('quiz-work-grouped');
   plan.groups.forEach((text,i)=>{const row=make('label',text),part=make('input');row.className='quiz-work-part';part.type='text';part.id=input.id+'-part-'+i;part.value=parts[i];part.autocomplete='off';part.maxLength=250;part.setAttribute('aria-label',text);part.addEventListener('focus',()=>{active=part;});part.addEventListener('input',()=>{input.value=encodeWorkGroups(controls.map(n=>n.value));input.dispatchEvent(new Event('input',{bubbles:true}));});controls.push(part);row.append(part);section.append(row);});
   active=controls[0];label.htmlFor=active.id;
  }
  const keys=make('div');keys.className='quiz-work-keys';keys.setAttribute('role','group');keys.setAttribute('aria-label','算式輸入按鍵');
  const insert=(value,event)=>{if(active.disabled)return;const a=active.selectionStart??active.value.length,b=active.selectionEnd??a;if(active.value.length-b+a+value.length>250)return;active.setRangeText(value,a,b,'end');active.dispatchEvent(new Event('input',{bubbles:true}));if(event.detail>0)active.focus({preventScroll:true});};
  for(const key of ['7','8','9','＋','−','4','5','6','×','÷','1','2','3','＝','餘','0','（','）','.','；']){const button=make('button',key);button.type='button';button.setAttribute('aria-label','輸入'+key);button.addEventListener('click',event=>insert(key,event));keys.append(button);}
  const erase=make('button','刪除');erase.type='button';erase.onclick=event=>{let a=active.selectionStart??active.value.length,b=active.selectionEnd??a;if(a===b)a=Math.max(0,a-([...active.value.slice(0,a)].at(-1)?.length??0));active.setSelectionRange(a,b);insert('',event);};keys.append(erase);section.append(keys);
 }
 section.append(make('p','填好計算過程與答案後，一起送出。'));host.append(section);return editor;
}
