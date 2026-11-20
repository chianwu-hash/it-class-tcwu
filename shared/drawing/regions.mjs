import {drawingPaper} from './render.mjs';
// Region geometry is transcribed from the reviewed original artwork, never from an answer.
export function createRegionEditor(host,{value={version:2,strokes:[],marks:[]},drawing,regions,onChange=()=>{},renderContent}={}){
 let state=structuredClone(value),disabled=false;const buttons=[],history=[];
 const hint=document.createElement('p');hint.textContent='點選要塗色的區塊；再點一次可以取消。也可用Tab與空白鍵選取。';host.append(hint);
 const board=document.createElement('div');host.append(board);const undo=document.createElement('button');undo.type='button';undo.textContent='復原一步';undo.onclick=()=>{if(disabled||!history.length)return;state=history.pop();paint();onChange(structuredClone(state));};host.append(undo);host.classList.add('drawing-editor','region-editor');
 const match=(m,r)=>m.kind==='sector'&&m.rotation===r.rotation&&m.angle===r.angle&&JSON.stringify(m.center)===JSON.stringify(r.center);
 function paint(){board.replaceChildren();buttons.length=0;const paper=drawingPaper(state,{drawing,renderContent}),svg=paper.querySelector('svg');svg.setAttribute('role','group');svg.setAttribute('aria-label','原題分數板，共'+regions.length+'等分');
  regions.forEach((region,index)=>{const p=drawingPaper({version:2,strokes:[],marks:[region]},{drawing:{width:drawing.width,height:drawing.height}}).querySelector('svg').firstChild;p.removeAttribute('data-drawing-mark');p.setAttribute('fill','transparent');p.setAttribute('stroke','transparent');p.setAttribute('role','button');p.setAttribute('tabindex',disabled?'-1':'0');p.setAttribute('aria-label','第'+(index+1)+'區塊');p.setAttribute('aria-pressed',String(state.marks.some(m=>match(m,region))));p.style.cursor='pointer';const toggle=()=>{if(disabled)return;history.push(structuredClone(state));if(history.length>30)history.shift();const i=state.marks.findIndex(m=>match(m,region));if(i<0)state.marks.push({...region,fill:true});else state.marks.splice(i,1);paint();buttons[index].focus({preventScroll:true});onChange(structuredClone(state));};p.onclick=toggle;p.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();toggle();}};svg.append(p);buttons.push(p);});board.append(paper);undo.disabled=disabled||!history.length;
 }
 paint();return{getValue:()=>structuredClone(state),setDisabled(v){disabled=!!v;paint();},destroy(){host.replaceChildren();}};
}
