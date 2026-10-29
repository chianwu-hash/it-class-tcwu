// Open responses are preserved for self-checking; this module does not grade them.
export function renderManualResponse({host,value,locked,asset,resolveAsset}){
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const panel=node('div',undefined,'manual-response'),label=node('label','你的作答（可輸入文字或在下方畫圖）','field-label');
 const input=node('textarea');input.id='manual-answer';label.htmlFor=input.id;input.rows=4;input.maxLength=5000;input.value=value.text;input.disabled=locked;
 panel.append(label,input,node('p','送出後保留作答；如有官方參考，會提供自我核對。這題不自動判分。','helper'));
 const details=node('details'),summary=node('summary','開啟畫圖區');details.open=Boolean(value.strokes.length);details.append(summary);
 const tools=node('div',undefined,'drawing-tools'),undo=node('button','復原'),clear=node('button','清除畫圖');undo.type=clear.type='button';tools.append(undo,clear);details.append(tools);
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 1 1');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','drawing-board manual-board');svg.setAttribute('role','img');svg.setAttribute('aria-label','自由畫圖區，也可以在上方輸入文字作答');
 const image=document.createElementNS(NS,'image');image.setAttribute('width','1');image.setAttribute('height','1');image.setAttribute('preserveAspectRatio','none');svg.append(image);
 if(asset)resolveAsset(asset.url).then(url=>{if(!svg.isConnected)return;image.setAttribute('href',url);const probe=new Image();probe.onload=()=>{if(!svg.isConnected)return;const ratio=probe.naturalWidth/probe.naturalHeight;svg.style.aspectRatio=String(Math.min(ratio,1.5));image.setAttribute('height',String(ratio>1.5?1.5/ratio:1));};probe.src=url;}).catch(()=>panel.append(node('p','題圖尚未載入，請更新後再畫圖。','helper')));
 const lines=document.createElementNS(NS,'g');svg.append(lines);let drawing=null,pointer=null;
 const confirmLabel=node('label',undefined,'confirm'),confirm=node('input');confirm.type='checkbox';confirm.checked=value.confirmed;confirm.disabled=locked;confirmLabel.append(confirm,node('span','我已完成這題，並檢查自己的作答。'));
 function changed(){value.confirmed=false;confirm.checked=false;}
 function paint(){lines.replaceChildren();for(const stroke of value.strokes){const path=document.createElementNS(NS,'polyline');path.setAttribute('points',stroke.map(p=>p.join(',')).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','var(--quiz-primary, #155e75)');path.setAttribute('stroke-width','.006');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');lines.append(path);}undo.disabled=clear.disabled=locked||!value.strokes.length;}
 input.addEventListener('input',()=>{value.text=input.value;changed();});confirm.addEventListener('change',()=>value.confirmed=confirm.checked);
 undo.addEventListener('click',()=>{value.strokes.pop();changed();paint();});clear.addEventListener('click',()=>{value.strokes.splice(0);changed();paint();});
 const position=e=>{const r=svg.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))].map(n=>Math.round(n*10000)/10000);};
 svg.addEventListener('pointerdown',e=>{if(locked||pointer!==null||value.strokes.length>=80)return;e.preventDefault();pointer=e.pointerId;svg.setPointerCapture(pointer);drawing=[position(e),position(e)];value.strokes.push(drawing);changed();paint();});
 svg.addEventListener('pointermove',e=>{if(pointer!==e.pointerId||!drawing||drawing.length>=256)return;e.preventDefault();drawing.push(position(e));paint();});
 const end=e=>{if(pointer!==e.pointerId)return;drawing=null;pointer=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};
 svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',()=>{drawing=null;pointer=null;});
 details.append(svg,node('p','可用滑鼠、觸控筆或手指畫圖；最多80筆，每筆最多256個點。','helper'));panel.append(details,confirmLabel);host.append(panel);paint();
}
