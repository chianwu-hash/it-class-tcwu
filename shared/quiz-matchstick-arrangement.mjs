const SVG = 'http://www.w3.org/2000/svg';
const width = 336, height = 104, size = 48;
const points = Array.from({length:12},(_,i) => {
  const row = Math.floor(i/6), col = i%6;
  return [24+size*(col+row/2),row===0?24:24+size*Math.sqrt(3)/2];
});
const isNeighbor = (a,b) => Math.abs(Math.hypot(points[a][0]-points[b][0],points[a][1]-points[b][1])-size)<1e-7;
const edges = points.flatMap((_,a) => points.flatMap((_,b) => a<b && isNeighbor(a,b) ? [[a,b]] : []));
const pointValue = i => [points[i][0]/width,points[i][1]/height];
const matchPoint = point => Array.isArray(point) && point.length===2 ?
  points.findIndex((_,index)=>pointValue(index).every((v,k)=>Number.isFinite(point[k])&&Math.abs(point[k]-v)<1e-7)) : -1;
const key = (a,b) => Math.min(a,b)+':'+Math.max(a,b);
const edgeByKey = new Map(edges.map(edge=>[key(...edge),edge]));

export function stickSketch(selected) {
  return {version:1,strokes:edges.filter(edge=>selected.has(key(...edge))).map(edge=>edge.map(pointValue))};
}

export function readSticks(value) {
  if(value?.version!==1||Object.keys(value).length!==2||!Array.isArray(value.strokes)||value.strokes.length>edges.length)return null;
  const selected = new Set();
  for(const stroke of value.strokes){
    if(!Array.isArray(stroke)||stroke.length!==2)return null;
    const [a,b]=stroke.map(matchPoint), id=key(a,b);
    if(!edgeByKey.has(id)||selected.has(id))return null;
    selected.add(id);
  }
  return selected;
}

export function renderSticks(host,{value,locked,onChange}) {
  const doc=host.ownerDocument;
  const make=(tag,text)=>{const node=doc.createElement(tag);if(text)node.textContent=text;return node;};
  function svg(tag,attributes) {
    const node=doc.createElementNS(SVG,tag);
    for(const [name,value] of Object.entries(attributes))node.setAttribute(name,value);
    return node;
  }
  const restored=readSticks(value);
  if(value?.strokes?.length&&!restored)return null;
  const selected=restored??new Set(), history=[];
  const board=svg('svg',{viewBox:'0 0 '+width+' '+height,role:'group','aria-label':'火柴棒排列區'});
  board.classList.add('quiz-matchstick-board');
  const undo=make('button','復原一步');undo.type='button';
  const status=make('p');status.setAttribute('aria-live','polite');
  const instruction=make('p',locked?'排好的火柴棒已保留。':'先點兩個相鄰的圓點，就能放一枝火柴棒。再點同一對圓點可以拿走。');
  const ink=svg('g',{'aria-hidden':'true','pointer-events':'none'});
  board.append(ink);
  let focused=0, start=null, disabled=locked;
  const anchors=points.map(([cx,cy],i) => svg('circle',{
    cx,cy,r:locked?5:16,class:'quiz-matchstick-point',role:locked?'img':'button',
    'aria-label':'第 '+(Math.floor(i/6)+1)+' 排第 '+(i%6+1)+' 個圓點','data-point':i,
  }));
  const syncFocus=()=>{
    for(const [i,node] of anchors.entries())if(!locked)node.setAttribute('tabindex',!disabled&&i===focused?'0':'-1');
  };
  const refresh=(note='')=>{
    ink.replaceChildren();
    for(const id of selected){
      const [a,b]=edgeByKey.get(id),[x1,y1]=points[a],[x2,y2]=points[b];
      ink.append(svg('line',{x1,y1,x2,y2,'data-stick':id,class:'quiz-matchstick-stick'}));
    }
    syncFocus();
    for(const [i,node] of anchors.entries()){
      const connected=[...selected].filter(id=>edgeByKey.get(id).includes(i)).length;
      node.setAttribute('aria-label','第 '+(Math.floor(i/6)+1)+' 排第 '+(i%6+1)+' 個圓點，已連 '+connected+' 枝');
      if(locked){node.style.opacity=connected?'1':'0';continue;}
      node.setAttribute('aria-disabled',String(disabled));
      node.setAttribute('aria-pressed',String(start===i));
    }
    undo.disabled=disabled||history.length===0;
    status.textContent=note||'已排 '+selected.size+' 枝。';
  };
  const choose=i=>{
    if(disabled)return;
    focused=i;
    if(start===null){start=i;refresh('已選起點。');return;}
    if(start===i){start=null;refresh('已取消起點。');return;}
    if(!isNeighbor(start,i)){refresh('請點和起點相鄰的圓點。');return;}
    const id=key(start,i), previous=selected.has(id);
    history.push([id,previous]);
    if(previous)selected.delete(id);else selected.add(id);
    start=null;
    refresh();onChange(stickSketch(selected));
  };
  for(const [i,node] of anchors.entries()){
    board.append(node);
    if(locked)continue;
    node.addEventListener('click',()=>choose(i));
    node.addEventListener('focus',()=>{focused=i;syncFocus();});
    node.addEventListener('keydown',event=>{
      if(disabled)return;
      if(event.key===' '||event.key==='Enter'){
        event.preventDefault();if(!event.repeat)choose(i);return;
      }
      if(event.key==='Escape'){event.preventDefault();start=null;refresh('已取消起點。');return;}
      const row=Math.floor(i/6),col=i%6;
      const next=event.key==='ArrowLeft'&&col>0?i-1:event.key==='ArrowRight'&&col<5?i+1:
        event.key==='ArrowUp'&&row===1?i-6:event.key==='ArrowDown'&&row===0?i+6:null;
      if(next!==null){event.preventDefault();anchors[next].focus();}
    });
  }
  undo.addEventListener('click',()=>{
    if(disabled||!history.length)return;
    const [id,previous]=history.pop();
    if(previous)selected.add(id);else selected.delete(id);
    start=null;refresh();onChange(stickSketch(selected));
  });
  host.append(instruction,board,status);
  if(!locked)host.append(undo);
  refresh();
  return {setDisabled(value){disabled=locked||value;start=null;refresh();},destroy(){instruction.remove();board.remove();status.remove();undo.remove();}};
}
