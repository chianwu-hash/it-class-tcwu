import {createSketchEditor,sketchImage} from './sketch/editor.mjs';
import {createRegionEditor} from './drawing/regions.mjs';
import {renderWorkInput} from './quiz-work-response.mjs';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const empty=()=>({version:2,strokes:[],marks:[]});
// An explicit source adapter supplies the original content, labels, geometry and fixed review.
// No source guessing, hidden-answer inference or persistence lives in this renderer.
export function createOriginalTask(host,{task,value={},onChange=()=>{},renderContent,locked=false}={}){
 const state=structuredClone(value),editors=[];host.classList.add('original-task');const emit=()=>onChange(structuredClone(state));
 const source=make('section',undefined,'original-source'),answer=make('section',undefined,'original-answer');renderContent(source,task.prompt);host.append(source,answer);
 const input=(parent,key,label,{choices,rows=1,width}={})=>{const l=make('label',label,'original-input'),i=make(choices?'select':rows>1?'textarea':'input');if(choices){i.append(make('option','請選擇'));i.firstChild.value='';for(const c of choices){const o=make('option',c);o.value=c;i.append(o);}}else if(rows>1)i.rows=rows;else i.type='text';i.value=state[key]??'';i.disabled=locked;i.maxLength=250;i.autocomplete='off';if(width)i.style.width=width;i.oninput=()=>{state[key]=i.value;emit();};i.dataset.responseField=key;l.append(i);parent.append(l);return i;};
 const board=(parent,key,drawing=task.drawing)=>{const b=make('div',undefined,'original-board');parent.append(b);let editor;if(locked){const v=state[key];if(v?.strokes?.length||v?.marks?.length)b.append(sketchImage(v,{drawing,renderContent}));else b.append(make('p','尚未作圖。'));return;}if(task.kind==='color')editor=createRegionEditor(b,{value:state[key]??empty(),drawing,regions:task.regions,renderContent,onChange:v=>{state[key]=v;emit();}});else editor=createSketchEditor(b,{value:state[key]??empty(),drawing,renderContent,onChange:v=>{state[key]=v;emit();}});editors.push(editor);};
 if(task.kind==='expression'||task.kind==='vertical'){
  const q=task.question;for(const f of q.fields)input(answer,f.id,f.label==='第1格'?'商':f.label==='第2格'?'餘數':f.label,{width:'8em'});
  if(task.kind==='expression'){const raw=JSON.stringify({v:1,f:{},w:state.work??''});editors.push(renderWorkInput(answer,q,{raw,locked,onChange:v=>{state.work=v;emit();}}));}else{answer.append(make('h3','寫下完整直式'));board(answer,'work',task.drawing);}
 }else if(['grid','sector','color'].includes(task.kind)){
  if(task.kind==='sector')answer.append(make('p','方格每格代表1公分。選「圓與扇形」，設定半徑、圓心角後點圓心。'));
  board(answer,'work');
 }else if(task.kind==='measure'){
  // Keep the original answer options and offer a movable three-point angle tool on the same artwork.
  input(answer,'choice','角度（度）',{choices:task.question.options.map(o=>o.content.text.trim())});board(answer,'work',task.drawing);
 }else if(task.kind==='graph'){
  source.classList.add('original-source-sticky');
  for(const [index,g]of task.graphs.entries()){const group=make('section',undefined,'original-group');group.append(make('h3',g.title));renderContent(group,g.table);input(group,'x'+index,'橫軸名稱與單位');input(group,'y'+index,'縱軸名稱與單位');group.append(make('p','在原圖標示刻度、點出各組座標並依序連線；可用文字標記補軸名。'));board(group,'plot'+index,g.drawing);answer.append(group);}
  const discussion=make('section',undefined,'original-group');discussion.append(make('h3','進行討論'));task.discussion.forEach((s,i)=>input(discussion,'discuss'+i,s,{choices:['打勾','不打勾']}));input(discussion,'conclusion','我的結論',{rows:3});answer.append(discussion);
 }else if(task.kind==='experiment'){
  // Editable cells mirror the original table; observations remain the student's own record.
  const table=make('table'),thead=make('thead'),tr=make('tr');['觀察情形','較陡坡','較緩坡'].forEach(t=>tr.append(make('th',t)));thead.append(tr);table.append(thead);const body=make('tbody');
  for(const [row,label]of task.observations.entries()){const tr=make('tr');tr.append(make('th',label));for(let col=0;col<2;col++){const td=make('td');input(td,'observation'+row+'_'+col,(col?'較緩坡':'較陡坡')+'：'+label,row<2?{rows:3}:{choices:task.depositChoices});tr.append(td);}body.append(tr);}table.append(body);answer.append(table);
  const more=make('section',undefined,'original-group');more.append(make('h3','比較與結論'));task.discussion.forEach((s,i)=>input(more,'discuss'+i,s,{choices:['打勾','不打勾']}));for(const [i,label]of task.conclusionLabels.entries())input(more,'conclusion'+i,label,{width:'8em'});answer.append(more);
 }
 return{getValue:()=>structuredClone(state),setDisabled(v){for(const e of editors)e?.setDisabled(v);answer.querySelectorAll('input,select,textarea').forEach(i=>i.disabled=v);},destroy(){for(const e of editors)e?.destroy();host.replaceChildren();}};
}
export function renderOriginalReview(host,{review,value,task,renderContent}){
 host.classList.add('original-review');host.append(make('h2','一起核對'));if(review.verdict)host.append(make('p',review.verdict,review.correct?'original-correct':'original-check'));
 for(const section of review.sections){const group=make('section',undefined,'original-group');group.append(make('h3',section.title));for(const p of section.paragraphs??[])group.append(make('p',p));if(section.image){const img=make('img');img.src=section.image;img.alt=section.imageAlt??'參考解法圖';group.append(img);}if(section.drawing)group.append(sketchImage(section.drawing,{drawing:section.paper,renderContent}));host.append(group);}
}
