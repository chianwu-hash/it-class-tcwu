import {drawingPaper,drawingLayer} from './render.mjs';
import {DRAWING_COLORS} from './contract.mjs';
const NS='http://www.w3.org/2000/svg';
export function createDrawingEditor(host,{value={version:2,strokes:[],marks:[]},onChange=()=>{},drawing={},renderContent,messages={}}={}){
 let state=value.version===2?structuredClone(value):{...structuredClone(value),version:2,marks:[]};
 const width=drawing.width??600,height=drawing.height??360,history=[],listeners=new AbortController();
 let disabled=false,tool='line',color='#2459b3',pending=[],pointer=null,ink=null,zoom=1,cursor=[.5,.5],selected='',gesture=null,focused=false;
 const round=n=>Math.round(n*1000000)/1000000,normalize=v=>Array.isArray(v)?v.map(normalize):typeof v==='number'?round(v):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,normalize(x)])):v;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;},button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
 host.classList.add('drawing-editor');const tools=node('div',undefined,'drawing-tools'),palette=node('div',undefined,'drawing-palette'),actions=node('div',undefined,'drawing-actions'),status=node('p','','drawing-status');tools.setAttribute('role','group');tools.setAttribute('aria-label','原圖作答工具');status.setAttribute('role','status');
 const choose=next=>{if(disabled)return;cancelAction();tool=next;measurement='';paint();},buttons=[];
 for(const [key,label]of [['pen','自由畫'],['line','直線'],['rect','長方形'],['circle','圓'],['sector','圓與扇形'],['polygon','多邊形'],['fill','塗色區塊'],['text','文字標記'],['erase','橡皮擦'],['measure','量長度'],['angle','量角度']]){if(drawing.tools&&!drawing.tools.includes(key))continue;const b=button(label,()=>choose(key));b.dataset.drawingTool=key;buttons.push(b);tools.append(b);}
 tool=drawing.tools?.[0]??tool;
 for(const c of DRAWING_COLORS){const b=button('',()=>{if(!disabled){color=c;paint();}});b.style.backgroundColor=c;b.dataset.drawingColor=c;b.setAttribute('aria-label','畫筆顏色 '+c);palette.append(b);}
 const colorLabel=node('label','自選顏色 '),picker=node('input');picker.type='color';picker.value=color;picker.oninput=()=>{if(!disabled){color=picker.value;paint();}};colorLabel.append(picker);palette.append(colorLabel);
 const textLabel=node('label','標記文字 '),text=node('input');text.type='text';text.maxLength=40;text.autocomplete='off';textLabel.append(text);text.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();svg.focus();}});textLabel.hidden=true;
 const geometry=node('div',undefined,'drawing-geometry');const numberInput=(label,value,min,max,step)=>{const l=node('label',label+' '),i=node('input');i.type='number';i.min=min;i.max=max;i.step=step;i.value=value;l.append(i);geometry.append(l);return i;};
 const radius=numberInput('半徑（'+(drawing.measure?.unit??'格')+'）',3,.01,100,.01),angle=numberInput('圓心角（度）',160,.001,360,.001),rotation=numberInput('起始方向（度）',0,0,360,1);geometry.append(node('span','填好半徑與角度，再點圓心。360°可畫完整圓。'));geometry.hidden=true;
 const finishButton=button('完成區塊',()=>finishPolygon()),cancel=button('取消這一步',()=>{cancelAction();paint();}),undo=button('復原一步',()=>{if(disabled||pointer!==null||!history.length)return;state=history.pop();pending=[];selected='';emit();}),clear=button('清除作答',()=>{if(disabled||pointer!==null||!count()||!window.confirm(messages.clearConfirm||'確定清除這份作答？清除後仍可復原一步。'))return;remember();state={version:2,strokes:[],marks:[]};pending=[];selected='';emit();});
 const items=node('select');items.setAttribute('aria-label','選擇已畫的標記');items.onchange=()=>{selected=items.value;paint();};const remove=button('刪除選取標記',()=>{if(disabled||pointer!==null||!selected)return;const [kind,index]=selected.split(':');remember();if(kind==='mark')state.marks.splice(Number(index),1);else{state.strokes.splice(Number(index),1);state.colors?.splice(Number(index),1);}selected='';emit();});
 const zoomOut=button('縮小',()=>setZoom(zoom/1.25)),zoomReset=button('原大小',()=>setZoom(1)),zoomIn=button('放大',()=>setZoom(zoom*1.25));actions.append(finishButton,cancel,undo,clear,items,remove,zoomOut,zoomReset,zoomIn);
 const viewport=node('div',undefined,'drawing-viewport'),paper=drawingPaper(state,{drawing,renderContent}),svg=paper.querySelector('.drawing-layer');viewport.append(paper);svg.tabIndex=0;svg.setAttribute('role','application');svg.setAttribute('aria-label','原圖作答區。方向鍵移動，Enter定位，Escape取消這一步。');
 const help=node('p','選工具後在原圖作答。多邊形或塗色依序點頂點，再按「完成區塊」。文字標記先輸入文字，再點位置。也可聚焦圖面，用方向鍵移動、Enter定位；按住Shift可移動較大距離。','drawing-help');host.append(tools,palette,textLabel,geometry,actions,viewport,status,help);
 function count(){return state.strokes.length+state.marks.length;}
 function remember(){history.push(structuredClone(state));if(history.length>30)history.shift();}
 function emit(){paint();onChange(structuredClone(state));}
 function mark(kind,points,fill=false){return {kind,points,color,width:.005,...(['polygon','ellipse'].includes(kind)?{fill}:{})};}
 function commit(m){if(disabled||count()>=80){status.textContent='最多80筆或標記，請復原或整理後再繼續。';return;}remember();state.marks.push(normalize(m));pending=[];emit();}
 function cancelAction(){const id=pointer;pointer=null;if(gesture){state=gesture;gesture=null;}ink=null;pending=[];if(id!==null&&svg.hasPointerCapture(id))svg.releasePointerCapture(id);}
 function finishPolygon(){if(disabled||!['polygon','fill'].includes(tool)||pending.length<3)return;commit(mark('polygon',pending.map(p=>[...p]),tool==='fill'));}
 function position(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const xy=p.matrixTransform(svg.getScreenCTM().inverse());return [Math.max(0,Math.min(1,xy.x/width)),Math.max(0,Math.min(1,xy.y/height))].map(n=>Math.round(n*1000000)/1000000);}
 function circle(a,b){const r=Math.min(Math.hypot((b[0]-a[0])*width,(b[1]-a[1])*height),a[0]*width,(1-a[0])*width,a[1]*height,(1-a[1])*height);return [[a[0]-r/width,a[1]-r/height],[a[0]+r/width,a[1]+r/height]];}
 function completed(a,b){if(tool==='line')return mark('line',[a,b]);if(tool==='rect')return mark('polygon',[a,[b[0],a[1]],b,[a[0],b[1]]]);if(tool==='circle')return mark('ellipse',circle(a,b));return null;}
 function place(p){
  if(disabled)return;
  cursor=p;
  if(tool==='sector'){const r=Number(radius.value)*(drawing.measure?.pixelsPerUnit??drawing.grid?.step??40),a=Number(angle.value),rot=Number(rotation.value);if(!radius.checkValidity()||!angle.checkValidity()||!rotation.checkValidity()||!Number.isFinite(r)||r<=0){status.textContent='請輸入有效的半徑、圓心角與起始方向。';return;}if(r>Math.min(p[0]*width,(1-p[0])*width,p[1]*height,(1-p[1])*height)){status.textContent='這個圓心距離邊界太近，請往圖面中央選圓心，或放大作答範圍。';return;}commit({kind:'sector',center:p,radius:r/width,angle:a,rotation:rot,color,width:.005,fill:false});return;}
  if(tool==='text'){if(!text.value.trim()){status.textContent='請先輸入標記文字。';text.focus();return;}commit({kind:'text',at:p,text:text.value.trim(),color,size:.04});return;}
  if(['polygon','fill','angle'].includes(tool)){if(pending.length>=128)return;if(!pending.length||Math.hypot(p[0]-pending.at(-1)[0],p[1]-pending.at(-1)[1])>.0001)pending.push(p);if(tool==='angle'&&pending.length===3){measure();pending=[];}paint();return;}
  if(['line','rect','circle','measure'].includes(tool)){pending.push(p);if(pending.length===2){if(tool==='measure'){measure();pending=[];paint();}else commit(completed(...pending));}else paint();}
 }
 let measurement='';
 function measure(){
  if(tool==='measure'){const [a,b]=pending,scale=drawing.measure?.pixelsPerUnit;if(!scale){measurement='此原圖尚未校定長度單位，不能把螢幕尺寸當作原題公分。';return;}const n=Math.hypot((b[0]-a[0])*width,(b[1]-a[1])*height)/scale;measurement='圖上長度：'+Number(n.toFixed(2))+' '+drawing.measure.unit;}
  else{const [a,o,b]=pending,u=[(a[0]-o[0])*width,(a[1]-o[1])*height],v=[(b[0]-o[0])*width,(b[1]-o[1])*height],den=Math.hypot(...u)*Math.hypot(...v);measurement=den?'夾角：'+Number((Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/den)))*180/Math.PI).toFixed(1))+'°':'請選三個不同的點。';}
 }
 function setZoom(next){zoom=Math.max(.5,Math.min(4,next));const base=Math.max(100,Math.min(viewport.clientWidth-22,window.innerHeight*.65*width/height));paper.style.width=base*zoom+'px';zoomReset.textContent=Math.round(zoom*100)+'%';}
 function paint(){
  const layer=drawingLayer(state,{width,height});svg.querySelectorAll(':scope > :not(.drawing-grid)').forEach(n=>n.remove());svg.append(...layer.childNodes);
  if(pending.length){if(pending.length===2&&['rect','circle'].includes(tool)){const preview=drawingLayer({strokes:[],marks:[completed(...pending)]},{width,height});preview.firstChild.setAttribute('stroke-dasharray','6 4');preview.firstChild.setAttribute('pointer-events','none');svg.append(...preview.childNodes);}else{const p=document.createElementNS(NS,'polyline');p.setAttribute('points',pending.map(([x,y])=>[x*width,y*height].join(',')).join(' '));p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width','2');p.setAttribute('stroke-dasharray','6 4');p.setAttribute('pointer-events','none');svg.append(p);}}
  if(focused){const cross=document.createElementNS(NS,'path');cross.setAttribute('d',`M${cursor[0]*width-8},${cursor[1]*height}h16 M${cursor[0]*width},${cursor[1]*height-8}v16`);cross.setAttribute('stroke','#111');cross.setAttribute('stroke-width','1.5');cross.setAttribute('pointer-events','none');svg.append(cross);}
  buttons.forEach(b=>{b.disabled=disabled;b.setAttribute('aria-pressed',String(b.dataset.drawingTool===tool));});for(const b of palette.querySelectorAll('button')){b.disabled=disabled;b.setAttribute('aria-pressed',String(b.dataset.drawingColor===color));}picker.disabled=text.disabled=disabled;textLabel.hidden=tool!=='text';finishButton.hidden=!['polygon','fill'].includes(tool);finishButton.disabled=disabled||pending.length<3;cancel.disabled=disabled||!pending.length;undo.disabled=disabled||!history.length;clear.disabled=disabled||!count();remove.disabled=disabled||selected<0;svg.setAttribute('aria-disabled',String(disabled));
  const busy=disabled||pointer!==null;buttons.forEach(b=>b.disabled=busy);for(const b of palette.querySelectorAll('button'))b.disabled=busy;picker.disabled=text.disabled=busy;geometry.hidden=tool!=='sector';for(const i of geometry.querySelectorAll('input'))i.disabled=busy;undo.disabled=busy||!history.length;clear.disabled=busy||!count();remove.disabled=busy||!selected;
  items.replaceChildren();const option=(value,label)=>{const o=node('option',label);o.value=String(value);items.append(o);};option('','選擇標記');state.strokes.forEach((_,i)=>option('stroke:'+i,'筆畫 '+(i+1)));state.marks.forEach((m,i)=>option('mark:'+i,(i+1)+'・'+({line:'直線',polygon:m.fill?'塗色區塊':'多邊形',ellipse:'圓',sector:'圓與扇形',text:'文字 '+m.text}[m.kind])));items.value=selected;items.disabled=busy||!count();
  status.textContent=measurement||'已畫 '+count()+'／80筆與標記。';
 }
 svg.addEventListener('pointerdown',e=>{
  if(disabled||pointer!==null)return;e.preventDefault();svg.focus({preventScroll:true});const p=position(e);cursor=p;
  if(tool==='erase'){const target=e.target.closest('[data-drawing-mark],[data-drawing-stroke]');if(target){remember();if(target.hasAttribute('data-drawing-mark'))state.marks.splice(Number(target.dataset.drawingMark),1);else{const i=Number(target.dataset.drawingStroke);state.strokes.splice(i,1);state.colors?.splice(i,1);}selected='';emit();}return;}
  if(tool==='pen'){if(count()>=80)return;gesture=structuredClone(state);ink=[p,p];state.strokes.push(ink);state.colors??=state.strokes.slice(0,-1).map(()=>'#185e60');state.colors.push(color);pointer=e.pointerId;svg.setPointerCapture(pointer);paint();return;}
  if(['line','rect','circle'].includes(tool)){pointer=e.pointerId;svg.setPointerCapture(pointer);pending=[p];return;}
  place(p);
 },{signal:listeners.signal});
 svg.addEventListener('pointermove',e=>{if(disabled||pointer!==e.pointerId)return;const p=position(e);cursor=p;if(ink){if(ink.length<128)ink.push(p);paint();}else{pending=[pending[0],p];paint();}},{signal:listeners.signal});
 const end=e=>{if(pointer!==e.pointerId)return;if(e.type!=='pointerup'){cancelAction();paint();return;}const id=pointer;pointer=null;if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);if(ink){history.push(gesture);if(history.length>30)history.shift();gesture=null;ink=null;emit();}else if(pending.length===2)commit(completed(...pending));else{pending=[];paint();}};
 svg.addEventListener('pointerup',end,{signal:listeners.signal});svg.addEventListener('pointercancel',end,{signal:listeners.signal});svg.addEventListener('lostpointercapture',end,{signal:listeners.signal});
 svg.addEventListener('focus',()=>{focused=true;paint();},{signal:listeners.signal});svg.addEventListener('blur',()=>{focused=false;paint();},{signal:listeners.signal});
 svg.addEventListener('keydown',e=>{if(disabled)return;if(e.key==='Escape'){e.preventDefault();cancelAction();paint();return;}if(e.key==='Enter'){e.preventDefault();place([...cursor]);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey ? .05 : .01;cursor=[round(Math.max(0,Math.min(1,cursor[0]+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)))),round(Math.max(0,Math.min(1,cursor[1]+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0))))];paint();status.textContent='定位：橫向'+Math.round(cursor[0]*100)+'%，縱向'+Math.round(cursor[1]*100)+'%；按Enter定位。';},{signal:listeners.signal});
 let lastWidth=0;const resize=new ResizeObserver(()=>{if(viewport.clientWidth!==lastWidth){lastWidth=viewport.clientWidth;setZoom(zoom);}});resize.observe(viewport);window.addEventListener('resize',()=>setZoom(zoom),{signal:listeners.signal});setZoom(1);
 paint();return {getValue:()=>structuredClone(gesture??state),setDisabled(v){cancelAction();disabled=Boolean(v);paint();},destroy(){cancelAction();resize.disconnect();listeners.abort();host.replaceChildren();}};
}
