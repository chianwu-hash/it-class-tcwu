import {createSketchEditor} from './sketch/editor.mjs';
import {setToolIcon} from './tool-icons.mjs';

// Personal, page-lifetime working paper. Never submitted with answers or messages.
export function createQuizScratchpad(){
 const drafts=new Map();let currentKey=null,editor=null,opener=null,destroyed=false;
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const dialog=make('dialog',null,'quiz-scratchpad-dialog'),head=make('header',null,'quiz-scratchpad-heading'),title=make('h2','計算紙'),closeButton=make('button','收起計算紙'),body=make('div',null,'quiz-scratchpad-body'),editorHost=make('div');
 title.id='scratchpad-'+crypto.randomUUID();dialog.setAttribute('aria-labelledby',title.id);closeButton.type='button';head.append(title,closeButton);body.append(make('p','草稿只留在這個頁面，重新整理或登出會清除。','quiz-scratchpad-note'),editorHost);dialog.append(head,body);
 const save=()=>{if(currentKey&&editor)drafts.set(currentKey,editor.getValue());};
 function close({restoreFocus=true}={}){save();if(dialog.open)dialog.close();if(opener?.isConnected){opener.setAttribute('aria-expanded','false');if(restoreFocus)opener.focus({preventScroll:true});}}
 closeButton.onclick=()=>close();
 const escape=e=>{if(e.key==='Escape'&&dialog.open&&!document.querySelector('#lightbox:not(.hidden)')){e.preventDefault();close();}};
 document.addEventListener('keydown',escape);
 function attach({host,key,label='計算紙'}){
  if(destroyed||!key)return;
  if(currentKey!==key){close({restoreFocus:false});editor?.destroy();editor=null;currentKey=key;title.textContent=label;}
  const button=make('button',null,'quiz-scratchpad-entry');button.type='button';setToolIcon(button,'pen','計算紙');button.append(make('span','計算紙'));button.setAttribute('aria-expanded',String(dialog.open));button.setAttribute('aria-controls',title.id+'-panel');dialog.id=title.id+'-panel';
  opener=button;button.onclick=()=>{
   if(dialog.open){close();return;}
   if(!dialog.isConnected)document.body.append(dialog);
   if(!editor)editor=createSketchEditor(editorHost,{value:drafts.get(currentKey)||{version:1,strokes:[]},onChange:value=>drafts.set(currentKey,value),messages:{boardLabel:'計算紙，可用滑鼠、手指或觸控筆',capacityHint:'計算紙快寫滿了，可以擦掉不需要的筆畫。',fullHint:'計算紙寫滿了，可以擦掉不需要的筆畫，或清除後重寫。',clearConfirm:'確定要清除這題的計算紙嗎？清除後可按「復原一步」。'}});
   dialog.show();button.setAttribute('aria-expanded','true');
  };
  host.prepend(button);
 }
 function clear(){close({restoreFocus:false});editor?.destroy();editor=null;drafts.clear();currentKey=null;opener=null;dialog.remove();}
 return {attach,close,clear,destroy(){clear();destroyed=true;document.removeEventListener('keydown',escape);}};
}
