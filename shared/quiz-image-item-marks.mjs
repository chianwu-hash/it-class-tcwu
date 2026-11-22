const labels=['最重','最輕','清除'];
const displayed=symbol=>symbol==='ˇ'?'✓':symbol;

export function deriveImageItemMarks(q){
 const fields=q?.fields,media=q?.prompt?.media;
 if(q?.type!=='fields'||typeof q.prompt?.text!=='string'||q.prompt.layout||!Array.isArray(fields)||fields.length<2||fields.length>8||
    !Array.isArray(media)||media.length!==fields.length||media.some(item=>item.kind!=='image'))return null;
 const instruction=q.prompt.text.trim().split('\n').at(-1);
 const match=/^最重的(?:打|畫)([ˇ○])，最輕的(?:打|畫)(╳)。$/u.exec(instruction);
 if(!match)return null;
 const symbols=[match[1],match[2],'留白'];
 if(fields.some(f=>f.input!=='single'||!f.label?.trim()||f.options?.length!==symbols.length||
     f.options.some((o,i)=>o.content?.text!==symbols[i]||o.content?.media?.length||o.content?.layout)))return null;
 return {mode:'image-item-marks',symbols};
}

export function mountImageItemMarks(container,plan,q,slots,{renderContent,fieldFeedback}){
 const doc=container.ownerDocument;
 const radios=slots.map(slot=>[...slot.querySelectorAll(':scope > .student-option input[type="radio"]')]);
 if(radios.some((inputs,i)=>inputs.length!==3||inputs.some((input,j)=>input.value!==q.fields[i].options[j].id)))return false;
 const locked=radios.every(inputs=>inputs.every(input=>input.disabled));
 const make=(tag,text='')=>{const node=doc.createElement(tag);node.textContent=text;return node;};
 const button=(text,cls)=>{const node=make('button',text);node.type='button';node.className=cls;return node;};
 const grid=make('div');grid.className='quiz-image-marks-grid';
 const hint=make('p');hint.className='helper';hint.setAttribute('aria-live','polite');
 const defaultHint='把符號拖到空格，或先點符號再點空格。其餘留白。';
 hint.textContent=locked?'原標記已保留。':defaultHint;
 let selected=null,drag=null,hovered=null,suppressClick=false,completing=false;
 const ghost=make('span');ghost.className='quiz-image-mark-ghost';ghost.hidden=true;ghost.setAttribute('aria-hidden','true');
 const glyph=index=>index===2?'':displayed(plan.symbols[index]);
 const tools=make('div');tools.className='quiz-image-mark-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','標記工具');
 const keys=labels.map((label,i)=>button(i===2?label:glyph(i)+' '+label,'quiz-image-mark-tool'));
 const markName=index=>index<2?glyph(index)+' '+labels[index]:'留白';
 const sync=()=>{
  keys.forEach((key,i)=>key.setAttribute('aria-pressed',String(selected===i)));
  targets.forEach((target,i)=>{
   const mark=radios[i].findIndex(input=>input.checked);
   target.textContent=mark<0?'':glyph(mark);
   target.dataset.empty=String(mark<0||mark===2);
   target.setAttribute('aria-label',q.fields[i].label+'，標記空格，目前'+(mark<0?'未標記':markName(mark)));
  });
 };
 const apply=(row,mark)=>{
  if(locked)return;
  const input=radios[row]?.[mark];
  if(!input||input.disabled)return;
  input.click();
  selected=null;sync();
  hint.textContent=q.fields[row].label+(mark===2?'已留白。':'已標記為'+labels[mark]+'。');
 };
 const targets=slots.map((slot,index)=>{
  const art=make('div');art.className='quiz-image-mark-art';
  renderContent(art,{text:'',media:[plan.renderPrompt.media[index]]});
  const native=make('div');native.className='quiz-image-mark-native';native.hidden=true;
  native.append(...slot.querySelectorAll(':scope > .student-option'));
  slot.append(native);
  slot.querySelector(':scope > .quiz-field-review-status')?.remove();
  slot.classList.add('quiz-image-mark-card');
  const target=button('','quiz-image-mark-slot');target.dataset.markSlot=index;target.disabled=locked;
  target.addEventListener('click',()=>{
   if(selected===null){hint.textContent='請先點選符號或清除，再點這個空格。';return;}
   apply(index,selected);
  });
  const feedback=fieldFeedback?.[index];
  slot.append(art,target);
  if(feedback){
   const actual=radios[index].findIndex(r=>r.checked);
   const expected=radios[index].findIndex(r=>feedback.accepted.includes(r.value));
   if(feedback.state!=='correct'||actual!==2){
    const note=make('p',feedback.state==='correct'?'標記正確':expected>=0?'應標記為'+markName(expected):'請核對這個標記');
    note.className='quiz-image-mark-feedback';note.dataset.state=feedback.state;slot.append(note);
   }
  }
  grid.append(slot);
  return target;
 });
 const getTarget=event=>{
  const target=doc.elementFromPoint(event.clientX,event.clientY)?.closest('[data-mark-slot]');
  return target&&grid.contains(target)&&!target.disabled?target:null;
 };
 if(!locked){
  keys.forEach((key,i)=>{
   key.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;
    suppressClick=false;
    drag={id:event.pointerId,mark:i,x:event.clientX,y:event.clientY,moved:false};
    ghost.textContent=i===2?'清除':glyph(i);
    key.setPointerCapture(event.pointerId);
   });
   key.addEventListener('click',event=>{
    if(suppressClick&&event.detail!==0){suppressClick=false;return;}
    selected=selected===i?null:i;
    hint.textContent=selected===null?defaultHint:'已選「'+labels[i]+'」，再點一個空格。';
    sync();
   });
   tools.append(key);
  });
  container.addEventListener('change',event=>{
   if(completing||!radios.some(inputs=>inputs.includes(event.target)))return;
   completing=true;
   try{for(const inputs of radios)if(!inputs.some(input=>input.checked))inputs[2].click();}
   finally{completing=false;}
   sync();
  });
  container.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
   drag.moved=true;ghost.hidden=false;
   const bounds=container.getBoundingClientRect();
   ghost.style.left=Math.max(0,Math.min(bounds.width,event.clientX-bounds.left))+'px';
   ghost.style.top=Math.max(0,Math.min(bounds.height,event.clientY-bounds.top))+'px';
   const target=getTarget(event);
   if(hovered!==target){
    if(hovered)delete hovered.dataset.dropTarget;
    if(target)target.dataset.dropTarget='true';
    hovered=target;
   }
  });
  const finishDrag=event=>{
   if(!drag||event.pointerId!==drag.id)return;
   const {mark,moved}=drag;
   const target=event.type==='pointerup'&&moved?getTarget(event):null;
   drag=null;ghost.hidden=true;
   if(hovered)delete hovered.dataset.dropTarget;
   hovered=null;suppressClick=moved;
   if(target)apply(Number(target.dataset.markSlot),mark);
  };
  for(const event of ['pointerup','pointercancel','lostpointercapture'])container.addEventListener(event,finishDrag);
  container.append(tools,ghost);
 }
 container.append(hint,grid);sync();
 return true;
}
