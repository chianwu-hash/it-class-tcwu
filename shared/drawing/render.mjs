const NS='http://www.w3.org/2000/svg';
export function drawingLayer(value,{width=600,height=360}={}){
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','已保存的圖形與標記');
 const node=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;},xy=([x,y])=>[x*width,y*height],points=p=>p.map(xy).map(p=>p.join(',')).join(' ');
 value.strokes.forEach((s,i)=>svg.append(node('polyline',{points:points(s),fill:'none',stroke:value.colors?.[i]??'#185e60','stroke-width':4,'stroke-linecap':'round','stroke-linejoin':'round','data-drawing-stroke':i})));
 for(const [i,m]of value.marks.entries()){
  const style={fill:m.fill?m.color:'none','fill-opacity':m.fill?.35:1,stroke:m.color,'stroke-width':(m.width??0)*width,'stroke-linecap':'round','stroke-linejoin':'round'};let mark;
  if(m.kind==='text'){const [x,y]=xy(m.at);mark=node('text',{x,y,fill:m.color,'font-size':m.size*width,'font-family':'system-ui, sans-serif'});mark.textContent=m.text;}
  else if(m.kind==='sector'){
   const [x,y]=xy(m.center),r=m.radius*width,a=m.rotation*Math.PI/180,b=(m.rotation+m.angle)*Math.PI/180;
   if(m.angle===360)mark=node('circle',{...style,cx:x,cy:y,r});
   else mark=node('path',{...style,d:`M${x},${y} L${x+r*Math.cos(a)},${y-r*Math.sin(a)} A${r},${r} 0 ${m.angle>180?1:0} 0 ${x+r*Math.cos(b)},${y-r*Math.sin(b)} Z`});
  }
  else if(m.kind==='line')mark=node('polyline',{...style,points:points(m.points)});
  else if(m.kind==='polygon')mark=node('polygon',{...style,points:points(m.points)});
  else{const [[x,y],[x2,y2]]=m.points.map(xy);mark=node('ellipse',{...style,cx:(x+x2)/2,cy:(y+y2)/2,rx:Math.abs(x2-x)/2,ry:Math.abs(y2-y)/2});}
  mark.dataset.drawingMark=String(i);svg.append(mark);
 }
 return svg;
}
export function drawingPaper(value,{drawing={},renderContent}={}){
 const {width=600,height=360,background,grid}=drawing,host=document.createElement('div');host.className='drawing-paper';host.style.aspectRatio=width+'/'+height;
 if(background&&renderContent){const art=document.createElement('div');art.className='drawing-background';art.setAttribute('aria-label','原題底圖');renderContent(art,background);host.append(art);}
 const svg=drawingLayer(value,{width,height});svg.classList.add('drawing-layer');
 if(grid){const step=grid.step,lines=document.createElementNS(NS,'g');lines.classList.add('drawing-grid');for(let x=step;x<width;x+=step){const n=document.createElementNS(NS,'path');n.setAttribute('d',`M${x},0V${height}`);lines.append(n);}for(let y=step;y<height;y+=step){const n=document.createElementNS(NS,'path');n.setAttribute('d',`M0,${y}H${width}`);lines.append(n);}svg.prepend(lines);}
 host.append(svg);return host;
}
