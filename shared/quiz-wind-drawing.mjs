const SVG = 'http://www.w3.org/2000/svg';
const COMPASS = '04eb9a1a74bd0d125b4beb9eabec4757fe36f682e85fd51a64f8142af1be737e';
const TREE = '86a9c801fbb1191e61b9d5e71d83db4770b44e77aaca0d4a2edfca3f08e697d5';
const BOARDS = {
  [COMPASS]: {width:253,height:216,points:[
    ['北',121,41],['東北',168,61],['東',189,109],['東南',168,155],
    ['南',121,176],['西南',74,155],['西',53,109],['西北',74,61],['中央',121,109],
  ]},
  [TREE]: {width:713,height:474,points:[
    ['甲側',36,195],['樹木靠甲的一側',190,195],['樹木靠乙的一側',525,195],['乙側',675,195],
  ]},
};

export function windDrawingPlan(question) {
  const {id,type,prompt,fields} = question ?? {};
  if (type !== 'open' || !/^hlg3n_[a-f0-9]{8}_wind_[1-3]_v[a-f0-9]{12}$/u.test(id) ||
      !Array.isArray(fields) || ![1,2].includes(fields.length) ||
      fields[0]?.id !== 'drawing' || fields[0].input !== 'sketch' ||
      (fields.length === 2 && (fields[1]?.id !== 'direction' || fields[1].input !== 'text')) ||
      !prompt || prompt.layout || ![1,2].includes(prompt.media?.length) ||
      prompt.media.some(item => item?.kind !== 'image')) return null;
  const image = prompt.media.at(-1);
  const hash = typeof image.url === 'string' ? image.url.split('/').at(-1) : '';
  const board = Object.hasOwn(BOARDS,hash) ? BOARDS[hash] : null;
  if (!board) return null;
  const {width,height,points} = board;
  return {image,width,height,points:points.map(([label,x,y])=>({label,x,y,value:[x/width,y/height]})),
    passage:{...prompt,media:prompt.media.slice(0,-1)}};
}

export function readWindArrow(value, plan) {
  if (value?.version !== 1 || !Array.isArray(value.strokes) || value.strokes.length !== 1 ||
      !Array.isArray(value.strokes[0]) || value.strokes[0].length !== 2) return null;
  const pointFor = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && plan.points.find(p =>
    Math.abs(p.value[0]-point[0]) < 1e-7 && Math.abs(p.value[1]-point[1]) < 1e-7);
  const [from,to] = value.strokes[0].map(pointFor);
  return from && to && from !== to ? [from,to] : null;
}

export function windArrowExample(answer, plan) {
  const text = answer?.fields?.drawing?.examples?.[0];
  const match = typeof text === 'string' && /^箭頭由([^。]+)指向([^。]+)。$/u.exec(text);
  if (!match) return null;
  const points = match.slice(1).map(label=>plan.points.find(point=>point.label===label));
  return points.every(Boolean) && points[0]!==points[1] ? {version:1,strokes:[points.map(p=>[...p.value])]} : null;
}

export function renderWindDrawing(host, plan, {value,locked,onChange,renderContent}) {
  const doc = host.ownerDocument;
  const art = doc.createElement('div');
  renderContent(art,{text:'',media:[plan.image]});
  const image = art.querySelector('img');
  if (!image) return null;
  const board = doc.createElement('div');
  board.className = 'quiz-wind-drawing';
  Object.assign(board.style,{position:'relative',width:'min(100%, 480px)',aspectRatio:`${plan.width}/${plan.height}`});
  image.before(board);
  board.append(image);
  Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',maxHeight:'none',objectFit:'fill',margin:'0'});

  const overlay = doc.createElementNS(SVG,'svg');
  overlay.setAttribute('viewBox',`0 0 ${plan.width} ${plan.height}`);
  overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
  board.append(overlay);
  const status = doc.createElement('p');
  status.setAttribute('aria-live','polite');
  const undo = doc.createElement('button');
  undo.type = 'button';
  undo.textContent = '清除箭頭';
  const buttons = [];
  let disabled = locked, start = null, arrow = readWindArrow(value,plan);

  const update = () => {
    const ready = image.complete && image.naturalWidth > 0;
    overlay.replaceChildren();
    if (ready && arrow) {
      const [a,b] = arrow;
      const angle = Math.atan2(b.y-a.y,b.x-a.x);
      const head = Math.min(plan.width,plan.height)*.061;
      const left = [b.x-head*Math.cos(angle-.53),b.y-head*Math.sin(angle-.53)];
      const right = [b.x-head*Math.cos(angle+.53),b.y-head*Math.sin(angle+.53)];
      const line = doc.createElementNS(SVG,'path');
      line.setAttribute('d',`M ${a.x} ${a.y} L ${b.x} ${b.y} M ${left.join(' ')} L ${b.x} ${b.y} L ${right.join(' ')}`);
      line.setAttribute('stroke','#11636f');
      line.setAttribute('stroke-width','3');
      line.setAttribute('stroke-linecap','round');
      line.setAttribute('stroke-linejoin','round');
      line.setAttribute('vector-effect','non-scaling-stroke');
      line.setAttribute('fill','none');
      overlay.append(line);
    }
    if (arrow) board.dataset.windArrow = arrow.map(p=>p.label).join('→');
    else delete board.dataset.windArrow;
    status.textContent = !ready ? '' : start ? `起點是${start.label}。請選終點。` :
      arrow ? `箭頭由${arrow[0].label}指向${arrow[1].label}。` : '請先選箭尾的位置，再選箭頭的位置。';
    undo.disabled = disabled || (!arrow && !start);
    for (const [button,point] of buttons) {
      button.disabled = disabled || !ready;
      button.setAttribute('aria-pressed',String(point===start));
      button.style.background = point===start ? '#125f885e' : '#ffffff40';
    }
  };

  const save = () => {
    update();
    onChange({version:1,strokes:arrow?[arrow.map(p=>[...p.value])]:[]});
  };
  if (!locked) for (const point of plan.points) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.windPoint = point.label;
    button.setAttribute('aria-label',point.label);
    Object.assign(button.style,{position:'absolute',left:`${point.x/plan.width*100}%`,top:`${point.y/plan.height*100}%`,
      transform:'translate(-50%,-50%)',width:'min(42px, 14%)',aspectRatio:'1',padding:'0',border:'1px dashed #125f88',borderRadius:'50%'});
    button.addEventListener('click',()=>{
      if (disabled || button.disabled) return;
      if (start===point) {start=null;update();return;}
      if (!start) {start=point;update();return;}
      arrow=[start,point];start=null;save();
    });
    button.addEventListener('keydown',event=>{
      if (event.key==='Escape' && start) {event.preventDefault();start=null;update();}
    });
    buttons.push([button,point]);
    board.append(button);
  }
  undo.addEventListener('click',()=>{
    if (disabled) return;
    if (start) {start=null;update();return;}
    arrow=null;save();
  });
  for (const event of ['load','error']) image.addEventListener(event,update);
  host.append(art,status);
  if (!locked) host.append(undo);
  update();
  return {setDisabled(value){disabled=locked||value;start=null;update();},
    destroy(){for(const event of ['load','error'])image.removeEventListener(event,update);}};
}
