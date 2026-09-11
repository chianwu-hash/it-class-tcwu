// Thumbnails are private, immutable derivatives. Originals remain in Drive.
export async function makeHomeworkThumbnail(file) {
 if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw Error('不支援此縮圖格式');
 const url=URL.createObjectURL(file),image=new Image();
 try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('縮圖處理逾時')),15000);image.onload=()=>{clearTimeout(timer);resolve()};image.onerror=()=>{clearTimeout(timer);reject(Error('無法讀取圖片'))};image.src=url});
  const scale=Math.min(1,640/image.naturalWidth,640/image.naturalHeight),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.8,.65,.45,.25]) { const b=await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality));if(b&&b.size<=65536)return b; }
  throw Error('縮圖超過大小限制');
 }finally{URL.revokeObjectURL(url)}
}
export async function thumbnailStorageRequest(base,headers,action,data) {
 const root=`${base}/storage/v1`,bucket='homework-thumbnails';
 const path=id=>`${data.assignment_id}/${id}.jpg`;
 if(action==='thumbnail_urls') {
  const ids=[...new Set(data.upload_ids)].slice(0,100);
  const r=await fetch(`${root}/object/sign/${bucket}`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({paths:ids.map(path),expiresIn:300})});
  if(!r.ok)throw Error('縮圖讀取暫時失敗');const rows=await r.json();
  const urls={};for(const row of rows){const id=ids.find(id=>path(id)===row.path);if(id&&row.signedURL)urls[id]=`${root}${row.signedURL}`;}return {urls};
 }
 if(!data.file||data.file.type!=='image/jpeg'||data.file.size>65536)throw Error('縮圖格式或大小不符');
 const r=await fetch(`${root}/object/${bucket}/${path(data.upload_id)}`,{method:'POST',headers:{...headers,'Content-Type':'image/jpeg','x-upsert':'false','cache-control':'max-age=3600'},body:data.file,signal:AbortSignal.timeout(15000)});
 if(!r.ok){const error=await r.json().catch(()=>({}));if(r.status!==409&&error.error!=='Duplicate')throw Error('縮圖儲存暫時失敗');}
 return {ok:true};
}
