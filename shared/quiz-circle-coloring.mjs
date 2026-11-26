const SVG = 'http://www.w3.org/2000/svg';
const imageObservers = new WeakMap();
const boards = {
  '00e4de90': ['70445737ea122be80f6b1df4ba5587eeadb927a8820bc48e9ee110addc91343c', 8, 121, 119, 59.5, 60, 56.5, 57, -90],
  '02a90926': ['33b79758d33a5ece57c2c3f4aae4755560902a542798598ff65359f2d3c2c1bb', 3, 250, 250, 123, 125.5, 111, 111.5, -90],
  '04245b12': ['bea257b64812f46bbdc890991c8c56c656040999b443de3d1806eaa84da8a67e', 6, 121, 118, 60, 60.5, 57, 56.5, 0],
  '05467722': ['00d19279834d95b1ad299090fae98055107552c89178c2544eb94b74c8e95ec6', 5, 259, 245, 126.5, 122.5, 111.5, 112.5, -90],
};

export function circleColoringPlan(question) {
  const match = /^hlg3m_([0-9a-f]{8})_circle_v1$/u.exec(question?.id ?? '');
  const board = match && boards[match[1]];
  const prompt = question?.prompt;
  const field = question?.fields?.[0];
  if (!board || question.type !== 'fields' || question.work || question.fields?.length !== 1 ||
      field.id !== 'regions' || field.input !== 'set' || prompt?.layout || prompt?.media?.length !== 1) return null;

  const [sha, parts, width, height, cx, cy, rx, ry, start] = board;
  const image = prompt.media[0];
  const options = field.options ?? [];
  const expectedIds = Array.from({length: parts}, (_, index) => 'r' + (index + 1));
  const actualIds = new Set(options.map(option => option.id));
  if (image.kind !== 'image' || !image.url?.endsWith('/' + sha) ||
      options.length !== parts || !expectedIds.every(id => actualIds.has(id))) return null;

  return {
    passage: {...prompt, media: []},
    image, width, height,
    regions: makeCircleRegions({parts,cx,cy,rx,ry,start}),
  };
}

export function makeCircleRegions({parts,cx,cy,rx,ry,start}, {prefix='r',sideLabel=''}={}) {
  const point = step => {
    const angle = (start + step * 360 / parts) * Math.PI / 180;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)].join(' ');
  };
  return Array.from({length: parts}, (_, index) => ({
    id: prefix + (index + 1),
    label: sideLabel + '第 ' + (index + 1) + ' 塊',
    path: `M ${cx} ${cy} L ${point(index)} A ${rx} ${ry} 0 0 1 ${point(index + 1)} Z`,
  }));
}

let patternSequence = 0;

function mountPalette(doc, palette, locked, overlay) {
  const container = doc.createElement(locked ? 'div' : 'fieldset');
  container.className = 'quiz-sector-palette';
  const defs = doc.createElementNS(SVG,'defs');
  const paints = new Map(), controls = new Map();
  const announcement = doc.createElement('span');
  announcement.className = 'sr-only';
  announcement.setAttribute('aria-live','polite');
  const prefix = 'quiz-sector-color-'+(++patternSequence)+'-';
  const select = id => {
    for (const [key, button] of controls) button.setAttribute('aria-pressed',String(key===id));
    current = id;
    announcement.textContent = '目前顏色：' + palette.find(color=>color.id===id).label;
  };
  let current = palette[0].id;
  if (!locked) {
    const caption = doc.createElement('legend');
    caption.textContent = '選顏色';
    container.append(caption,announcement);
  }
  const patterns = {
    diagonal:['path',{d:'M -2 2 L 2 -2 M 0 8 L 8 0 M 6 10 L 10 6',stroke:'#111','stroke-width':'.9'}],
    dots:['circle',{cx:4,cy:4,r:1.15,fill:'#111'}],
    horizontal:['path',{d:'M 0 4 H 8',stroke:'#111','stroke-width':'.9'}],
  };
  for (const [index,color] of palette.entries()) {
    const id = prefix+color.id, pattern = doc.createElementNS(SVG,'pattern');
    const attributes = {id,patternUnits:'objectBoundingBox',width:'.17',height:'.17',viewBox:'0 0 8 8',preserveAspectRatio:'none'};
    for (const [key,value] of Object.entries(attributes)) pattern.setAttribute(key,value);
    const paint = doc.createElementNS(SVG,'rect');
    for (const [key,value] of Object.entries({width:8,height:8,fill:color.fill})) paint.setAttribute(key,value);
    pattern.append(paint);
    const [tag,marks] = patterns[color.pattern];
    const texture = doc.createElementNS(SVG,tag);
    for (const [key,value] of Object.entries(marks)) texture.setAttribute(key,value);
    pattern.append(texture);defs.append(pattern);
    paints.set(color.id,'url(#'+id+')');
    const button = doc.createElement(locked ? 'span' : 'button');
    button.className = 'quiz-sector-color';
    const swatch = doc.createElementNS(SVG,'svg');
    swatch.setAttribute('viewBox','0 0 20 20');
    swatch.setAttribute('aria-hidden','true');
    const square = doc.createElementNS(SVG,'rect');
    for (const [key,value] of Object.entries({width:20,height:20,fill:paints.get(color.id)})) square.setAttribute(key,value);
    swatch.append(square);
    button.append(swatch,doc.createTextNode(color.label));
    if (!locked) {
      button.type = 'button';
      button.setAttribute('aria-keyshortcuts',String(index+1));
      button.addEventListener('click',()=>select(color.id));
      controls.set(color.id,button);
    }
    container.append(button);
  }
  overlay.append(defs);
  select(current);
  return {container,paints,select,get current(){return current;}};
}

export function renderCircleColoring(host, plan, {value, locked, correct, onChange, renderContent, countText}) {
  const doc = host.ownerDocument;
  const group = doc.createElement('section');
  group.className = 'quiz-circle-coloring';
  const instruction = doc.createElement('p');
  const palette = plan.palette;
  const readyText = plan.readyText ?? (!locked && palette ? '選一種顏色，再點蛋糕。用同色再點一次可以清除。' : locked ? '你塗色的部分已保留。' : '點一下圖中的一塊就能塗色，再點一下可以清除。');
  const art = doc.createElement('div');
  renderContent(art, {text:'', media:[plan.image]});
  const image = art.querySelector('img');
  if (!image) return false;
  const figure = image.closest('figure');
  if (figure) figure.style.margin = '0';
  let board = image.closest('.quiz-circle-coloring-board');
  if (board) {
    imageObservers.get(board)?.abort();
    board.replaceChildren(image);
  } else {
    board = doc.createElement('div');
    board.className = 'quiz-circle-coloring-board';
    Object.assign(board.style, {
      position:'relative', width:`min(100%, ${plan.maxWidth ?? 320}px)`, aspectRatio:plan.width + '/' + plan.height,
    });
    image.before(board);
    board.append(image);
  }
  Object.assign(image.style, {
    position:'absolute', inset:'0', width:'100%', height:'100%', maxHeight:'none',
    objectFit:'fill', margin:'0', padding:'0', border:'0', borderRadius:'0',
  });
  const overlay = doc.createElementNS(SVG, 'svg');
  overlay.setAttribute('viewBox', `0 0 ${plan.width} ${plan.height}`);
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', plan.regionLabel ?? '原圖的等分區域');
  Object.assign(overlay.style, {position:'absolute', inset:'0', width:'100%', height:'100%'});
  const status = doc.createElement('p');
  status.setAttribute('aria-live', 'polite');
  const colorBoard = palette ? mountPalette(doc,palette,locked,overlay) : null;
  const selected = new Map(plan.regions.flatMap(({id}) => {
    if (palette) return palette.some(color=>color.id===value?.get(id)) ? [[id,value.get(id)]] : [];
    return Array.isArray(value) && value.includes(id) ? [[id,true]] : [];
  }));
  const paths = new Map();
  const sync = () => {
    for (const [id, path] of paths) {
      const pressed = selected.has(id);
      path.setAttribute('aria-pressed', String(pressed));
      const color = palette?.find(item=>item.id===selected.get(id));
      path.setAttribute('fill', pressed ? colorBoard?.paints.get(color.id) ?? '#1680bd' : 'transparent');
      path.setAttribute('fill-opacity', pressed ? (palette ? '.65' : '.52') : '1');
      if(palette) path.setAttribute('aria-label',path.dataset.label+'，'+(color?.label??'未塗色'));
    }
    let label = selected.size ? `已塗 ${selected.size} 塊。` : '還沒有塗色。';
    if (correct === true) label = '答對了。' + label;
    if (correct === false) label += '再看看題目要塗多少。';
    status.textContent = countText ? countText(palette ? selected : new Set(selected.keys())) : label;
  };
  const changed = () => {
    sync();
    // An empty draft stays unanswered. The source always asks for a nonzero fraction.
    onChange(palette ? new Map(selected) : selected.size ? [...paths.keys()].filter(id=>selected.has(id)) : null);
  };
  function setReady(ready) {
    overlay.hidden = !ready;
    overlay.style.visibility = ready ? 'visible' : 'hidden';
    instruction.textContent = ready ? readyText : image.complete && image.currentSrc
      ? '圖片無法載入，請重新整理頁面。' : '圖片載入中。';
  }
  const observer = new AbortController();
  imageObservers.set(board, observer);
  const ready = () => setReady(image.complete && image.naturalWidth === plan.width && image.naturalHeight === plan.height);
  ready();
  image.addEventListener('load', ready, {signal:observer.signal});
  image.addEventListener('error', ready, {signal:observer.signal});

  for (const region of plan.regions) {
    const path = doc.createElementNS(SVG, 'path');
    path.setAttribute('d', region.path);
    path.setAttribute('role', 'button');
    path.setAttribute('aria-label', region.label);
    path.dataset.region = region.id;
    path.dataset.label = region.label;
    path.setAttribute('aria-disabled', String(locked));
    if (!locked) {
      path.setAttribute('tabindex', palette && paths.size ? '-1' : '0');
      path.style.cursor = 'pointer';
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      path.addEventListener('focus', () => {
        if (palette) for (const part of paths.values()) part.setAttribute('tabindex',part===path?'0':'-1');
        path.setAttribute('stroke', '#16396f');
        path.setAttribute('stroke-width', '3');
      });
      path.addEventListener('blur', () => path.removeAttribute('stroke'));
      const toggle = () => {
        const paint = palette ? colorBoard.current : true;
        if (selected.get(region.id)===paint) selected.delete(region.id);
        else selected.set(region.id,paint);
        changed();
      };
      path.addEventListener('click', toggle);
      path.addEventListener('keydown', event => {
        if (palette) {
          const delta = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : ['ArrowRight','ArrowDown'].includes(event.key) ? 1 : 0;
          if (delta) {
            event.preventDefault();
            const parts = [...paths.values()];
            parts[(parts.indexOf(path)+delta+parts.length)%parts.length].focus();
            return;
          }
          const color = /^[1-3]$/u.test(event.key) && palette[Number(event.key)-1];
          if (color) {event.preventDefault();colorBoard.select(color.id);return;}
          if (event.key==='Delete' || event.key==='Backspace') {event.preventDefault();selected.delete(region.id);changed();return;}
        }
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) toggle();
      });
    }
    overlay.append(path);
    paths.set(region.id, path);
  }
  for (const d of plan.dividers ?? []) {
    const divider = doc.createElementNS(SVG,'path');
    for (const [key,value] of Object.entries({d,fill:'none',stroke:'#234459','stroke-width':'2',
      'vector-effect':'non-scaling-stroke','pointer-events':'none','aria-hidden':'true'})) divider.setAttribute(key,value);
    overlay.append(divider);
  }
  board.append(overlay);
  group.append(instruction);
  if (colorBoard) group.append(colorBoard.container);
  group.append(art,status);
  sync();
  host.append(group);
  return true;
}
