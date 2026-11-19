import {matchingValues,matchingConnect,matchingRemove,matchingReference,matchingPatch} from './quiz-matching-model.mjs';
import {applySourceCrop} from './quiz-source-crop.mjs';
const palette=['#147c80','#966200','#7351b5','#2e6bb5','#a14476','#547b25'];
const controllers=new Set();let watcher=null;
export function renderMatchingBoard(host,board,{values={},locked=false,onChange=()=>{},renderContent,accepted=null,referenceOnly=false}={}){
 const doc=host.ownerDocument,view=doc.defaultView;
 const sweep=()=>{for(const c of controllers){if(c.root.isConnected)c.seen=true;else if(c.seen)c.destroy();}if(!controllers.size){watcher?.disconnect();watcher=null;}};
 sweep();
 const make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const svgEl=(name,attrs)=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 let current=referenceOnly&&accepted?Object.fromEntries(board.left.map(l=>[l.id,accepted[l.id]?.[0]])):{...values},pending=null,selected=null,drag=null,ghost=null,showSolution=false,lastDrag=0,frame=0,destroyed=false;
 const root=make('section','quiz-matching'),toolbar=make('div','qm-toolbar'),count=make('strong','qm-count'),remove=make('button','qm-small','取消選取的連線'),clear=make('button','qm-small','全部重連'),solution=make('button','qm-small','看正確連線'),live=make('p','qm-guide');
 root.setAttribute('aria-label',board.label||'連連看');root.classList.toggle('qm-equal-scale',board.equalScale===true);if(board.material){const material=make('div','qm-material');renderContent(material,board.material);enableMatchingImageZoom(material);root.append(material);}live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.textContent=locked?'點卡片或連線，查看已保存的配對。':'點左邊，再點右邊即可連線；滑鼠或觸控筆也可以拖曳。'+(board.left.some(l=>l.multiple)?'每項可以連多條線；再點同一組即可取消。':board.unique?'每項只能配對一次。':'同一個右邊項目可以連到不同項目。');
 [remove,clear,solution].forEach(n=>n.type='button');remove.hidden=clear.hidden=locked;toolbar.append(count,remove,clear);if(accepted)toolbar.append(solution);root.append(toolbar,live);
 const stage=make('div','qm-stage'),svg=svgEl('svg',{'aria-hidden':'true',class:'qm-lines'}),cols=make('div','qm-columns'),left=make('div','qm-column'),right=make('div','qm-column');cols.append(left,right);stage.append(svg,cols);root.append(stage);host.append(root);
 const buttons={left:new Map(),right:new Map()},itemFor=id=>board.left.find(x=>x.id===id),rightFor=id=>board.right.find(x=>x.id===id),text=c=>c?.text||'圖片',links=id=>matchingValues(itemFor(id),current[id]);
 const linkedLeft=id=>board.left.filter(l=>links(l.id).includes(id)).map(l=>l.id),reference=id=>accepted?matchingReference(itemFor(id),current[id],accepted[id]):null;
 const rightText=id=>String.fromCharCode(65+board.right.findIndex(r=>r.id===id))+' '+text(rightFor(id)?.content);
 const editable=()=>!locked&&!destroyed&&root.isConnected&&!buttons.left.values().next().value?.disabled;
 function anchor(side,id){const a=buttons[side].get(id).querySelector('.qm-pin').getBoundingClientRect(),b=stage.getBoundingClientRect();return{x:a.x+a.width/2-b.x,y:a.y+a.height/2-b.y};}
 const curve=(a,b)=>{const d=(b.x-a.x)*.48;return `M${a.x},${a.y} C${a.x+d},${a.y} ${b.x-d},${b.y} ${b.x},${b.y}`;};
 function draw(){
  frame=0;if(destroyed||!stage.isConnected)return;svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${stage.clientWidth} ${stage.clientHeight}`);
  for(const item of board.left)for(const id of links(item.id)){
   if(!buttons.right.has(id))continue;const active=selected?.left===item.id&&(!selected.right||selected.right===id),ref=reference(item.id),color=ref?(ref.wrong.includes(id)?'#ad3737':'#187442'):palette[board.left.indexOf(item)%palette.length],d=curve(anchor('left',item.id),anchor('right',id));
   svg.append(svgEl('path',{d,stroke:'#fff','stroke-width':active?11:8,fill:'none'}),svgEl('path',{d,stroke:color,'stroke-width':active?6:3.5,fill:'none','stroke-linecap':'round'}));
   const hit=svgEl('path',{d,stroke:'transparent','stroke-width':18,fill:'none',class:'qm-hit'});hit.addEventListener('click',()=>{selected={left:item.id,right:id};pending=null;sync('已選取連線；可按取消連線。');});svg.append(hit);
  }
  if(showSolution)for(const item of board.left)for(const id of reference(item.id)?.target||[])if(buttons.right.has(id))svg.append(svgEl('path',{d:curve(anchor('left',item.id),anchor('right',id)),stroke:'#187442','stroke-width':3,fill:'none','stroke-dasharray':'7 5',class:'qm-solution'}));
  if(ghost)svg.append(svgEl('path',{d:curve(ghost.from,ghost.to),stroke:'#147c80','stroke-width':4,fill:'none','stroke-dasharray':'5 5'}));
 }
 const schedule=()=>{if(!frame&&!destroyed)frame=view.requestAnimationFrame(draw);};
 function sync(message){
  const n=board.left.filter(l=>links(l.id).length).length;count.textContent=`已配對 ${n}／${board.left.length} 項`;remove.disabled=!editable()||!selected||!links(selected.left).length;clear.disabled=!editable()||!n;solution.textContent=showSolution?'隱藏正確連線':'看正確連線';solution.setAttribute('aria-pressed',String(showSolution));
  for(const [side,map]of Object.entries(buttons))for(const [id,b]of map){
   const ids=side==='left'?(links(id).length?[id]:[]):linkedLeft(id),isPending=pending?.side===side&&pending.id===id,focus=ids.includes(selected?.left),index=board.left.findIndex(l=>l.id===(ids[0]||id));b.classList.toggle('is-pending',isPending);b.classList.toggle('is-connected',ids.length>0);b.classList.toggle('is-focused',focus);b.setAttribute('aria-pressed',String(isPending||focus));b.style.setProperty('--pair-color',palette[Math.max(0,index)%palette.length]);
   b.querySelector('.qm-pair').textContent=side==='right'?ids.map(f=>board.left.findIndex(l=>l.id===f)+1).join('、'):links(id).map(o=>String.fromCharCode(65+board.right.findIndex(r=>r.id===o))).join('、');
   const result=b.querySelector('.qm-result');result.replaceChildren();const ref=side==='left'?reference(id):null;
   if(ref){b.dataset.matchingResult=ref.correct?'correct':'incorrect';const line=make('span',null,ref.correct?'✓ 配對正確':'✕ 這項需要修正');result.append(line);for(const [label,arr]of [['選錯',ref.wrong],['漏連',ref.missing]])if(arr.length)result.append(make('span',null,label+'：'+arr.map(rightText).join('、')));if(!ref.correct)result.append(make('span',null,'正確配對：'+ref.target.map(rightText).join('、')));}
   if(side==='left'&&typeof current[id]==='string'&&current[id]&&!links(id).length)result.append(make('span',null,'原作答：'+current[id]+'（未能對應卡片，原內容仍保留）'));
  }
  if(referenceOnly){live.textContent='參考連線；這不是你的已保存作答。';for(const b of buttons.left.values())b.querySelector('.qm-result').textContent='參考配對';}else if(message)live.textContent=message;schedule();
 }
 function commit(next,message){if(!editable())return;current=next;onChange(matchingPatch(board,current));sync(message);}
 function connect(l,r){if(!editable())return;selected={left:l,right:r};pending=null;commit(matchingConnect(board,current,l,r),'已更新連線；完成所有項目後，沿用原本的送出按鈕一起送出。');}
 function choose(side,id){
  if(Date.now()-lastDrag<250)return;
  if(!editable()){selected={left:side==='left'?id:linkedLeft(id)[0],right:side==='right'?id:null};sync('已顯示這個項目的配對。');return;}
  if(pending&&pending.side!==side){connect(side==='left'?id:pending.id,side==='right'?id:pending.id);return;}
  if(pending?.side===side&&pending.id===id){pending=null;sync('已取消選取。');return;}
  pending={side,id};selected={left:side==='left'?id:linkedLeft(id)[0],right:side==='right'?id:null};sync(side==='left'?'請點右邊要配對的項目。':'請點左邊要配對的項目。');
 }
 function card(side,id,content,i){
  const b=make('button','qm-card');b.type='button';b.dataset.side=side;b.dataset.id=id;const badge=make('span','qm-badge',side==='left'?String(i+1):String.fromCharCode(65+i)),body=make('span','qm-text'),pin=make('span','qm-pin'),pair=make('span','qm-pair'),result=make('span','qm-result');pin.setAttribute('aria-hidden','true');pair.setAttribute('aria-hidden','true');renderContent(body,content);
  // The card itself is the control. Keep authenticated media rendering but avoid
  // nested links/buttons inside a native button; complete source stays nearby.
  body.querySelectorAll('a').forEach(a=>a.replaceWith(...a.childNodes));
  const images=[...body.querySelectorAll('img')];(content.media||[]).filter(m=>m.kind==='image').forEach((m,j)=>{if(m.viewBox&&images[j]){const wrap=make('span','qm-crop');images[j].before(wrap);wrap.append(images[j]);applySourceCrop(wrap,images[j],m.viewBox);}});
  b.append(badge,body,pair,result,pin);b.addEventListener('click',()=>choose(side,id));buttons[side].set(id,b);b.disabled=false;
  b.addEventListener('pointerdown',e=>{if(!editable()||e.pointerType==='touch'||e.button!==0)return;drag={side,id,x:e.clientX,y:e.clientY,active:false,pointer:e.pointerId};b.setPointerCapture(e.pointerId);});
  b.addEventListener('pointermove',e=>{if(!drag||drag.pointer!==e.pointerId||!b.hasPointerCapture(e.pointerId))return;if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;drag.active=true;const rect=stage.getBoundingClientRect(),point={x:e.clientX-rect.x,y:e.clientY-rect.y};ghost=side==='left'?{from:anchor(side,id),to:point}:{from:point,to:anchor(side,id)};schedule();});
  const finish=(e,cancel)=>{if(!drag||drag.pointer!==e.pointerId)return;const was=drag;drag=null;ghost=null;if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId);if(was.active){lastDrag=Date.now();const target=cancel?null:doc.elementFromPoint(e.clientX,e.clientY)?.closest('.qm-card');if(target&&stage.contains(target)&&target.dataset.side!==side)connect(side==='left'?id:target.dataset.id,side==='right'?id:target.dataset.id);else sync('未連到另一端，原連線保持不變。');}else schedule();};
  b.addEventListener('pointerup',e=>finish(e,false));b.addEventListener('pointercancel',e=>finish(e,true));b.addEventListener('lostpointercapture',e=>finish(e,true));return b;
 }
 board.left.forEach((l,i)=>left.append(card('left',l.id,l.content,i)));board.right.forEach((r,i)=>right.append(card('right',r.id,r.content,i)));if(board.left.length<=2)left.classList.add('qm-sticky');if(board.right.length<=2||board.right.length===3&&board.left.length>3)right.classList.add('qm-sticky');if(board.original)appendMatchingOriginal(root,board.original,renderContent);
 remove.onclick=()=>{if(selected){const id=selected.right??links(selected.left)[0];pending=null;commit(matchingRemove(board,current,selected.left,id),'已取消這條連線。');}};
 root.addEventListener('keydown',e=>{if(e.key!=='Escape'||!pending)return;e.preventDefault();e.stopPropagation();pending=selected=null;ghost=null;sync('已取消選取，原連線保持不變。');});
 clear.onclick=()=>{const next={...current};for(const l of board.left)next[l.id]=l.multiple?[]:'';pending=selected=null;commit(next,'已清除這一組連線；其他作答保持不變。');};solution.onclick=()=>{showSolution=!showSolution;sync(showSolution?'綠色虛線是正確配對；你的原作答仍保留。':'已隱藏正確連線。');};
 const events=new view.AbortController();view.addEventListener('scroll',schedule,{capture:true,passive:true,signal:events.signal});const observer=new view.ResizeObserver(schedule);observer.observe(stage);stage.addEventListener('load',schedule,true);const controller={root,seen:root.isConnected,destroy(){destroyed=true;observer.disconnect();events.abort();if(frame)view.cancelAnimationFrame(frame);drag=ghost=null;controllers.delete(controller);}};controllers.add(controller);if(!watcher&&view.MutationObserver){watcher=new view.MutationObserver(sweep);watcher.observe(doc.body,{childList:true,subtree:true});}root.matchingController=controller;queueMicrotask(()=>{if(!destroyed)sync();});return root;
}
function enableMatchingImageZoom(host){host.querySelectorAll('img').forEach(img=>{img.dataset.imageLightbox='';img.dataset.partnerImage='';img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',(img.alt||'原卷圖')+'，點擊放大');});}
export function appendMatchingOriginal(host,content,renderContent){if(!content?.media?.length)return;const details=host.ownerDocument.createElement('details'),summary=host.ownerDocument.createElement('summary');details.className='qm-original';summary.textContent='查看原卷圖（點圖片可放大）';details.append(summary);renderContent(details,content);enableMatchingImageZoom(details);host.append(details);}
