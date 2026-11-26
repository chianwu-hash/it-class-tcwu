import {sketchImage} from './sketch/editor.mjs';
import {readSticks,renderSticks} from './quiz-matchstick-arrangement.mjs';

const SIZE = 7;
const COLORS = {square:'#185e60',outline:'#263238',filled:'#2459b3'};
const sources = {
  '019e656d': ['square','11da0ad5f2fedb057a923139fdb0ec90f4a3a06715bccab29319ef5db569f383'],
  '02249f86': ['square','c25fa3ced3035c585c16b169e98d43b4682c31f1eaf163ec2d0ccf2dbec64b38'],
  '03b1fb40': ['square','5f780f04d2825a8f17be7c81b650f76d2852b201f64dc5d780d37c6092728a77'],
  '001d5948': ['sticks','aee71747913f1d9c6f49a019fc551bc4d67f3080958d521bc63c1c9826a3cdee',{shared:true}],
  '0362f7a0': ['square','314e2ec34f04e996fce7ae1104822b1b734f9828cc6628f0f653b6bf8d00f284',{shared:true}],
  '018b0c9a': ['disc','66c389a9ed742c87407ec87deba13736949bb0215277b8cf7f22ca4543cd14bc',{shared:true,aligned:true,tools:['filled']}],
  '055c470d': ['disc','569b2b48618820bd6f034d2cd67245ab116fcffcd4b695ddc26e8b2e189413ac',{aligned:true,tools:['outline'],anchor:13,frame:{
    sha:'5b4a2e232fbf18cf4e2224402ac418f3b9011ce6a1613f13d06d293b9e0ff4c9',width:2400,height:1865,
    xs:[7,270,534,798,1061,1324.5,1588,1852,2115,2379],ys:[8,272,535,800,1063.5,1327,1591,1855],
  }}],
  '046d8024': ['disc','86a82f46dee68fb5669bce6aec32660f5ab5a17b85fcad00c47c674b085d646a'],
};

export function arrangementPlan(question) {
  const match = /^hlg3m_([0-9a-f]{8})_arrangement_v1$/u.exec(question?.id ?? '');
  const source = match && sources[match[1]];
  if (!source || question.type!=='open' || question.fields?.length!==1 || question.fields[0].id!=='drawing' ||
      question.fields[0].input!=='sketch') return null;
  const [kind,sha,options] = source,prompt=question.prompt, frame=options?.frame;
  const media=prompt?.media;
  if(media?.length!==(frame?2:1)||media.some(m=>m.kind!=='image'||(options&&!m.url?.startsWith('https://quiz-media.invalid/')))||
      !media[0].url?.endsWith('/'+sha)||(frame&&!media[1].url?.endsWith('/'+frame.sha)))return null;
  if(!options)return {kind};
  const {shared,...plan}=options;
  return {kind,...plan,...(frame?{frame:{...frame,image:media[1]}}:{}),
    passage:{...prompt,media:shared?[]:[media[0]]}};
}

function dimensions(plan) {
  return plan?.frame ? [plan.frame.ys.length-1,plan.frame.xs.length-1] : [SIZE,SIZE];
}

function tileStroke(index, kind, plan) {
  const [,cols]=dimensions(plan),row=Math.floor(index/cols),col=index%cols;
  const frame=plan?.frame, aligned=kind==='square'||plan?.aligned;
  const point=(x,y)=>frame?[
    (frame.xs[col]+x*(frame.xs[col+1]-frame.xs[col]))/frame.width,
    (frame.ys[row]+y*(frame.ys[row+1]-frame.ys[row]))/frame.height,
  ]:aligned?[(col+x)/SIZE,(row+y)/SIZE]:[(col+(row%2)/2+x)/(SIZE+.5),(row+y)/SIZE];
  if(kind==='square')return [[.12,.12],[.88,.12],[.88,.88],[.12,.88],[.12,.12]].map(([x,y])=>point(x,y));
  return Array.from({length:17},(_,i)=>{
    const angle=(i%16)*Math.PI/8;
    return point(.5+.37*Math.cos(angle),.5+.37*Math.sin(angle));
  });
}

export function arrangementSketch(tiles,plan) {
  const entries=[...tiles].sort(([a],[b])=>a-b);
  return {version:1,strokes:entries.map(([index,kind])=>tileStroke(index,kind,plan)),
    colors:entries.map(([,kind])=>COLORS[kind])};
}

export function readArrangement(sketch, plan) {
  if(plan.kind==='sticks')return readSticks(sketch);
  const [rows,cols]=dimensions(plan),frame=plan.frame;
  const locate=(values,v)=>values.findIndex((x,i)=>v>=x&&v<values[i+1]);
  if(sketch?.version!==1 || !Array.isArray(sketch.strokes) || !Array.isArray(sketch.colors) ||
      sketch.strokes.length!==sketch.colors.length || sketch.strokes.length>rows*cols)return null;
  const tiles=new Map();
  for(const [i,stroke] of sketch.strokes.entries()){
    const kind=Object.keys(COLORS).find(k=>COLORS[k]===sketch.colors[i]);
    if(!kind || (plan.kind==='square')!==(kind==='square') || (plan.tools&&!plan.tools.includes(kind)) || !stroke?.[0])return null;
    const [x,y]=stroke[0];
    const row=frame?locate(frame.ys,y*frame.height):Math.floor(y*SIZE);
    const col=frame?locate(frame.xs,x*frame.width):Math.floor(kind==='square'||plan.aligned?x*SIZE:x*(SIZE+.5)-(row%2)/2);
    if(!(col>=0&&col<cols&&row>=0&&row<rows))return null;
    const index=row*cols+col;
    const template=tileStroke(index,kind,plan);
    if(tiles.has(index)||stroke.length!==template.length||
      !stroke.every((p,j)=>Array.isArray(p)&&p.length===2&&p.every((v,k)=>Number.isFinite(v)&&Math.abs(v-template[j][k])<1e-7)))return null;
    tiles.set(index,kind);
  }
  return plan.anchor!==undefined && tiles.size && tiles.get(plan.anchor)!=='outline' ? null : tiles;
}

export function renderArrangement(host,plan,{value,locked,onChange,renderContent}) {
  if(plan.kind==='sticks')return renderSticks(host,{value,locked,onChange});
  const [rows,cols]=dimensions(plan), frame=plan.frame;
  const {anchor}=plan, fixed=anchor!==undefined;
  const available=plan.kind==='square'?['square']:plan.tools??['outline','filled'];
  const doc=host.ownerDocument;
  const make=(tag,text)=>{const el=doc.createElement(tag);if(text)el.textContent=text;return el;};
  const label={square:'方塊',outline:'空心圓片',filled:'實心圓片'};
  const restored=readArrangement(value,plan);
  // An unrecognized historic payload must be available in the standard sketch viewer.
  if(value?.strokes?.length && !restored)return null;
  const tiles=restored??new Map(),history=[];
  if(fixed)tiles.set(anchor,'outline');
  let disabled=locked,focused=0,activeTool=available[0],ready=!frame,failed=false;
  const instruction=make('p',locked?'擺好的圖形已保留。':plan.kind==='square'?'點一格放上方塊，再點一下拿走。':available.length===1?'點格子放圓片，再點一下拿走。':'選空心或實心圓片，再點一格放上。再點同樣的圓片可以拿走。');
  const status=make('p');status.setAttribute('aria-live','polite');
  const board=make('div');board.className='quiz-pattern-arrangement';board.setAttribute('role','group');board.setAttribute('aria-label','擺圖區');
  Object.assign(board.style,{display:'grid',gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:'2px',width:'min(100%, 380px)'});
  if(plan.kind==='disc'&&!plan.aligned)Object.assign(board.style,{boxSizing:'border-box',paddingRight:'7%'});
  let image,art;
  if(frame){
    Object.assign(board.style,{width:'min(100%, 530px)',position:'relative',display:'block',aspectRatio:frame.width+'/'+frame.height});
    art=make('div');
    renderContent(art,{text:'',media:[frame.image]});
    image=art.querySelector('img');
    if(!image)return null;
    Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',margin:'0',padding:'0',maxHeight:'none',objectFit:'fill',border:'0',borderRadius:'0'});
    image.before(board);
    board.append(image);
    const figure=board.closest('figure');
    if(figure)figure.style.margin='0';
  }
  const fallback=frame&&locked&&restored?.size?sketchImage(value):null;
  if(fallback){fallback.style.display='none';fallback.classList.add('quiz-open-sketch-saved');}
  const undo=make('button','復原一步');undo.type='button';
  const tools=make('div');tools.setAttribute('role','group');tools.setAttribute('aria-label','選圓片');
  const toolButtons=available.length>1&&!locked?available.map(kind=>{
    const button=make('button',(kind==='outline'?'○ ':'● ')+label[kind]);button.type='button';
    button.onclick=()=>{if(!disabled){activeTool=kind;refresh();}};
    tools.append(button);return {kind,button};
  }):[];
  const cells=Array.from({length:rows*cols},(_,index)=>{
    const cell=make(locked?'div':'button');
    if(!locked)cell.type='button';
    Object.assign(cell.style,{position:'relative',minWidth:'0',minHeight:'0',padding:'0',aspectRatio:'1',
      border:'1px solid #a9c5c0',background:'#f7fbfa',borderRadius:'0'});
    if(plan.kind==='disc'&&!plan.aligned&&Math.floor(index/cols)%2)cell.style.transform='translateX(calc(50% + 1px))';
    if(frame){
      const row=Math.floor(index/cols),col=index%cols;
      Object.assign(cell.style,{position:'absolute',left:frame.xs[col]/frame.width*100+'%',top:frame.ys[row]/frame.height*100+'%',
        width:(frame.xs[col+1]-frame.xs[col])/frame.width*100+'%',height:(frame.ys[row+1]-frame.ys[row])/frame.height*100+'%',
        background:'transparent',border:'none',aspectRatio:'auto'});
    }
    const shape=make('span');shape.setAttribute('aria-hidden','true');
    Object.assign(shape.style,{position:'absolute',inset:'9%',pointerEvents:'none'});
    cell.append(shape);board.append(cell);
    if(!locked){
      cell.onclick=()=>{
        if(disabled||!ready||index===plan.anchor)return;
        focused=index;
        const old=tiles.get(index);
        history.push([index,old]);
        if(old===activeTool)tiles.delete(index);
        else tiles.set(index,activeTool);
        changed();
      };
      cell.onkeydown=event=>{
        const row=Math.floor(index/cols),col=index%cols;
        const next=event.key==='ArrowLeft'&&col>0?index-1:
          event.key==='ArrowRight'&&col<cols-1?index+1:
          event.key==='ArrowUp'&&row>0?index-cols:
          event.key==='ArrowDown'&&row<rows-1?index+cols:null;
        if(next===null||disabled||!ready)return;
        event.preventDefault();focused=next;refresh();cells[next].cell.focus();
      };
    }
    return {cell,shape};
  });
  function refresh(){
    for(const [index,{cell,shape}] of cells.entries()){
      const kind=tiles.get(index);
      const original=index===plan.anchor;
      cell.setAttribute('aria-label',`第 ${Math.floor(index/cols)+1} 排、第 ${index%cols+1} 格：${original?'原卷已標示圓片':label[kind]??'空格'}`);
      if(!locked){cell.disabled=disabled||!ready;cell.tabIndex=index===focused?0:-1;cell.setAttribute('aria-pressed',String(Boolean(kind)));
        if(original)cell.setAttribute('aria-disabled','true');}
      else cell.setAttribute('role','img');
      shape.hidden=!kind||original;
      if(frame)cell.style.visibility=ready?'visible':'hidden';
      shape.style.border=kind?'2px solid #276c83':'';
      shape.style.background=kind&&kind!=='outline'?'#8ccfe4':'transparent';
      shape.style.borderRadius=kind==='square'?'0':'50%';
      cell.dataset.tile=kind??'';
    }
    for(const {kind,button} of toolButtons){button.disabled=disabled;button.setAttribute('aria-pressed',String(kind===activeTool));}
    undo.disabled=disabled||!history.length;
    const placed=tiles.size-Number(fixed);
    status.textContent=failed?'方格圖無法載入，請重新整理頁面。':!ready?'方格圖載入中。':placed?`已擺 ${placed} 個。`:'還沒有擺上圖形。';
  }
  function changed(){refresh();onChange(arrangementSketch(fixed&&tiles.size===1?new Map():tiles,plan));}
  undo.onclick=()=>{
    if(disabled||!history.length)return;
    const [index,old]=history.pop();
    if(old)tiles.set(index,old);else tiles.delete(index);
    changed();
  };
  host.append(instruction);
  if(toolButtons.length)host.append(tools);
  host.append(art??board,status);
  if(fallback)host.append(fallback);
  if(!locked)host.append(undo);
  if(image){
    const markReady=event=>{
      ready=image.complete&&image.naturalWidth===frame.width&&image.naturalHeight===frame.height;
      failed=!ready&&(event?.type==='error'||Boolean(image.currentSrc)&&image.complete);
      if(fallback)fallback.style.display=failed?'block':'none';
      refresh();
    };
    image.addEventListener('load',markReady);image.addEventListener('error',markReady);markReady();
  }else refresh();
  return {setDisabled(next){disabled=locked||next;refresh();},destroy(){instruction.remove();tools.remove();(art??board).remove();status.remove();undo.remove();fallback?.remove();}};
}
