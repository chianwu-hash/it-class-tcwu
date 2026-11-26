import { renderCircleColoring } from './quiz-circle-coloring.mjs';

const ids = /^hlg3m_(00ab5c1f|04bb30a7)_fraction_partition_1$/u;
const diagramHash = '0d19205fc51ff74e56bf0024b3b6a9f547c289c658fdf9e40ab72a285e5798b8';
const left = 135.5, right = 2175.5, top = 103.5, bottom = 2164.5;
const tl = [left,top], tr = [right,top], bl = [left,bottom], br = [right,bottom];
const x = (left+right)/2, y = (top+bottom)/2;
const mt = [x,top], mb = [x,bottom], ml = [left,y], mr = [right,y], center = [x,y];
const polygon = points => 'M '+points.map(point=>point.join(' ')).join(' L ')+' Z';
const line = points => 'M '+points.map(point=>point.join(' ')).join(' L ');
const axisH = [ml,mr], axisV = [mt,mb];
function region(id,label,...points) {
  const twiceArea = points.reduce((sum,[x,y],i) => {
    const [nextX,nextY] = points[(i+1)%points.length];
    return sum+x*nextY-nextX*y;
  },0);
  return {id,label,path:polygon(points),area:Math.abs(twiceArea)/2};
}
const layout = (label,lines,regions) => ({label,dividers:lines.map(line),regions});
function strips(vertical) {
  const edges = Array.from({length:5},(_,i) => {
    if (vertical) {
      const x = left+(right-left)*i/4;
      return [[x,top],[x,bottom]];
    }
    const y = top+(bottom-top)*i/4;
    return [[left,y],[right,y]];
  });
  const side = vertical ? '由左往右第' : '由上往下第';
  return layout(vertical?'直向平行線':'橫向平行線',edges.slice(1,-1),
    edges.slice(1).map(([c,d],i)=>region('s'+(i+1),side+(i+1)+'條',...edges[i],d,c)));
}
const layouts = {
  h: layout('─ 橫線',[axisH],[region('t','上方',tl,tr,mr,ml),region('b','下方',ml,mr,br,bl)]),
  v: layout('│ 直線',[axisV],[region('l','左方',tl,mt,mb,bl),region('r','右方',mt,tr,br,mb)]),
  hv: layout('＋ 十字線',[axisH,axisV],[
    region('tl','左上格',tl,mt,center,ml),region('tr','右上格',mt,tr,mr,center),
    region('bl','左下格',ml,center,mb,bl),region('br','右下格',center,mr,br,mb)
  ]),
  d: layout('斜線 ↘',[[tl,br]],[region('ne','右上三角形',tl,tr,br),region('sw','左下三角形',tl,br,bl)]),
  a: layout('斜線 ↗',[[bl,tr]],[region('nw','左上三角形',tl,tr,bl),region('se','右下三角形',bl,tr,br)]),
  da: layout('× 交叉斜線',[[tl,br],[bl,tr]],[
    region('t','上方三角形',tl,tr,center),region('r','右方三角形',tr,br,center),
    region('b','下方三角形',br,bl,center),region('l','左方三角形',bl,tl,center)
  ]),
  hs: strips(false),
  vs: strips(true),
};

export const isFractionPartition = q => ids.test(q?.id ?? '');
export function fractionPartitionPlan(q) {
  const {prompt,fields} = q ?? {};
  const image = prompt?.media?.[1];
  if (!isFractionPartition(q) || q.type !== 'fields' || q.work || prompt?.layout ||
      prompt?.media?.length !== 2 || image?.kind !== 'image' ||
      !image.url?.startsWith('https://quiz-media.invalid/') || !image.url.endsWith('/'+diagramHash) ||
      fields?.length !== 1 || fields[0].id !== 'partition' || fields[0].input !== 'text') return null;
  return {image,width:2400,height:2274,maxWidth:370,passage:{...prompt,media:[]}};
}

export function readFractionPartition(value) {
  if (typeof value !== 'string') return null;
  const [layout,...marks] = value.split('-');
  if (!Object.hasOwn(layouts,layout)) return null;
  const regions = layouts[layout].regions.filter(region=>marks.includes(region.id));
  if ([layout,...regions.map(region=>region.id)].join('-') !== value) return null;
  return {layout,regions};
}

export function fractionPartitionVariants() {
  return Object.entries(layouts).flatMap(([layout,{regions}]) =>
    Array.from({length:2**regions.length-1},(_,i) => {
      const marked = regions.filter((_,n)=>(i+1)&(1<<n));
      const total = (right-left)*(bottom-top);
      const share = marked.reduce((area,region)=>area+region.area,0)/total;
      return {value:[layout,...marked.map(region=>region.id)].join('-'),parts:regions.length,shaded:marked.length,share};
    }));
}

export function fractionPartitionSummary(value) {
  const state = readFractionPartition(value);
  if (!state) return '尚未分割';
  return layouts[state.layout].label + '，' +
    (state.regions.length ? '塗色位置為'+state.regions.map(region=>region.label).join('、') : '尚未塗色');
}

export function renderFractionPartition(host,plan,{value,locked,review,onChange,renderContent}) {
  const doc = host.ownerDocument;
  const section = doc.createElement('section');
  section.className = 'quiz-fraction-partition';
  const controls = doc.createElement('div');
  controls.className = 'quiz-fraction-partition-controls';
  const board = doc.createElement('div');
  const note = doc.createElement('p');
  const previous = readFractionPartition(value);
  let layout = previous?.layout ?? '', marks = previous?.regions.map(region=>region.id) ?? [];
  const changeNotice = doc.createElement('p');
  changeNotice.setAttribute('role','status');
  section.append(note,controls,board,changeNotice);
  note.textContent = locked ? fractionPartitionSummary(value) : '先選一種分法，再點色紙上的區塊塗色。換分法會清除塗色。';
  const update = () => onChange([layout,...marks].join('-'));
  const buttons = new Map();
  for (const [key,{label}] of locked ? [] : Object.entries(layouts)) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = label;
    buttons.set(key,button);
    button.addEventListener('click',() => {
      if (layout===key) return;
      layout = key;
      changeNotice.textContent = marks.length ? '已清除上一種分法的塗色。' : '';
      marks = [];
      update();
      draw();
    });
    controls.append(button);
  }
  function draw() {
    for (const [key,button] of buttons) button.setAttribute('aria-pressed',String(layout===key));
    board.replaceChildren();
    const options = layout ? layouts[layout] : {regions:[],dividers:[]};
    return renderCircleColoring(board,{...plan,...options,regionLabel:'色紙的等分區域',readyText:layout ?
        (locked?'':'點一下區塊塗色，再點一下可清除。') : (locked?'':'')},{
      value:marks,locked,renderContent,
      countText: chosen => locked
        ? (review?.correct === true ? '答對了。' : review?.correct === false ? '再想想要分成幾等分、塗哪一部分。' : '')
        : layout ? (chosen.size ? `已塗 ${chosen.size} 塊。` : '還沒有塗色。') : '',
      onChange: next => {marks=next??[];update();}
    });
  }
  if (!draw()) return false;
  host.append(section);
  return true;
}
