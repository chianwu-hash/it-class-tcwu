import {createSketchEditor} from './sketch/editor.mjs';
import {setToolIcon} from './tool-icons.mjs';

// Personal, page-lifetime working paper. Never submitted with answers or messages.
export function createQuizScratchpad(){
 const drafts=new Map();let currentKey=null,editor=null,opener=null,destroyed=false,resizing=null;
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const dialog=make('dialog',null,'quiz-scratchpad-dialog'),head=make('header',null,'quiz-scratchpad-heading'),title=make('h2','計算紙'),closeButton=make('button','×'),body=make('div',null,'quiz-scratchpad-body'),editorHost=make('div'),toolbar=make('div',null,'quiz-scratchpad-tools sketch-editor'),grip=make('button',null,'quiz-scratchpad-resize');
 title.id='scratchpad-'+crypto.randomUUID();dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-description','草稿只留在這個頁面，重新整理或登出會清除。');closeButton.type='button';closeButton.setAttribute('aria-label','收起計算紙');closeButton.title='收起計算紙';head.append(title,toolbar,closeButton);body.append(editorHost);dialog.append(head,body);
 grip.type='button';grip.title='拖曳調整大小（↙／↗）';grip.setAttribute('aria-label','調整計算紙大小');grip.setAttribute('aria-description','使用左右方向鍵調整寬度。');grip.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 20 4M4 12v8h8M12 4h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';dialog.append(grip);
 function resizeTo(width){const right=parseFloat(getComputedStyle(dialog).right)||0,max=Math.max(300,window.innerWidth-right-8);dialog.style.width=Math.round(Math.max(300,Math.min(max,width)))+'px';}
 function stopResize(event){if(!resizing||event&&event.pointerId!==resizing.id)return;const id=resizing.id;resizing=null;if(grip.hasPointerCapture(id))grip.releasePointerCapture(id);}
 grip.onpointerdown=event=>{if(resizing||event.button!==0)return;event.preventDefault();event.stopPropagation();resizing={id:event.pointerId,x:event.clientX,width:dialog.getBoundingClientRect().width};grip.setPointerCapture(event.pointerId);};
 grip.onpointermove=event=>{if(resizing?.id!==event.pointerId)return;event.preventDefault();resizeTo(resizing.width+resizing.x-event.clientX);};
 grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=stopResize;
 grip.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();resizeTo(dialog.getBoundingClientRect().width+(event.key==='ArrowLeft'?24:-24));};
 const save=()=>{if(currentKey&&editor)drafts.set(currentKey,editor.getValue());};
 function close({restoreFocus=true}={}){stopResize();save();if(dialog.open)dialog.close();if(opener?.isConnected){opener.setAttribute('aria-expanded','false');if(restoreFocus)opener.focus({preventScroll:true});}}
 closeButton.onclick=()=>close();
 const escape=e=>{if(e.key==='Escape'&&dialog.open&&!document.querySelector('#lightbox:not(.hidden)')){e.preventDefault();close();}};
 document.addEventListener('keydown',escape);
 function attach({host,key,label='計算紙'}){
  if(destroyed||!key)return;
  if(currentKey!==key){close({restoreFocus:false});editor?.destroy();editor=null;currentKey=key;title.textContent=label;head.title=label+'；重整或登出會清除草稿';}
  const button=make('button',null,'quiz-scratchpad-entry');button.type='button';setToolIcon(button,'pen','計算紙');button.title='計算紙；重整或登出會清除草稿';button.append(make('span','計算紙'));button.setAttribute('aria-expanded',String(dialog.open));button.setAttribute('aria-controls',title.id+'-panel');dialog.id=title.id+'-panel';
  opener=button;button.onclick=()=>{
   if(dialog.open){close();return;}
   if(!dialog.isConnected)document.body.append(dialog);
   if(!editor)editor=createSketchEditor(editorHost,{toolbarHost:toolbar,value:drafts.get(currentKey)||{version:1,strokes:[]},onChange:value=>drafts.set(currentKey,value),messages:{boardLabel:'計算紙，可用滑鼠、手指或觸控筆',capacityHint:'計算紙快寫滿了，可以擦掉不需要的筆畫。',fullHint:'計算紙寫滿了，可以擦掉不需要的筆畫，或清除後重寫。',clearConfirm:'確定要清除這題的計算紙嗎？清除後可按「復原一步」。'}});
   dialog.show();button.setAttribute('aria-expanded','true');
  };
  const heading=host.querySelector(':scope>.card-title')||host.querySelector(':scope>h3');
  if(heading){heading.classList.add('quiz-question-toolbar');heading.insertBefore(button,heading.querySelector(':scope>.badge'));}
  else{host.classList.add('quiz-scratchpad-anchor');button.classList.add('quiz-scratchpad-entry-floating');host.append(button);}
 }
 function clear(){close({restoreFocus:false});editor?.destroy();editor=null;drafts.clear();currentKey=null;opener=null;dialog.remove();}
 return {attach,close,clear,destroy(){clear();destroyed=true;document.removeEventListener('keydown',escape);}};
}
