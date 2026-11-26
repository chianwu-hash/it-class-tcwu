const SIZE = 7;
const COLORS = {square:'#185e60',outline:'#263238',filled:'#2459b3'};
const sources = {
  '019e656d': ['square','11da0ad5f2fedb057a923139fdb0ec90f4a3a06715bccab29319ef5db569f383'],
  '02249f86': ['square','c25fa3ced3035c585c16b169e98d43b4682c31f1eaf163ec2d0ccf2dbec64b38'],
  '03b1fb40': ['square','5f780f04d2825a8f17be7c81b650f76d2852b201f64dc5d780d37c6092728a77'],
  '046d8024': ['disc','86a82f46dee68fb5669bce6aec32660f5ab5a17b85fcad00c47c674b085d646a'],
};

export function arrangementPlan(question) {
  const match = /^hlg3m_([0-9a-f]{8})_arrangement_v1$/u.exec(question?.id ?? '');
  const source = match && sources[match[1]];
  if (!source || question.type!=='open' || question.fields?.length!==1 || question.fields[0].id!=='drawing' ||
      question.fields[0].input!=='sketch' || question.prompt?.media?.length!==1) return null;
  const [kind,sha] = source;
  const [image] = question.prompt.media;
  return image.kind==='image' && image.url?.endsWith('/'+sha) ? {kind} : null;
}

function tileStroke(index, kind) {
  const row=Math.floor(index/SIZE), col=index%SIZE;
  const point=(x,y)=>kind==='square'
    ? [(col+x)/SIZE,(row+y)/SIZE]
    : [(col+(row%2)/2+x)/(SIZE+.5),(row+y)/SIZE];
  if(kind==='square')return [[.12,.12],[.88,.12],[.88,.88],[.12,.88],[.12,.12]].map(([x,y])=>point(x,y));
  return Array.from({length:17},(_,i)=>{
    const angle=(i%16)*Math.PI/8;
    return point(.5+.37*Math.cos(angle),.5+.37*Math.sin(angle));
  });
}

export function arrangementSketch(tiles) {
  const entries=[...tiles].sort(([a],[b])=>a-b);
  return {version:1,strokes:entries.map(([index,kind])=>tileStroke(index,kind)),
    colors:entries.map(([,kind])=>COLORS[kind])};
}

export function readArrangement(sketch, plan) {
  if(sketch?.version!==1 || !Array.isArray(sketch.strokes) || !Array.isArray(sketch.colors) ||
      sketch.strokes.length!==sketch.colors.length || sketch.strokes.length>SIZE*SIZE)return null;
  const tiles=new Map();
  for(const [i,stroke] of sketch.strokes.entries()){
    const kind=Object.keys(COLORS).find(k=>COLORS[k]===sketch.colors[i]);
    if(!kind || (plan.kind==='square')!==(kind==='square') || !stroke?.[0])return null;
    const [x,y]=stroke[0];
    const row=Math.floor(y*SIZE);
    const col=Math.floor(kind==='square'?x*SIZE:x*(SIZE+.5)-(row%2)/2);
    if(!(col>=0&&col<SIZE&&row>=0&&row<SIZE))return null;
    const index=row*SIZE+col;
    const template=tileStroke(index,kind);
    if(tiles.has(index)||stroke.length!==template.length||
      !stroke.every((p,j)=>Array.isArray(p)&&p.length===2&&p.every((v,k)=>Number.isFinite(v)&&Math.abs(v-template[j][k])<1e-7)))return null;
    tiles.set(index,kind);
  }
  return tiles;
}

export function renderArrangement(host,plan,{value,locked,onChange}) {
  const doc=host.ownerDocument;
  const make=(tag,text)=>{const el=doc.createElement(tag);if(text)el.textContent=text;return el;};
  const label={square:'方塊',outline:'空心圓片',filled:'實心圓片'};
  const restored=readArrangement(value,plan);
  // An unrecognized historic payload must be available in the standard sketch viewer.
  if(value?.strokes?.length && !restored)return null;
  const tiles=restored??new Map(),history=[];
  let disabled=locked,focused=0,activeTool=plan.kind==='square'?'square':'outline';
  const instruction=make('p',locked?'擺好的圖形已保留。':plan.kind==='square'?'點一格放上方塊，再點一下拿走。':'選空心或實心圓片，再點一格放上。再點同樣的圓片可以拿走。');
  const status=make('p');status.setAttribute('aria-live','polite');
  const board=make('div');board.className='quiz-pattern-arrangement';board.setAttribute('role','group');board.setAttribute('aria-label','擺圖區');
  Object.assign(board.style,{display:'grid',gridTemplateColumns:`repeat(${SIZE},minmax(0,1fr))`,gap:'2px',width:'min(100%, 380px)'});
  if(plan.kind==='disc')Object.assign(board.style,{boxSizing:'border-box',paddingRight:'7%'});
  const undo=make('button','復原一步');undo.type='button';
  const tools=make('div');tools.setAttribute('role','group');tools.setAttribute('aria-label','選圓片');
  const toolButtons=plan.kind==='disc'&&!locked?['outline','filled'].map(kind=>{
    const button=make('button',(kind==='outline'?'○ ':'● ')+label[kind]);button.type='button';
    button.onclick=()=>{if(!disabled){activeTool=kind;refresh();}};
    tools.append(button);return {kind,button};
  }):[];
  const cells=Array.from({length:SIZE*SIZE},(_,index)=>{
    const cell=make(locked?'div':'button');
    if(!locked)cell.type='button';
    Object.assign(cell.style,{position:'relative',minWidth:'0',minHeight:'0',padding:'0',aspectRatio:'1',
      border:'1px solid #a9c5c0',background:'#f7fbfa',borderRadius:'0'});
    if(plan.kind==='disc'&&Math.floor(index/SIZE)%2)cell.style.transform='translateX(calc(50% + 1px))';
    const shape=make('span');shape.setAttribute('aria-hidden','true');
    Object.assign(shape.style,{position:'absolute',inset:'9%',pointerEvents:'none'});
    cell.append(shape);board.append(cell);
    if(!locked){
      cell.onclick=()=>{
        if(disabled)return;
        focused=index;
        const old=tiles.get(index);
        history.push([index,old]);
        if(old===activeTool)tiles.delete(index);
        else tiles.set(index,activeTool);
        changed();
      };
      cell.onkeydown=event=>{
        const row=Math.floor(index/SIZE),col=index%SIZE;
        const next=event.key==='ArrowLeft'&&col>0?index-1:
          event.key==='ArrowRight'&&col<SIZE-1?index+1:
          event.key==='ArrowUp'&&row>0?index-SIZE:
          event.key==='ArrowDown'&&row<SIZE-1?index+SIZE:null;
        if(next===null||disabled)return;
        event.preventDefault();focused=next;refresh();cells[next].cell.focus();
      };
    }
    return {cell,shape};
  });
  function refresh(){
    for(const [index,{cell,shape}] of cells.entries()){
      const kind=tiles.get(index);
      cell.setAttribute('aria-label',`第 ${Math.floor(index/SIZE)+1} 排、第 ${index%SIZE+1} 格：${label[kind]??'空格'}`);
      if(!locked){cell.disabled=disabled;cell.tabIndex=index===focused?0:-1;cell.setAttribute('aria-pressed',String(Boolean(kind)));}
      else cell.setAttribute('role','img');
      shape.hidden=!kind;
      shape.style.border=kind?'2px solid #276c83':'';
      shape.style.background=kind&&kind!=='outline'?'#8ccfe4':'transparent';
      shape.style.borderRadius=kind==='square'?'0':'50%';
      cell.dataset.tile=kind??'';
    }
    for(const {kind,button} of toolButtons){button.disabled=disabled;button.setAttribute('aria-pressed',String(kind===activeTool));}
    undo.disabled=disabled||!history.length;
    status.textContent=tiles.size?`已擺 ${tiles.size} 個。`:'還沒有擺上圖形。';
  }
  function changed(){refresh();onChange(arrangementSketch(tiles));}
  undo.onclick=()=>{
    if(disabled||!history.length)return;
    const [index,old]=history.pop();
    if(old)tiles.set(index,old);else tiles.delete(index);
    changed();
  };
  host.append(instruction);
  if(toolButtons.length)host.append(tools);
  host.append(board,status);
  if(!locked)host.append(undo);
  refresh();
  return {setDisabled(next){disabled=locked||next;refresh();},destroy(){board.remove();}};
}
