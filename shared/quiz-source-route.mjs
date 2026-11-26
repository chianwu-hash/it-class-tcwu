const SVG = 'http://www.w3.org/2000/svg';
let maskSequence=0;
const specs = {
  hlg3m_01fcc7e1_source_route_v1: {
    sha:'8c4ebf1dea86f6aa56a78dd7e344b1cc09570d322a43786cb1dbde8f93022d04',
    pixels:[2066,2400], width:603, height:700,
    xs:[69,288,508], ys:[78,258,440,622],
    matrix:[[null,3,5],[2,0,8],[1,6,3],[0,4,null]],
    start:{id:'start',label:'許奶奶出發處',point:[145,78],adjacent:'a2'},
    end:{id:'end',label:'商店',point:[412,622],adjacent:'d2'},
  },
  hlg3m_05df3fc9_source_route_v1: {
    sha:'c6603d179835ae0a23d3038797fbc706f43ceeff65abb37653bd467ee125c47e',
    pixels:[2378,2400], width:694, height:700,
    xs:[55,199,343,486,629], ys:[104,243,373,508,635],
    matrix:[[8,18,45,38,30],[38,28,85,55,50],[48,58,68,65,90],
      [20,45,null,null,null],[32,49,79,89,null]],
    start:{id:'c3',label:'68，小紅帽目前的位置'},
    end:{id:'end',label:'出口',point:[55,51],adjacent:'a1'},
  },
};

export const isSourceRoute = q => /_source_route_v\d+$/u.test(q?.id??'');

function buildGraph(spec) {
  const nodes=new Map(), links=new Map();
  const put=node=>{nodes.set(node.id,node);links.set(node.id,new Set());};
  const join=(a,b)=>{if(nodes.has(a)&&nodes.has(b)){links.get(a).add(b);links.get(b).add(a);}};
  const idAt=(row,col)=>String.fromCharCode(97+row)+(col+1);
  for(const [row,values] of spec.matrix.entries())for(const [col,value] of values.entries()){
    if(value===null)continue;
    const id=idAt(row,col);
    put({id,value,row,col,label:id===spec.start.id?spec.start.label:String(value),point:[spec.xs[col],spec.ys[row]]});
    join(id,idAt(row-1,col));join(id,idAt(row,col-1));
  }
  for(const endpoint of [spec.start,spec.end]){
    if(!endpoint.point)continue;
    put(endpoint);join(endpoint.id,endpoint.adjacent);
  }
  return {nodes,links};
}

export function sourceRoutePlan(q){
  const spec=Object.hasOwn(specs,q?.id)?specs[q.id]:null;
  const image=q?.prompt?.media?.[0];
  if(!spec||q.type!=='fields'||q.work||q.fields?.length!==1||q.fields[0].id!=='route'||q.fields[0].input!=='text'||
    q.prompt?.layout||q.prompt?.media?.length!==1||image?.kind!=='image'||
    !image.url?.startsWith('https://quiz-media.invalid/')||!image.url.endsWith('/'+spec.sha))return null;
  return {image,width:spec.width,height:spec.height,pixels:spec.pixels,...buildGraph(spec),
    start:spec.start.id,end:spec.end.id,passage:{...q.prompt,media:[]}};
}

export function readSourceRoute(plan,value){
  if(typeof value!=='string'||value.length>250)return null;
  const steps=value.split('-');
  if(steps[0]!==plan.start||new Set(steps).size!==steps.length)return null;
  for(let i=1;i<steps.length;i++){
    if(steps[i-1]===plan.end||!plan.links.get(steps[i-1])?.has(steps[i]))return null;
  }
  return steps;
}

export function sourceRouteSummary(plan,steps){
  return steps?.length>1?steps.map(id=>plan.nodes.get(id).label).join(' → '):'尚未走出路線';
}

export function renderSourceRoute(host,plan,{value,locked,correct,onChange,renderContent}){
  const doc=host.ownerDocument;
  const group=doc.createElement('section');group.className='quiz-source-route';
  const instruction=doc.createElement('p');
  const art=doc.createElement('div');
  renderContent(art,{text:'',media:[plan.image]});
  const image=art.querySelector('img');
  if(!image)return false;
  const figure=image.closest('figure');if(figure)figure.style.margin='0';
  const board=doc.createElement('div');board.className='quiz-source-route-board';
  Object.assign(board.style,{aspectRatio:plan.width+'/'+plan.height});
  image.before(board);board.append(image);
  Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',maxHeight:'none',
    objectFit:'fill',margin:'0',padding:'0',border:'0',borderRadius:'0'});
  const element=(name,attrs)=>{
    const node=doc.createElementNS(SVG,name);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
    return node;
  };
  const graph=element('svg',{viewBox:'0 0 '+plan.width+' '+plan.height,role:'group','aria-label':'原卷路線'});
  const maskId='quiz-route-number-mask-'+(++maskSequence);
  const mask=element('mask',{id:maskId,maskUnits:'userSpaceOnUse',x:0,y:0,width:plan.width,height:plan.height});
  mask.append(element('rect',{width:plan.width,height:plan.height,fill:'#fff'}));
  for(const node of plan.nodes.values()){
    if(node.value!==undefined)mask.append(element('circle',{cx:node.point[0],cy:node.point[1],r:node.value<10?20:27,fill:'#000'}));
  }
  const defs=element('defs',{});defs.append(mask);
  const ink=element('polyline',{fill:'none',mask:'url(#'+maskId+')','aria-hidden':'true','vector-effect':'non-scaling-stroke'});
  graph.append(defs,ink);board.append(graph);
  const undo=doc.createElement('button');undo.type='button';undo.textContent='退一步';
  const status=doc.createElement('p');status.className='quiz-source-route-status';status.setAttribute('aria-live','polite');
  const restored=readSourceRoute(plan,value);
  const steps=restored??[plan.start];
  const current=()=>steps.at(-1);
  let focusAt=current(),ready=false,failed=false;
  const accessibleName=node=>node.row===undefined?node.label:
    '第 '+(node.row+1)+' 排第 '+(node.col+1)+' 格，'+node.label;
  const controls=new Map();
  const refresh=(message='')=>{
    undo.disabled=locked||!ready||steps.length<=1;
    graph.style.visibility=ready?'visible':'hidden';
    ink.setAttribute('points',steps.map(id=>plan.nodes.get(id).point.join(',')).join(' '));
    for(const [id,button] of controls){
      const active=id===current();
      button.dataset.current=String(active);
      button.dataset.visited=String(steps.includes(id));
      if(!locked){
        button.setAttribute('tabindex',ready&&id===focusAt?'0':'-1');
        button.setAttribute('aria-pressed',String(steps.includes(id)));
      }
    }
    if(failed)instruction.textContent='原圖無法載入，請重新整理頁面。';
    else if(!ready)instruction.textContent='原圖載入中。';
    else instruction.textContent=locked?(restored?'你走過的路線已保留。':'無法還原這份路線。')
      :'依序點相鄰的圓點，走到終點。走錯可以退一步。';
    const prefix=locked&&correct===true?'路線答對了。':locked&&correct===false?'再核對每一步的數字規律。':'';
    status.textContent=message||(locked?prefix+sourceRouteSummary(plan,steps):
      (current()===plan.end?'已到終點，可以送出。':'目前位置：'+accessibleName(plan.nodes.get(current()))));
  };
  const update=()=>{refresh();onChange(steps.join('-'));};
  const choose=id=>{
    if(locked||!ready||id===current())return;
    if(id===steps.at(-2)){stepBack();return;}
    if(steps.includes(id)||current()===plan.end||!plan.links.get(current()).has(id)){
      refresh('請點目前位置旁邊相連的圓點，或退一步。');return;
    }
    steps.push(id);focusAt=id;update();
  };
  const stepBack=()=>{
    if(locked||!ready||steps.length<=1)return;
    steps.pop();focusAt=current();update();
    controls.get(focusAt)?.focus();
  };
  for(const [id,node] of plan.nodes){
    const active=locked?steps.includes(id):true;
    if(!active)continue;
    const radius=plan.width<650?44:id===plan.end?22:id==='a1'?31:48;
    const control=element('circle',{cx:node.point[0],cy:node.point[1],r:radius,
      role:locked?'img':'button','aria-label':accessibleName(node),'data-route-node':id});
    if(!locked){
      control.setAttribute('aria-keyshortcuts','Enter Space Backspace');
      control.addEventListener('focus',()=>{
        focusAt=id;
        for(const [key,target] of controls)target.setAttribute('tabindex',key===id?'0':'-1');
      });
      control.addEventListener('click',()=>choose(id));
      control.addEventListener('keydown',event=>{
        if(event.key==='Backspace'){event.preventDefault();if(!event.repeat)stepBack();return;}
        if(event.key===' '||event.key==='Enter'){
          event.preventDefault();if(!event.repeat)choose(id);return;
        }
        const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
        if(!direction)return;
        const [dx,dy]=direction;
        const next=[...plan.links.get(id)].find(other=>{
          const [x,y]=plan.nodes.get(other).point;
          return dx?Math.sign(x-node.point[0])===dx:Math.sign(y-node.point[1])===dy;
        });
        if(next){event.preventDefault();controls.get(next).focus();}
      });
    }
    controls.set(id,control);graph.append(control);
  }
  undo.addEventListener('click',stepBack);
  const markReady=event=>{
    ready=image.complete&&image.naturalWidth===plan.pixels[0]&&image.naturalHeight===plan.pixels[1];
    failed=!ready&&(event?.type==='error'||image.currentSrc&&image.complete);
    refresh();
  };
  image.addEventListener('load',markReady);image.addEventListener('error',markReady);
  group.append(instruction,art,status);if(!locked)group.append(undo);host.append(group);
  markReady();
  return true;
}
