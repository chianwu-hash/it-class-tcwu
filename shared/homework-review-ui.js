import { makeHomeworkThumbnail } from './homework-thumbnails.js?v=20260910-stored';
import { homeworkStatus } from './homework-api.js?v=20260910-stored';
const make=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function createHomeworkReview({request,isTeacher,onSaved=async()=>{}}) {
 let epoch=0,current=null,dirty=false,pen=false,saving=false,lines=[],stroke=null,cols=2;
 const signed=new Map(),signGroups=new Map();
 const urls=new Map(),pending=new Map();let active=0;const queue=[];
 const history=make('dialog','','hw-history'),light=make('dialog','','hw-light');document.body.append(history,light);
 const message=make('p','','hw-message');message.setAttribute('role','status');
 const closeH=make('button','關閉 ×');closeH.onclick=()=>history.close();
 const htitle=make('h2'),hhead=make('div','','hw-dialog-head');hhead.append(htitle,closeH);
 const count=make('div','','toolbar');count.append(make('span','每列顯示'));const versions=make('div','','hw-versions');
 for(const n of [2,4]){const b=make('button',`${n} 張`,'secondary');b.onclick=()=>{cols=n;versions.style.setProperty('--columns',n);count.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};b.setAttribute('aria-pressed',String(n===cols));count.append(b)}
 history.append(hhead,make('p','由舊到新排列；點圖片查看當次批註與回饋。','note'),count,versions);
 const title=make('h2'),meta=make('p','','note'),close=make('button','關閉 ×'),head=make('div','','hw-dialog-head');const caption=make('div');caption.append(title,meta);head.append(caption,close);
 const body=make('div','','hw-light-body'),area=make('div','','hw-image-area'),tools=make('div','','toolbar');
 const penBtn=make('button','畫筆','secondary'),color=make('input'),width=make('select');color.type='color';color.value='#db433f';color.setAttribute('aria-label','筆色');
 for(const [v,t] of [[.004,'細'],[.008,'中'],[.014,'粗']]){const o=make('option',t);o.value=v;width.append(o)}width.value='0.008';width.setAttribute('aria-label','畫筆粗細');
 const undo=make('button','復原一筆','secondary'),clear=make('button','清除批註','secondary');tools.append(penBtn,color,width,undo,clear);
 const stage=make('div','','hw-stage'),image=make('img'),canvas=make('canvas');image.alt='學生作品';canvas.setAttribute('aria-label','畫筆批註區');stage.append(image,canvas);
 const show=make('input');show.type='checkbox';show.checked=true;const showLabel=make('label','','hw-show');showLabel.append(show,document.createTextNode('顯示老師批註'));
 const frame=make('div','','hw-image-frame');frame.append(stage);
 const loadNote=make('p','','note');area.append(tools,loadNote,frame,showLabel,make('p','開啟畫筆後可使用滑鼠、手指或觸控筆。','note hw-pen-hint'));
 const side=make('div','','hw-feedback'),label=make('label','老師文字回饋'),feedback=make('textarea'),save=make('button','儲存批註與回饋');feedback.maxLength=2000;feedback.id=`review-note-${crypto.randomUUID()}`;label.htmlFor=feedback.id;
 const readOnly=make('p','','note');side.append(label,feedback,readOnly,save,message);body.append(area,side);light.append(head,body);
 function err(e){message.textContent=e.message||'無法讀取作品，請重新整理後再試。'}
 function pump(){while(active<2&&queue.length){active++;queue.shift()().finally(()=>{active--;pump()})}}
 function storedThumbnail(a,v){
  const cached=signed.get(v.id);if(cached&&cached.until>Date.now())return Promise.resolve(cached.url);
  let group=signGroups.get(a.id);
  if(!group){group=[];signGroups.set(a.id,group);const g=epoch;
   setTimeout(async()=>{if(signGroups.get(a.id)===group)signGroups.delete(a.id);if(g!==epoch){group.forEach(item=>item.resolve(null));return}try{
    const result=await request('thumbnail_urls',{assignment_id:a.id,upload_ids:group.map(x=>x.id)},false);
    for(const item of group){const url=g===epoch?result.urls[item.id]:null;if(url)signed.set(item.id,{url,until:Date.now()+240000});item.resolve(url||null)}
   }catch{group.forEach(item=>item.resolve(null))}},0);
  }
  return new Promise(resolve=>group.push({id:v.id,resolve}));
 }
 async function blob(a,v,small=false){const started=epoch;if(small){const saved=await storedThumbnail(a,v);if(started!==epoch)throw Error('登入身分已變更');if(saved)return saved}const key=`${v.id}:${small?'thumbnail':'original'}`;if(urls.has(key))return urls.get(key);if(pending.has(key))return pending.get(key);const g=epoch;
  const p=new Promise((resolve,reject)=>{queue[small?'push':'unshift'](async()=>{try{if(g!==epoch)throw Error('登入身分已變更');let b=await request('preview',{assignment_id:a.id,upload_id:v.id,...(small?{size:'thumbnail'}:{})},true);if(g!==epoch)throw Error('登入身分已變更');
   if(small){try{const derivative=await makeHomeworkThumbnail(b);if(g!==epoch)throw Error('登入身分已變更');await request('thumbnail_save',{assignment_id:a.id,upload_id:v.id,file:derivative},false);b=derivative}catch{/* Keep a readable preview when derivative persistence is unavailable. */}}
   if(g!==epoch)throw Error('登入身分已變更');const url=URL.createObjectURL(b);urls.set(key,url);resolve(url)}catch(e){reject(e)}});pump()});pending.set(key,p);try{return await p}finally{pending.delete(key)}}
 const isImage=v=>/\.(png|jpe?g|webp|gif)$/i.test(v.file_name)&&v.file_size<=30*1024*1024;
 const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);e.target.loadPreview?.()}},{rootMargin:'150px'});
 function thumbnail(a,v,open){const b=make('button','','hw-thumb');b.type='button';b.setAttribute('aria-label',`查看 ${v.file_name} 的作品與回饋`);const text=make('span',isImage(v)?'圖片載入中…':`${v.file_name} · 查看回饋`);b.append(text);b.onclick=open;
  if(isImage(v)){b.loadPreview=async()=>{try{const u=await blob(a,v,true);if(!b.isConnected)return;const im=make('img');im.alt=v.file_name;im.onload=()=>{if(b.isConnected)b.replaceChildren(im)};im.onerror=()=>text.textContent='縮圖無法顯示・點選查看原圖';im.src=u}catch(e){text.textContent=e.code==='thumbnail_pending'?'縮圖準備中・點選查看原圖':'縮圖暫時無法讀取・點選查看原圖'}};observer.observe(b)}return b}
 async function openHistory(a,user,name){const g=epoch;htitle.textContent=`${name}・繳交歷史`;versions.replaceChildren(make('p','讀取中…'));if(!history.open)history.showModal();try{const data=await request('history',{assignment_id:a.id,...(user?{user_id:user}:{})},false,true);if(g!==epoch)return;versions.replaceChildren();versions.style.setProperty('--columns',cols);
  data.versions.forEach((v,i)=>{const card=make('article','','hw-version');card.append(thumbnail(a,v,()=>openVersion(a,v,name,i+1)),make('h3',`第 ${i+1} 次繳交${v.latest?'・最新版':''}`),make('p',new Date(v.submitted_at).toLocaleString('zh-TW'),'note'),make('span',homeworkStatus[v.status],'badge '+v.status),make('p',v.feedback||'未附文字回饋','feedback'));if(v.strokes.length)card.append(make('p','有畫筆批註','note'));versions.append(card)});if(!data.versions.length)versions.append(make('p','尚無已繳交版本。'));}catch(e){versions.replaceChildren(make('p',e.message))}}
 async function openLatest(a,user,name){const data=await request('history',{assignment_id:a.id,...(user?{user_id:user}:{})},false,true);const v=data.versions.at(-1);if(v)await openVersion(a,v,name,data.versions.length)}
 const editable=()=>current&&current.v.latest&&isTeacher();
 function paint(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;const ctx=canvas.getContext('2d');ctx.scale(d,d);if(!show.checked)return;for(const l of lines){ctx.beginPath();ctx.strokeStyle=l.color;ctx.lineWidth=l.width*r.width;ctx.lineCap='round';ctx.lineJoin='round';l.points.forEach(([x,y],i)=>i?ctx.lineTo(x*r.width,y*r.height):ctx.moveTo(x*r.width,y*r.height));ctx.stroke()}}
 // Size the image and annotation canvas together, preserving normalized strokes.
 function fitImage(){if(stage.hidden||!image.naturalWidth)return;const r=frame.getBoundingClientRect();const scale=Math.min(r.width/image.naturalWidth,r.height/image.naturalHeight);stage.style.width=`${image.naturalWidth*scale}px`;stage.style.height=`${image.naturalHeight*scale}px`;paint()}
 const resize=new ResizeObserver(fitImage);resize.observe(frame);
 async function openVersion(a,v,name,n){current={a,v};dirty=false;pen=false;stroke=null;lines=structuredClone(v.strokes||[]);canvas.classList.remove('drawing');penBtn.setAttribute('aria-pressed','false');title.textContent=`${name}・第 ${n} 次繳交`;meta.textContent=`${v.latest?'最新版':'歷史版本・唯讀'} · ${new Date(v.submitted_at).toLocaleString('zh-TW')} · ${homeworkStatus[v.status]}`;feedback.value=v.feedback;feedback.readOnly=!editable();save.hidden=!editable();save.disabled=false;tools.querySelectorAll('button,input,select').forEach(b=>b.disabled=!editable()||!isImage(v));readOnly.textContent=editable()?'批註與文字另存於這個版本，不會改變評比結果。':'歷史版本與學生檢視僅供閱讀。';message.textContent='';show.checked=true;stage.hidden=true;image.removeAttribute('src');if(!light.open)light.showModal();loadNote.textContent=isImage(v)?'正在讀取作品…':'此檔案暫不提供圖片批註，可查看文字回饋。';const g=epoch;if(isImage(v))try{const u=await blob(a,v);if(g!==epoch||current?.v.id!==v.id)return;image.onload=()=>{stage.hidden=false;loadNote.textContent='';requestAnimationFrame(fitImage)};image.onerror=()=>{loadNote.textContent='圖片無法顯示，仍可留下文字回饋。';stage.hidden=true};image.src=u}catch(e){loadNote.textContent=e.message}}
 function closeLight(){if(saving)return;if(dirty&&!confirm('有未儲存的批註或文字，確定放棄？'))return;light.close();current=null;stroke=null;dirty=false}
 close.onclick=closeLight;light.oncancel=e=>{e.preventDefault();closeLight()};
 penBtn.onclick=()=>{pen=!pen;show.checked=true;penBtn.setAttribute('aria-pressed',String(pen));canvas.classList.toggle('drawing',pen);paint()};show.onchange=()=>{if(!show.checked){pen=false;canvas.classList.remove('drawing');penBtn.setAttribute('aria-pressed','false')}paint()};
 const point=e=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))]};
 canvas.onpointerdown=e=>{if(!pen||!editable()||saving||stroke)return;if(lines.length>=300){message.textContent='批註已達 300 筆，請先清除部分筆畫。';return}e.preventDefault();canvas.setPointerCapture(e.pointerId);stroke={color:color.value,width:Number(width.value),points:[point(e)],pointer:e.pointerId};lines.push(stroke);dirty=true};canvas.onpointermove=e=>{if(stroke&&stroke.pointer===e.pointerId&&stroke.points.length<4000){stroke.points.push(point(e));paint()}};
 const end=e=>{if(stroke?.pointer!==e.pointerId)return;if(stroke.points.length===1)stroke.points.push(stroke.points[0].map(x=>Math.min(1,x+.0001)));delete stroke.pointer;stroke=null;paint()};canvas.onpointerup=end;canvas.onpointercancel=end;
 undo.onclick=()=>{if(!saving){lines.pop();dirty=true;paint()}};clear.onclick=()=>{if(!saving){lines=[];dirty=true;paint()}};feedback.oninput=()=>dirty=true;
 save.onclick=async()=>{if(!editable()||saving||stroke)return;const g=epoch;const c=current;saving=true;save.disabled=true;feedback.readOnly=true;try{const data=await request('save',{assignment_id:c.a.id,upload_id:c.v.id,feedback:feedback.value,strokes:lines,annotation_updated_at:c.v.annotation_updated_at},false,true);if(g!==epoch)return;c.v.feedback=feedback.value;c.v.strokes=structuredClone(lines);c.v.annotation_updated_at=data.annotation_updated_at;dirty=false;message.textContent='批註與回饋已儲存。';await onSaved();if(history.open)history.close()}catch(e){if(g===epoch)err(e)}finally{saving=false;save.disabled=false;feedback.readOnly=!editable()}};
 function reset(){epoch++;signed.clear();signGroups.clear();observer.disconnect();urls.forEach(u=>URL.revokeObjectURL(u));urls.clear();pending.clear();history.close();light.close();versions.replaceChildren();image.removeAttribute('src');feedback.value='';lines=[];current=null;dirty=false;stroke=null}
 return {thumbnail,openHistory,openLatest,reset};
}
