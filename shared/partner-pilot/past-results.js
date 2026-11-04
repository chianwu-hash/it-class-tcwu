export function mountPastResults(root,{question,loadAsset}){
 for(const host of root.querySelectorAll('[data-past-result]')){
  const q=question(Number(host.dataset.pastResult)),value=q.attempts.at(-1)?.value;if(value===undefined)continue;
  const title=document.createElement('b');title.textContent='我這次留下的作答';host.append(title);const text=document.createElement('p');text.className='reply';
  const label=v=>{const c=q.past.choices.find(c=>c.id===v);return typeof v==='boolean'?(v?'打勾／是':'不打勾／否'):c&&c.text&&c.text!==v?v+'・'+c.text:String(v);};
  text.textContent=q.past.kind==='manual'?value.text:typeof value==='object'&&!Array.isArray(value)?value.answer+(value.working?'\n過程：'+value.working:''):Array.isArray(value)?value.map(label).join(q.past.kind==='sequence'?' → ':'、'):label(value);host.append(text);
  if(q.past.kind==='manual'&&value.strokes?.length){
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1 1');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','drawing-board');svg.setAttribute('role','img');svg.setAttribute('aria-label','我留下的畫圖作答（唯讀）');const asset=q.rich.material.media?.find(m=>m.kind==='image'),ratio=asset?.renderWidth/asset?.renderHeight;
   svg.style.aspectRatio=String(Number.isFinite(ratio)?Math.min(ratio,1.5):1.4);
   if(asset){const image=document.createElementNS(ns,'image');image.setAttribute('width','1');image.setAttribute('height',String(ratio>1.5?1.5/ratio:1));image.setAttribute('preserveAspectRatio','none');svg.append(image);loadAsset(asset.url).then(src=>{if(svg.isConnected)image.setAttribute('href',src);}).catch(()=>{if(svg.isConnected){const note=document.createElement('p');note.textContent='底圖暫時無法讀取，筆跡與作答仍已保留。';host.append(note);}});}
   for(const stroke of value.strokes){const line=document.createElementNS(ns,'polyline');line.setAttribute('points',stroke.map(point=>point.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#155e75');line.setAttribute('stroke-width','.006');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');svg.append(line);}host.append(svg);
  }
 }
}
