import {makeCircleRegions,renderCircleColoring} from './quiz-circle-coloring.mjs';

const figures = {
  '018f1b67_1':['817ff15e8a0bff65568a9141c7c25157040db4e99d4135a77eb0e4ff9abf2b3e',896,900,'circle',[3,475,601,292,287]],
  '018f1b67_2':['5ea98a05d5047ea5e491d4d59834bfc4b1e2fbddb67e1a5a43aa67eb8a31cf8a',1179,900,'circle',[6,615,597,297,297]],
  '018f1b67_3':['eb2b248b9d8b711e3e5414dfb1138c76e5f03347aba88b21f16dd207780ad77c',1169,942,'circle',[8,611,633.5,300,299.8]],
  '03c530a5_1':['7300380526289fe08b0174638c116d31f3c1bdfe8fecba59a4eaa812b9115dd1',2400,596,'grid',
    [[17.5,285,545.5,805.5,1066.5,1329.5,1590.5,1854,2120.5,2380.5],[13.5,583.5]]],
  '03c530a5_2':['98b1fe3362435b13909ec0edaec2c8bfa6110680240cb66b1299b3b85850276e',2307,1731,'grid',
    [[17,579,1151,1721,2285],[17,582,1153,1712]]],
  '058b3310_1':['2c5c90b3cf20eff0fd150b5dd8abc33ce38a56c1a1e916ef0c8316818d1f903e',1539,1542,'circle',
    [10,768,769.5,758,758]],
  '058b3310_2':['d4af14b6e4d63406b1689911fdc3595e9ff9977c50c1ff387455c7d6b6e29512',1725,1449,'polygon',
    [[870,723],[[37,723],[451,14],[1287,14],[1704,723],[1287,1432],[451,1432]]]],
};

const polygon = points=>`M ${points.map(p=>p.join(' ')).join(' L ')} Z`;
function makePaths(kind, data) {
  if(kind==='circle'){
    const [parts,cx,cy,rx,ry]=data;
    return makeCircleRegions({parts,cx,cy,rx,ry,start:-90});
  }
  let paths;
  if(kind==='grid'){
    const [xs,ys]=data;
    paths=ys.slice(1).flatMap((bottom,row)=>xs.slice(1).map((right,col)=>
      polygon([[xs[col],ys[row]],[right,ys[row]],[right,bottom],[xs[col],bottom]])));
  }else{
    const [center,vertices]=data;
    paths=vertices.map((point,i)=>polygon([center,point,vertices[(i+1)%vertices.length]]));
  }
  return paths.map((path,i)=>({id:'r'+(i+1),label:'第 '+(i+1)+' 塊',path}));
}

export function fractionShadingPlan(q) {
  const id=/^hlg3m_([0-9a-f]{8})_fraction_shade_([1-3])$/u.exec(q?.id??'');
  const entry=id&&figures[id[1]+'_'+id[2]];
  const prompt=q?.prompt,image=prompt?.media?.[0],field=q?.fields?.[0];
  if(!entry||q.type!=='fields'||q.work?.input!=='sketch'||q.fields?.length!==1||
      field.id!=='colored'||field.input!=='math'||prompt?.layout||prompt?.media?.length!==1||image.kind!=='image')return null;
  const [sha,width,height,kind,data]=entry;
  if(!image.url?.startsWith('https://quiz-media.invalid/')||!image.url.endsWith('/'+sha))return null;
  return {image,width,height,maxWidth:kind==='grid'?600:410,
    regions:makePaths(kind,data),passage:{...prompt,media:[]}};
}

export function fractionShadingResponse(plan,selected) {
  const marks=plan.regions.flatMap((region,index)=>selected.has(region.id)?[[[(index+1)/32,.5]]]:[]);
  return {v:1,f:{colored:String(marks.length)},w:{version:1,strokes:marks}};
}

export function readFractionShading(plan,response) {
  const work=response?.w;
  if(!work||work.version!==1||Object.keys(work).length!==2||!Array.isArray(work.strokes)||
      response.f?.colored!==String(work.strokes.length))return null;
  const selected=new Set();
  let last=0;
  for(const mark of work.strokes){
    if(!Array.isArray(mark)||mark.length!==1||!Array.isArray(mark[0])||mark[0].length!==2)return null;
    const [x,y]=mark[0],index=x*32;
    if(typeof x!=='number'||!Number.isInteger(index)||index<=last||index>plan.regions.length||y!==.5)return null;
    selected.add(plan.regions[index-1].id);
    last=index;
  }
  return selected;
}

export function renderFractionShading(host,plan,{response,locked,review,onChange,renderContent}) {
  const selected=readFractionShading(plan,response);
  const accepted=review?.answer?.fields?.colored;
  const countText=chosen=>{
    if(locked&&!selected)return '這份作答的塗色與格數無法配對。';
    const count=chosen.size;
    if(!locked||!Array.isArray(accepted))return count?`已塗 ${count} 塊。`:'還沒有塗色。';
    const result=accepted.includes(String(count))?'塗色格數答對了。':`參考答案：${accepted.join(' 或 ')} 塊。`;
    return `你塗了 ${count} 塊。`+result;
  };
  return renderCircleColoring(host,plan,{value:[...(selected??[])],locked,renderContent,countText,
    onChange:next=>onChange(JSON.stringify(fractionShadingResponse(plan,new Set(next??[]))))});
}
