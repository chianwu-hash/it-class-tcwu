import {completeSequence,initialSequence,moveSequence,sequenceReference} from './quiz-sequence-model.mjs';
let activeDrag=null;
const make=(doc,tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function renderSequenceCards(host,field,{value=null,locked=false,onChange,renderContent,accepted=null}={}){
 const doc=host.ownerDocument||document,view=doc.defaultView,root=make(doc,'div',undefined,'quiz-sequence'),list=make(doc,'ol',undefined,'quiz-sequence-list');
 const hint=make(doc,'p',locked?(completeSequence(field,value)?'你保存的排列順序：':'尚未保存完整的排列順序。'):'拖曳卡片排順序，也可以按「上移／下移」。','quiz-sequence-hint');
 const live=make(doc,'p','','quiz-sequence-live');live.setAttribute('role','status');live.setAttribute('aria-live','polite');list.setAttribute('aria-label',field.label+'・排列順序');root.append(hint,list,live);host.append(root);
 let order=initialSequence(field,value),drag=null;const nodes=new Map();
 const target=sequenceReference(field,value,accepted),editable=()=>!locked&&root.isConnected!==false&&!nodes.values().next().value?.querySelector('.quiz-sequence-handle')?.disabled;
 const commit=()=>{if(editable())onChange?.([...order]);};
 function paint(){
  const suspended=!locked&&nodes.values().next().value?.querySelector('.quiz-sequence-handle')?.disabled;
  for(const [i,id]of order.entries()){
   const li=nodes.get(id);li.querySelector('.quiz-sequence-position').textContent=String(i+1);li.setAttribute('aria-posinset',String(i+1));li.setAttribute('aria-setsize',String(order.length));
   if(!locked){li.querySelector('[data-sequence-move=up]').disabled=suspended||i===0;li.querySelector('[data-sequence-move=down]').disabled=suspended||i===order.length-1;}
   list.append(li);
  }
 }
 function move(id,to,focusKind){
  if(!editable())return;const next=moveSequence(order,id,to);if(next===order)return;order=next;paint();commit();live.textContent='已移到第'+(to+1)+'個位置。';
  const li=nodes.get(id),button=li.querySelector('[data-sequence-move='+focusKind+']');(button&&!button.disabled?button:li).focus({preventScroll:true});
 }
 function finish(cancel=false){
  if(!drag)return;const d=drag;drag=null;if(activeDrag===cancelDrag)activeDrag=null;d.events.abort();d.observer?.disconnect();if(d.frame)view.cancelAnimationFrame(d.frame);d.ghost?.remove();nodes.get(d.id).classList.remove('is-dragging');
  const changed=order.some((id,i)=>id!==d.before[i]);if(cancel||!editable())order=d.before;paint();
  if(!cancel&&editable()&&changed){commit();live.textContent='已移到第'+(order.indexOf(d.id)+1)+'個位置。';}
 }
 const cancelDrag=()=>finish(true);
 function hover(x,y){
  if(!drag?.ghost)return;const li=nodes.get(drag.id),other=doc.elementFromPoint(x,y)?.closest('.quiz-sequence-card');
  if(!other||other===li||other.parentElement!==list)return;
  const box=other.getBoundingClientRect(),rest=order.filter(id=>id!==drag.id),to=rest.indexOf(other.dataset.sequenceId)+(y>box.top+box.height/2?1:0);rest.splice(to,0,drag.id);
  if(rest.some((id,i)=>id!==order[i])){order=rest;paint();}
 }
 function begin(e,id){
  if(!view||!editable()||e.button!==0||drag)return;e.preventDefault();activeDrag?.();activeDrag=cancelDrag;
  const li=nodes.get(id),rect=li.getBoundingClientRect(),events=new view.AbortController();drag={id,before:[...order],pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,offsetY:e.clientY-rect.top,events,ghost:null};
  const {signal}=events;
  const autoScroll=()=>{
   if(!drag?.ghost)return;let scroller=root.parentElement;
   while(scroller&&!(scroller.scrollHeight>scroller.clientHeight+2&&/(auto|scroll)/.test(view.getComputedStyle(scroller).overflowY)))scroller=scroller.parentElement;
   scroller||=doc.scrollingElement;const box=scroller===doc.scrollingElement?{top:0,bottom:view.innerHeight}:scroller.getBoundingClientRect();let bottom=box.bottom;
   for(const dock of doc.querySelectorAll('.quiz-workspace-dock')){const r=dock.getBoundingClientRect();if(r.height&&r.top>box.top)bottom=Math.min(bottom,r.top);}
   const delta=drag.y<box.top+48?-12:drag.y>bottom-48?12:0;if(delta){scroller.scrollBy({top:delta,behavior:'instant'});hover(drag.x,drag.y);}drag.frame=view.requestAnimationFrame(autoScroll);
  };
  doc.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.pointer)return;event.preventDefault();drag.x=event.clientX;drag.y=event.clientY;
   if(!drag.ghost&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
   if(!drag.ghost){const ghost=li.cloneNode(true);ghost.classList.add('quiz-sequence-ghost');ghost.style.width=rect.width+'px';ghost.style.left=rect.left+'px';ghost.setAttribute('aria-hidden','true');ghost.querySelectorAll('button').forEach(b=>{b.tabIndex=-1;b.disabled=true;});doc.body.append(ghost);drag.ghost=ghost;li.classList.add('is-dragging');drag.frame=view.requestAnimationFrame(autoScroll);}
   drag.ghost.style.top=(event.clientY-drag.offsetY)+'px';hover(event.clientX,event.clientY);
  },{passive:false,signal});
  doc.addEventListener('pointerup',event=>{if(event.pointerId===drag?.pointer)finish();},{signal});
  doc.addEventListener('pointercancel',cancelDrag,{signal});view.addEventListener('blur',cancelDrag,{signal});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancelDrag();}},{signal});
  drag.observer=new view.MutationObserver(()=>{if(!root.isConnected||!editable())cancelDrag();});drag.observer.observe(doc.documentElement,{childList:true,subtree:true});drag.observer.observe(root,{attributes:true,subtree:true,attributeFilter:['disabled']});
 }
 if(locked&&!completeSequence(field,value))return {getValue:()=>value,destroy:cancelDrag};
 for(const option of field.options){
  const li=make(doc,'li',undefined,'quiz-sequence-card');li.dataset.sequenceId=option.id;li.tabIndex=-1;const position=make(doc,'span','','quiz-sequence-position');position.setAttribute('aria-hidden','true');
  const body=make(doc,'div',undefined,'quiz-sequence-body');renderContent(body,option.content);li.append(position,body);
  if(target){const correct=target[order.indexOf(option.id)]===option.id;li.dataset.sequenceResult=correct?'correct':'misplaced';const note=make(doc,'span',correct?'✓ 位置正確':'↔ 參考位置：第'+(target.indexOf(option.id)+1)+'個','quiz-sequence-result');body.append(note);}
  if(!locked){
   const handle=make(doc,'button','⠿','quiz-sequence-handle');handle.type='button';handle.setAttribute('aria-label','拖曳調整「'+(option.content.text||'圖片選項')+'」的順序');handle.title='拖曳調整順序';handle.addEventListener('pointerdown',e=>begin(e,option.id));handle.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const to=e.key==='Home'?0:e.key==='End'?order.length-1:order.indexOf(option.id)+(e.key==='ArrowUp'?-1:1);move(option.id,to,e.key==='ArrowUp'?'up':'down');}});
   const actions=make(doc,'div',undefined,'quiz-sequence-actions');for(const [kind,label,step]of [['up','↑ 上移',-1],['down','↓ 下移',1]]){const b=make(doc,'button',label);b.type='button';b.dataset.sequenceMove=kind;b.setAttribute('aria-label','將「'+(option.content.text||'圖片選項')+'」'+(step<0?'上移':'下移'));b.addEventListener('click',()=>move(option.id,order.indexOf(option.id)+step,kind));actions.append(b);}li.append(handle,actions);
  }else li.classList.add('is-readonly');nodes.set(option.id,li);
 }
 paint();if(target&&accepted.length>1)root.append(make(doc,'p','以下以其中一種可接受順序對照；原作答與整組判分保持。','quiz-sequence-hint'));
 return {getValue:()=>[...order],destroy:cancelDrag};
}
