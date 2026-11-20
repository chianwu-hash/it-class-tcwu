import {initImageLightbox} from './image-lightbox.js';

const placeholder='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
const vendor=new URL('./vendor/pdfjs/',import.meta.url);

function element(tag,label){
 const node=document.createElement(tag);
 if(label)node.textContent=label;
 return node;
}
function button(text,action){
 const node=element('button',text);
 node.type='button';
 node.onclick=action;
 return node;
}

export function createPublisherTextbookReader(root){
 const lightbox=initImageLightbox({root});
 let active=null;

 function releaseChapter(session){
  if(session.loading)void session.loading.destroy().catch(()=>{});
  session.loading=null;
 }
 function finish(session){
  if(active!==session)return;
  active=null;
  session.rendering?.cancel();
  releaseChapter(session);
  if(session.imageUrl)URL.revokeObjectURL(session.imageUrl);
  session.trigger.focus({preventScroll:true});
  window.scrollTo({top:session.scrollTop,behavior:'instant'});
 }
 function close(){if(active)lightbox.close();}

 async function show(session,pdfPage){
  if(pdfPage<1||pdfPage>session.pageCount)return;
  const page={printed:session.firstPrinted+pdfPage-1,pdfPage,url:session.url};
  const sequence=++session.sequence;
  const current=()=>active===session&&session.sequence===sequence;
  session.pdfPage=pdfPage;
  session.rendering?.cancel();
  session.rendering=null;
  session.select.value=String(pdfPage);
  session.previous.disabled=true;
  session.next.disabled=true;
  const title='自然課本第'+page.printed+'頁';
  session.title.textContent=title;
  session.status.textContent='正在開啟課本…';
  session.status.classList.remove('is-error');
  session.retry.hidden=true;
  session.download.hidden=true;
  const options={fit:'width',initialScale:.8,minScale:.2,zoomStep:.1,toolbar:session.toolbar,closeLabel:'回到題目',onClose:()=>finish(session)};
  void lightbox.open(placeholder,title,options);

  const fail=()=>{
   session.status.textContent='這一頁暫時無法載入。';
   session.status.classList.add('is-error');
   session.retry.hidden=false;
   session.download.href=page.url;
   session.download.hidden=false;
  };
  const timeout=setTimeout(()=>{
   if(!current())return;
   ++session.sequence;
   session.rendering?.cancel();
   releaseChapter(session);
   fail();
  },20000);

  try{
   const pdf=await import('./vendor/pdfjs/pdf.min.mjs');
   if(!current())return;
   if(!session.loading){
    releaseChapter(session);
    pdf.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',vendor).href;
    session.loading=pdf.getDocument({
     url:page.url,withCredentials:false,
     disableAutoFetch:true,disableStream:true,rangeChunkSize:262144,
     cMapUrl:new URL('cmaps/',vendor).href,
     wasmUrl:new URL('wasm/',vendor).href,enableXfa:false,isEvalSupported:false,
    });
    session.url=page.url;
   }
   const book=await session.loading.promise;
   if(!current())return;
   session.pageCount=book.numPages;
   if(session.select.options.length!==book.numPages){
    session.select.replaceChildren(...Array.from({length:book.numPages},(_,i)=>{
     const option=element('option','第'+(session.firstPrinted+i)+'頁');
     option.value=String(i+1);
     return option;
    }));
   }
   session.select.value=String(pdfPage);
   const source=await book.getPage(page.pdfPage);
   if(!current())return;
   const viewport=source.getViewport({scale:2.55});
   const canvas=element('canvas');
   canvas.width=Math.ceil(viewport.width);
   canvas.height=Math.ceil(viewport.height);
   session.rendering=source.render({canvas,viewport});
   await session.rendering.promise;
   if(!current())return;
   const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));
   if(!current())return;
   if(!image)throw Error('textbook_page_unavailable');
   if(session.imageUrl)URL.revokeObjectURL(session.imageUrl);
   session.imageUrl=URL.createObjectURL(image);
   if(!await lightbox.open(session.imageUrl,title,options))throw Error('textbook_image_unavailable');
   if(current()){
    session.status.textContent='';
    session.previous.disabled=pdfPage===1;
    session.next.disabled=pdfPage===book.numPages;
   }
  }catch{
   if(!current())return;
   releaseChapter(session);
   fail();
  }finally{
   clearTimeout(timeout);
  }
 }

 function open(citation,index,trigger){
  close();
  const pages=citation.sections.flatMap(section=>section.pages.map((printed,i)=>({
   printed,pdfPage:section.pdfPages[i],url:section.downloadUrl,
  })));
  if(!pages[index])return;
  const toolbar=element('div');toolbar.className='qtb-book-toolbar';
  const title=element('strong'),status=element('p');
  status.className='qtb-reading-status';status.setAttribute('role','status');
  const nav=element('div');nav.className='qtb-page-nav';
  const select=element('select');select.setAttribute('aria-label','選擇本題的課本頁碼');
  const page=pages[index];
  const session={url:page.url,firstPrinted:page.printed-page.pdfPage+1,pageCount:Infinity,toolbar,title,status,select,trigger,scrollTop:window.scrollY,sequence:0};
  session.previous=button('‹',()=>void show(session,session.pdfPage-1));
  session.next=button('›',()=>void show(session,session.pdfPage+1));
  session.previous.setAttribute('aria-label','上一頁');
  session.next.setAttribute('aria-label','下一頁');
  session.retry=button('再試一次',()=>void show(session,session.pdfPage));
  session.download=element('a','下載出版社原檔');
  session.download.target='_blank';session.download.rel='noopener noreferrer';
  select.onchange=()=>void show(session,Number(select.value));
  nav.append(session.previous,select,session.next);
  toolbar.append(title,nav,status,session.retry,session.download);
  active=session;
  void show(session,page.pdfPage);
 }

 return {open,close};
}
