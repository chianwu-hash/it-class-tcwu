const SVG = 'http://www.w3.org/2000/svg';
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

  const point = step => {
    const angle = (start + step * 360 / parts) * Math.PI / 180;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)].join(' ');
  };
  return {
    passage: {...prompt, media: []},
    image, width, height,
    regions: Array.from({length: parts}, (_, index) => ({
      id: 'r' + (index + 1),
      path: `M ${cx} ${cy} L ${point(index)} A ${rx} ${ry} 0 0 1 ${point(index + 1)} Z`,
    })),
  };
}

export function renderCircleColoring(host, plan, {value, locked, correct, onChange, renderContent}) {
  const doc = host.ownerDocument;
  const group = doc.createElement('section');
  group.className = 'quiz-circle-coloring';
  const instruction = doc.createElement('p');
  instruction.textContent = locked ? '你塗色的部分已保留。' : '點一下圖中的一塊就能塗色，再點一下可以清除。';
  const art = doc.createElement('div');
  Object.assign(art.style, {position:'relative', width:'min(100%, 320px)', aspectRatio:plan.width + '/' + plan.height});
  renderContent(art, {text:'', media:[plan.image]});
  const image = art.querySelector('img');
  if (!image) return false;
  const figure = image.closest('figure');
  if (figure) figure.style.margin = '0';
  Object.assign(image.style, {display:'block', width:'100%', height:'auto', maxHeight:'none', borderRadius:'0'});
  const overlay = doc.createElementNS(SVG, 'svg');
  overlay.setAttribute('viewBox', `0 0 ${plan.width} ${plan.height}`);
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', '原圖的等分區域');
  Object.assign(overlay.style, {position:'absolute', inset:'0', width:'100%', height:'100%'});
  const status = doc.createElement('p');
  status.setAttribute('aria-live', 'polite');
  const selected = new Set(plan.regions.filter(region => Array.isArray(value) && value.includes(region.id)).map(region => region.id));
  const paths = new Map();
  const sync = () => {
    for (const [id, path] of paths) {
      const pressed = selected.has(id);
      path.setAttribute('aria-pressed', String(pressed));
      path.setAttribute('fill', pressed ? '#1680bd' : 'transparent');
      path.setAttribute('fill-opacity', pressed ? '.52' : '1');
    }
    let label = selected.size ? `已塗 ${selected.size} 塊。` : '還沒有塗色。';
    if (correct === true) label = '答對了。' + label;
    if (correct === false) label += '再看看題目要塗多少。';
    status.textContent = label;
  };
  const changed = () => {
    sync();
    // An empty draft stays unanswered. The source always asks for a nonzero fraction.
    onChange(selected.size ? plan.regions.filter(region => selected.has(region.id)).map(region => region.id) : null);
  };
  function setReady(ready) {
    overlay.hidden = !ready;
    overlay.style.visibility = ready ? 'visible' : 'hidden';
  }
  setReady(image.complete && image.naturalWidth > 0);
  image.addEventListener('load', () => setReady(true));
  image.addEventListener('error', () => setReady(false));

  for (const [index, region] of plan.regions.entries()) {
    const path = doc.createElementNS(SVG, 'path');
    path.setAttribute('d', region.path);
    path.setAttribute('role', 'button');
    path.setAttribute('aria-label', '第 ' + (index + 1) + ' 塊');
    path.setAttribute('aria-disabled', String(locked));
    if (!locked) {
      path.setAttribute('tabindex', '0');
      path.style.cursor = 'pointer';
      path.addEventListener('focus', () => {
        path.setAttribute('stroke', '#16396f');
        path.setAttribute('stroke-width', '2');
      });
      path.addEventListener('blur', () => path.removeAttribute('stroke'));
      const toggle = () => {
        if (selected.has(region.id)) selected.delete(region.id);
        else selected.add(region.id);
        changed();
      };
      path.addEventListener('click', toggle);
      path.addEventListener('keydown', event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) toggle();
      });
    }
    overlay.append(path);
    paths.set(region.id, path);
  }
  art.append(overlay);
  group.append(instruction, art, status);
  sync();
  host.append(group);
  return true;
}
