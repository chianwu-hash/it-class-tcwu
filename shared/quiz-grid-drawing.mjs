const SVG = 'http://www.w3.org/2000/svg';
const SECTIONS = [
  ['11f2179f2505423b1d1e6323e649f1ecd8465787d95c375dafbb837a3afaa5ca', 2166, 1467,
    [17.5,371.5,727,1080,1434,1790,2144], [17.5,373,728,1082.5,1437]],
  ['18190c5cfb46c8eca014555fec71bc136a79be6fc2cf4059aa7bc95b5a6e2c3d', 1449, 1467,
    [13.5,366,720,1075.5,1429.5], [17.5,373,728,1082.5,1437]],
  ['aea22a5323fe6fac3767fd230d1a5165ec99d2387198199a98f4eda0871a90d0', 2070, 1521,
    [55,553,1049,1546,2044], [17.5,511.5,1008,1504]],
  ['c5e89b894e4df268f2813022172337d3670762b3303b23a684b0da030f8b8646', 2400, 1453,
    [17.5,492.5,966.5,1441.5,1916.5,2390.5], [17.5,489,963,1435.5]],
  ['e4f0907a75a895ea00bdfa8dd750925fd12bbe72737b30f08efa8e0ce235a120', 2394, 2400,
    [6,242.5,480.5,716.5,953.5,1191.5,1428.5,1665.5,1902.5,2139.5,2377],
    [11.5,249.5,486.5,723,960,1197,1434,1671.5,1908,2145.5,2382.5]],
];

export function gridDrawingPlan(question) {
  const prompt = question?.prompt;
  if (question?.type !== 'open' || !/^hlg3m_[0-9a-f]{8}_grid_[12]$/u.test(question.id) ||
      question.fields?.length !== 1 || question.fields[0].input !== 'sketch' ||
      question.fields[0].id !== 'drawing' || prompt?.layout || prompt?.media?.length !== 2 ||
      prompt.media.some(item => item.kind !== 'image')) return null;
  const image = prompt.media[1];
  const entry = SECTIONS.find(([sha]) => image.url?.endsWith('/' + sha));
  if (!entry) return null;
  const [, width, height, xs, ys] = entry;
  return {image, width, height, xs, ys, passage: {...prompt, media:[prompt.media[0]]}};
}

export function renderGridDrawing(host, plan, {value, locked, onChange, renderContent}) {
  const doc = host.ownerDocument;
  const art = doc.createElement('div');
  renderContent(art, {text:'', media:[plan.image]});
  const image = art.querySelector('img');
  if (!image) return null;
  const figure = image.closest('figure');
  if (figure) figure.style.margin = '0';
  const board = doc.createElement('div');
  Object.assign(board.style, {position:'relative', width:'min(100%, 530px)', aspectRatio:plan.width + '/' + plan.height});
  image.before(board);
  board.append(image);
  Object.assign(image.style, {position:'absolute', inset:'0', width:'100%', height:'100%',
    maxHeight:'none',objectFit:'fill',margin:'0',padding:'0',border:'0',borderRadius:'0'});
  const graph = doc.createElementNS(SVG,'svg');
  graph.setAttribute('viewBox', `0 0 ${plan.width} ${plan.height}`);
  graph.setAttribute('role','group');
  graph.setAttribute('aria-label','原卷方格作答區');
  Object.assign(graph.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});
  const lines = doc.createElementNS(SVG,'g');
  graph.append(lines);
  const status = doc.createElement('p');
  status.setAttribute('aria-live','polite');
  const undo = doc.createElement('button');
  undo.type = 'button';
  undo.textContent = '復原一步';
  const strokes = Array.isArray(value?.strokes) ? structuredClone(value.strokes) : [];
  const points = [];
  let start = null, focused = null, ready = false, disabled = locked;

  const update = () => {
    undo.disabled = disabled || !strokes.length;
    graph.style.visibility = ready ? 'visible' : 'hidden';
    for (const point of points) {
      point.node.setAttribute('aria-disabled',String(disabled));
      point.node.setAttribute('tabindex',!disabled && point === focused ? '0' : '-1');
      point.node.setAttribute('aria-pressed', String(point === start));
      point.node.setAttribute('fill-opacity',point === start ? '.45' : '.04');
    }
  };
  const draw = () => {
    lines.replaceChildren();
    for (const stroke of strokes) {
      const line = doc.createElementNS(SVG,'polyline');
      line.setAttribute('points',stroke.map(([x,y]) => `${x * plan.width},${y * plan.height}`).join(' '));
      line.setAttribute('stroke','#185e60');
      line.setAttribute('fill','none');
      line.setAttribute('vector-effect','non-scaling-stroke');
      line.setAttribute('stroke-width','3');
      line.style.pointerEvents = 'none';
      lines.append(line);
    }
  };
  const changed = () => {
    draw();
    update();
    onChange({version:1,strokes:structuredClone(strokes)});
  };
  const cancel = () => {
    start = null;
    update();
    status.textContent = '已取消起點。';
  };
  const choose = end => {
    if (disabled || !ready) return;
    if (end === start) { cancel(); return; }
    if (!start) {
      if (strokes.length >= 80) { status.textContent = '這張圖最多 80 條線，請先復原一步。'; return; }
      start = end;
      update();
      status.textContent = '已選起點，請點終點。';
      return;
    }
    const a = start.coords, b = end.coords;
    const same = (p,q) => p?.[0] === q[0] && p?.[1] === q[1];
    const duplicate = strokes.some(([u,v]) => (same(u,a) && same(v,b)) || (same(v,a) && same(u,b)));
    start = null;
    if (duplicate) { update(); status.textContent = '這條線已經畫好了。'; return; }
    strokes.push([a,b]);
    changed();
    status.textContent = '已畫 ' + strokes.length + ' 條線。';
  };
  const spacing = values => Math.min(...values.slice(1).map((value,index)=>value-values[index]));
  const radius = Math.min(spacing(plan.xs),spacing(plan.ys)) * .43;
  const directions = {ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
  if (!locked) for (const [row,y] of plan.ys.entries()) for (const [col,x] of plan.xs.entries()) {
    const node = doc.createElementNS(SVG,'circle');
    for (const [name,val] of Object.entries({cx:x,cy:y,r:radius,fill:'#125f88',role:'button',
      'aria-label':`第 ${row+1} 條橫線、第 ${col+1} 條直線的交點`})) node.setAttribute(name,val);
    const point = {row,col,node,coords:[x / plan.width,y / plan.height]};
    graph.append(node);
    points.push(point);
    focused ??= point;
    node.addEventListener('focus',() => {node.setAttribute('stroke','#125f88');node.setAttribute('stroke-width',String(radius / 5));});
    node.addEventListener('blur',() => node.removeAttribute('stroke'));
    node.addEventListener('click',() => {if (disabled) return;focused=point;choose(point);});
    node.addEventListener('keydown',event => {
      if (disabled) return;
      const direction = directions[event.key];
      if (direction) {
        event.preventDefault();
        const next = points.find(p => p.row === row + direction[0] && p.col === col + direction[1]);
        if (next) { focused = next; update(); next.node.focus(); }
      } else if (event.key === 'Escape') { event.preventDefault(); cancel(); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault();if (!event.repeat) choose(point); }
    });
  }
  undo.addEventListener('click',() => {
    if (disabled || !strokes.length) return;
    strokes.pop();
    start = null;
    changed();
    status.textContent = '已復原一步。';
  });
  const setReady = () => { ready = image.complete && image.naturalWidth > 0; update(); };
  image.addEventListener('load',setReady);
  image.addEventListener('error',setReady);
  board.append(graph);
  const instruction = doc.createElement('p');
  instruction.textContent = locked ? '你畫的線已保留。' : '先點起點，再點終點。畫錯可以復原。';
  host.append(instruction,art,status);
  if (!locked) host.append(undo);
  setReady();
  draw();
  return {setDisabled(value) { disabled = locked || value; start = null; update(); }, destroy() { graph.remove(); }};
}
