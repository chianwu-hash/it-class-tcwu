import {makeCircleRegions, renderCircleColoring} from './quiz-circle-coloring.mjs';
import {appendFieldReviewStatus, appendFieldReviewReference, fieldsReviewPresentation} from './quiz-fields-review.mjs';

const colors = {
  green: {label:'綠色', fill:'#27844d', pattern:'diagonal'},
  orange: {label:'橘色', fill:'#de791e', pattern:'dots'},
  yellow: {label:'黃色', fill:'#eac325', pattern:'horizontal'},
  brown: {label:'咖啡色', fill:'#925734', pattern:'diagonal'},
  blue: {label:'藍色', fill:'#2479bd', pattern:'dots'},
  red: {label:'紅色', fill:'#c94653', pattern:'horizontal'},
};
const boards = {
  'hlg3m_05908f9d_fraction_colors_v1': {
    sha:'10ccbb69dcf36b5de56ea6f901732ad345856bfdf3ba688ce16a3871d5276e57', width:119, height:119,
    parts:6, start:0, cx:59.15, cy:58.9, rx:58.4, ry:58.4, colors:['green','orange','yellow'],
  },
  'hlg3m_05e2dd80_fraction_colors_v1': {
    sha:'4f30b3e7fcca430464a399c10c2fa7d4ff0fe3ef392f88891c1a78a5d58af0f1', width:2400, height:2276,
    parts:8, start:-90, cx:1184.5, cy:1147, rx:1077, ry:1077, colors:['brown','blue','red'],
  },
};
const colorPositions = [.25,.5,.75];
export const isFractionColorsQuestion = q => Object.hasOwn(boards,q?.id) || /_fraction_colors_v\d+$/u.test(q?.id ?? '');

export function fractionColorsPlan(q) {
  const board = Object.hasOwn(boards,q?.id) ? boards[q.id] : null;
  const prompt = q?.prompt, image = prompt?.media?.[0];
  if (!board || board.parts > 32 || board.colors.length !== colorPositions.length ||
      new Set(board.colors.map(id=>colors[id]?.pattern)).size !== board.colors.length ||
      board.colors.some(id=>!Object.hasOwn(colors,id)) || q.type !== 'fields' || q.work?.input !== 'sketch' || prompt?.layout ||
      prompt?.media?.length !== 1 || image.kind !== 'image' ||
      !image.url?.startsWith('https://quiz-media.invalid/') || !image.url.endsWith('/'+board.sha) ||
      q.fields?.length !== board.colors.length ||
      q.fields.some((field,i) => field.id !== board.colors[i] || field.input !== 'math')) return null;
  return {
    image, width:board.width, height:board.height, maxWidth:Math.min(360,board.width*2),
    passage:{...prompt, media:[]}, regions:makeCircleRegions(board),
    palette:board.colors.map(id=>({id,...colors[id]})),
  };
}

export function fractionColorsResponse(plan, marks) {
  const counts = Object.fromEntries(plan.palette.map(color=>[color.id,0]));
  const strokes = plan.regions.flatMap((region,i) => {
    const colorIndex = plan.palette.findIndex(color => color.id === marks.get(region.id));
    if (colorIndex < 0) return [];
    counts[plan.palette[colorIndex].id]++;
    return [[[(i+1)/32,colorPositions[colorIndex]]]];
  });
  const f = Object.fromEntries(Object.entries(counts).map(([id,count])=>[id,String(count)]));
  return {v:1,f,w:{version:1,strokes}};
}

export function readFractionColors(plan,response) {
  const work = response?.w, f = response?.f;
  if (response?.v !== 1 || !work || work.version !== 1 || Object.keys(work).length !== 2 ||
      !Array.isArray(work.strokes) || work.strokes.length > plan.regions.length ||
      !f || Object.keys(f).length !== plan.palette.length) return null;
  const marks = new Map();
  let last = 0;
  for (const stroke of work.strokes) {
    if (!Array.isArray(stroke) || stroke.length !== 1 || !Array.isArray(stroke[0]) || stroke[0].length !== 2) return null;
    const [x,y] = stroke[0], i = x * 32, colorIndex = colorPositions.indexOf(y);
    if (typeof x !== 'number' || !Number.isInteger(i) || i <= last || i > plan.regions.length || colorIndex < 0) return null;
    marks.set(plan.regions[i-1].id, plan.palette[colorIndex].id);
    last = i;
  }
  return Object.entries(fractionColorsResponse(plan,marks).f).every(([id,count])=>f[id]===count) ? marks : null;
}

export function renderFractionColors(host,q,plan,{response,locked,review,renderContent,onChange}) {
  const marks = readFractionColors(plan,response);
  if (!renderCircleColoring(host,plan,{
    locked, renderContent, value:marks, onChange:next=>onChange(JSON.stringify(fractionColorsResponse(plan,next))),
    countText:chosen=>{
      if (locked && !marks) return '這份作答的塗色與塊數無法配對。';
      const {f} = fractionColorsResponse(plan,chosen);
      return plan.palette.map(color=>color.label+' '+f[color.id]+' 塊').join('、')+'。';
    },
  })) return false;
  const feedback = locked && marks && fieldsReviewPresentation(q,JSON.stringify(response),review);
  if (feedback) {
    const group = host.lastElementChild;
    for (const [index,color] of plan.palette.entries()) {
      const section = host.ownerDocument.createElement('section');
      section.className = 'quiz-field';
      const title = host.ownerDocument.createElement('h4');
      title.textContent = color.label;
      section.append(title);
      const result=feedback[index];
      appendFieldReviewStatus(section,result?.state==='reference'?{...result,state:'incorrect'}:result);
      appendFieldReviewReference(section,result,value=>value+' 塊',()=>{});
      group.append(section);
    }
  }
  return true;
}
