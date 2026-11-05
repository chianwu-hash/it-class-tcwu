import {validateSketch} from './media-contract.mjs';
const NS='http://www.w3.org/2000/svg';
export function sketchImage(value){
 validateSketch(value);const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 600 360');svg.setAttribute('role','img');svg.setAttribute('aria-label','夥伴畫下的提示');
 for(const stroke of value.strokes){const p=document.createElementNS(NS,'polyline');p.setAttribute('points',stroke.map(([x,y])=>`${x*600},${y*360}`).join(' '));p.setAttribute('fill','none');p.setAttribute('stroke','#185e60');p.setAttribute('stroke-width','4');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.append(p);}return svg;
}
export function createSketchEditor(host,{value={version:1,strokes:[]},onChange=()=>{}}={}){
 value=structuredClone(value);let pointer=null,current=null,path=null;const tools=document.createElement('div'),undo=document.createElement('button'),clear=document.createElement('button'),hint=document.createElement('p');undo.type=clear.type='button';undo.textContent='復原一筆';clear.textContent='清除畫圖';tools.className='actions';tools.append(undo,clear);hint.className='muted';hint.textContent='可以畫算式、箭頭或圖示。畫板外可以正常滑動。';
 const svg=document.createElementNS(NS,'svg');svg.classList.add('camp-sketch-board');svg.setAttribute('viewBox','0 0 600 360');svg.setAttribute('role','img');svg.setAttribute('aria-label','畫下提示，可用滑鼠、手指或觸控筆');host.append(tools,svg,hint);
 function paint(){svg.replaceChildren();if(value.strokes.length)svg.append(...sketchImage(value).childNodes);undo.disabled=clear.disabled=!value.strokes.length;}
 function changed(){onChange(structuredClone(value));undo.disabled=clear.disabled=!value.strokes.length;if(value.strokes.length>=70)hint.textContent='紙快畫滿囉，可以先送出，再畫下一張。';}
 const position=e=>{const r=svg.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))].map(n=>Math.round(n*10000)/10000);};
 function nextStroke(point){if(value.strokes.length>=80){hint.textContent='這張紙畫滿了，可以復原一筆，或先送出。';return false;}current=[point,point];value.strokes.push(current);path=document.createElementNS(NS,'polyline');for(const [k,v]of Object.entries({fill:'none',stroke:'#185e60','stroke-width':'4','stroke-linecap':'round','stroke-linejoin':'round'}))path.setAttribute(k,v);svg.append(path);return true;}
 const updatePath=()=>path?.setAttribute('points',current.map(([x,y])=>`${x*600},${y*360}`).join(' '));
 svg.onpointerdown=e=>{if(pointer!==null)return;e.preventDefault();if(!nextStroke(position(e)))return;pointer=e.pointerId;svg.setPointerCapture(pointer);updatePath();changed();};
 svg.onpointermove=e=>{if(pointer!==e.pointerId||!current)return;e.preventDefault();const point=position(e),last=current.at(-1);if(Math.hypot(point[0]-last[0],point[1]-last[1])<.004)return;if(current.length>=128&&!nextStroke(last))return;current.push(point);updatePath();};
 const end=e=>{if(pointer!==e.pointerId)return;if(svg.hasPointerCapture(pointer))svg.releasePointerCapture(pointer);pointer=null;current=null;path=null;changed();};svg.onpointerup=svg.onpointercancel=end;svg.onlostpointercapture=e=>{if(pointer===e.pointerId){pointer=null;current=null;path=null;changed();}};
 undo.onclick=()=>{value.strokes.pop();paint();changed();};clear.onclick=()=>{value.strokes=[];paint();changed();};paint();
 return {getValue:()=>structuredClone(value),destroy(){if(pointer!==null&&svg.hasPointerCapture(pointer))svg.releasePointerCapture(pointer);svg.onpointerdown=svg.onpointermove=svg.onpointerup=svg.onpointercancel=svg.onlostpointercapture=null;host.replaceChildren();}};
}
