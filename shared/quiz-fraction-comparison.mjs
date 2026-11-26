import {makeCircleRegions,renderCircleColoring} from './quiz-circle-coloring.mjs';
import {appendFieldReviewStatus,appendFieldReviewReference} from './quiz-fields-review.mjs';

const boards = {
  '05507d9c': ['36bae0bac9c8941f359580704f32a72d8ebafdf3fbc0bb5fba9c1b2fac3667e6',10,2400,1385,
    [613,670.5,356,356.5],[1802,670.5,356,356.5]],
  '013ed4d3': ['c7462c8bb350603a6e472941133b451a6378ca013443a2320af64b1f77890935',5,2400,1013,
    [534,490.5,488,489],[1896.5,490.5,488,489]],
  '02ce3c4c': ['90b15937716b01d6a79d25c2c59a502993f70fb0a4d33aac3241d9c16de7c43f',10,2400,1050,
    [525.5,515.5,481.5,482],[1874.5,526.5,482.5,483]],
  '059b4da4': ['d558eae97ebcc3e7df197ea1b4fb8a06fc5c1463e44a48f83bbe1a19398768ae',8,611,233,
    [118,117.5,108.5,108.5],[491,117.5,108.5,108.5]],
};

export function fractionComparisonPlan(q) {
  const id = /^hlg3m_([0-9a-f]{8})_fraction_compare_v1$/u.exec(q?.id ?? '')?.[1];
  const board = boards[id], prompt = q?.prompt, image = prompt?.media?.[0];
  if (!board || q.type !== 'fields' || q.work?.input !== 'sketch' ||
      q.fields?.length !== 3 || prompt?.layout || prompt?.media?.length !== 1 || image.kind !== 'image') return null;
  const [left,right,comparison] = q.fields;
  if (left.id !== 'left' || left.input !== 'math' || right.id !== 'right' || right.input !== 'math' ||
      comparison.id !== 'comparison' || comparison.input !== 'single' ||
      comparison.options?.length !== 2 ||
      comparison.options[0].id !== 'less' || comparison.options[0].content?.text !== '＜' ||
      comparison.options[1].id !== 'greater' || comparison.options[1].content?.text !== '＞' ||
      comparison.options.some(option=>option.content?.media?.length || option.content?.layout)) return null;
  const [sha,parts,width,height,...circles] = board;
  if (!image.url?.startsWith('https://quiz-media.invalid/') || !image.url.endsWith('/'+sha)) return null;
  const regions = circles.flatMap(([cx,cy,rx,ry],side)=>
    makeCircleRegions({parts,cx,cy,rx,ry,start:-90}, {
      prefix:side?'r':'l',sideLabel:side?'右圖':'左圖',
    }).map((region,index)=>({...region,side,point:[(index+1)/32,side ? .75 : .25]})));
  return {image,width,height,parts,regions,comparison,maxWidth:680,passage:{...prompt,media:[]}};
}

const countsFor = (plan, ids) => {
  const counts = [0,0];
  for (const region of plan.regions) if (ids.has(region.id)) counts[region.side]++;
  return counts;
};

export function fractionComparisonResponse(plan, ids, comparison) {
  const [left,right] = countsFor(plan,ids);
  return {v:1,f:{left:String(left),right:String(right),comparison},
    w:{version:1,strokes:plan.regions.filter(region=>ids.has(region.id))
      .map(region=>[[...region.point]])}};
}

export function readFractionComparison(plan, value) {
  const work = value?.w;
  if (!work || work.version!==1 || Object.keys(work).length!==2 ||
      !Array.isArray(work.strokes) || work.strokes.length>plan.regions.length) return null;
  const ids = new Set();
  let last = -1;
  for (const stroke of work.strokes) {
    const point = Array.isArray(stroke) && stroke.length===1 && stroke[0];
    if (!Array.isArray(point) || point.length!==2) return null;
    const index = plan.regions.findIndex(r=>r.point[0]===point[0] && r.point[1]===point[1]);
    if (index<=last) return null;
    last = index;
    ids.add(plan.regions[index].id);
  }
  const [left,right] = countsFor(plan,ids);
  if (value.f?.left!==String(left) || value.f?.right!==String(right)) return null;
  return ids;
}

export function renderFractionComparison(host,q,plan,{value,locked,feedback,onChange,renderContent}) {
  const doc = host.ownerDocument;
  const make = (tag,text) => {
    const node = doc.createElement(tag);
    if (text!==undefined) node.textContent=text;
    return node;
  };
  const selected = readFractionComparison(plan,value);
  let ids = selected ?? new Set(), comparison = value.f?.comparison ?? '';
  const group = make('div');
  group.className = 'quiz-fields quiz-fraction-comparison';
  const changed = () => onChange(JSON.stringify(fractionComparisonResponse(plan,ids,comparison)));
  if (!renderCircleColoring(group,plan,{
    value:[...ids], locked, renderContent,
    countText:chosen=>{
      if (locked&&!selected) return '這份作答的塗色與格數無法配對。';
      const [left,right] = countsFor(plan,chosen);
      return `左圖已塗 ${left} 塊，右圖已塗 ${right} 塊。`;
    },
    onChange:next=>{ids=new Set(next??[]);changed();},
  })) return false;
  if (feedback && selected) {
    for (const [index,label] of ['左圖塗色','右圖塗色'].entries()) {
      const slot = make('fieldset');
      slot.className = 'quiz-field';
      slot.append(make('legend',label));
      const result = feedback[index];
      appendFieldReviewStatus(slot,result?.state==='reference'?{...result,state:'incorrect'}:result);
      appendFieldReviewReference(slot,result,count=>count+' 塊',()=>{});
      group.append(slot);
    }
  }
  const symbols = make('fieldset');
  symbols.className = 'quiz-field quiz-fraction-comparison-symbols';
  symbols.append(make('legend','選比較符號'));
  if (!locked || selected) appendFieldReviewStatus(symbols,feedback?.[2]);
  const choices = make('div');
  choices.className = 'quiz-fraction-symbol-choices';
  for (const option of plan.comparison.options) {
    const label = make('label'), input = make('input'), sign = make('span',option.content.text);
    label.className = 'student-option';
    input.type = 'radio';
    input.name = 'fraction-comparison-'+q.id;
    input.value = option.id;
    input.setAttribute('aria-label',option.content.text+(option.id==='less'?' 小於':' 大於'));
    input.checked = comparison===option.id;
    input.disabled = locked;
    input.addEventListener('change',()=>{comparison=option.id;changed();});
    label.append(input,sign);
    if (feedback && selected) {
      const result = feedback[2]?.options.find(item=>item.id===option.id);
      if (result?.text) label.append(make('small',result.text));
    }
    choices.append(label);
  }
  symbols.append(choices);
  group.append(symbols);
  host.append(group);
  return true;
}
