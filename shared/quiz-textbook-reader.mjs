import {initImageLightbox} from './image-lightbox.js';
import {textbookBookPages} from './quiz-study-data.mjs';
import {textbookReadingDirection} from './quiz-textbook-settings.mjs';

// Book navigation only. Zoom, pan and touch belong to the shared lightbox.
export function createTextbookReader({root,getContext,pages,resolvePage=page=>page.url,lightbox}) {
  lightbox ||= initImageLightbox({root,selector:'[data-image-lightbox]'});
  const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn,cls='')=>{const n=make('button',text,cls);n.type='button';n.onclick=fn;return n;};
  const allPages=()=>typeof pages==='function'?pages():pages;
  const bookPages=()=>textbookBookPages(allPages(),current?.bookId);
  const bookName=()=>['國語','國文','英語','數學','社會','自然','地理','歷史','公民'].includes(root.dataset.subject)?root.dataset.subject+'課本':'課本';
  const byNumber=n=>allPages().find(p=>(!current?.bookId||p.bookId===current.bookId)&&p.printedPages.includes(Number(n)));
  const memories=new Map(),lastPages=new Map(),nodes=new WeakSet();
  let current=null,shown=null,article=null,opener=null,open=false,ready=false,disposed=false,generation=0,questionScroll=0;
  const toolbar=make('div',null,'qtb-book-toolbar'),title=make('strong'),status=make('p','', 'qtb-reading-status');status.setAttribute('role','status');
  const nav=make('div',null,'qtb-page-nav');
  const prev=button('‹',()=>adjacent(-1)),next=button('›',()=>adjacent(1)),home=button('本題頁',()=>show(current.primary));
  prev.setAttribute('aria-label','上一頁');next.setAttribute('aria-label','下一頁');home.setAttribute('aria-label','回本題頁');prev.title='上一頁';next.title='下一頁';home.title='回本題頁';
  const select=make('select');select.setAttribute('aria-label','選擇課本頁碼');select.onchange=()=>{if(select.value)show(Number(select.value));};
  const back=button('回到題目',()=>close()),retry=button('再試一次',()=>show(shown.printedPages[0],true));retry.hidden=true;
  nav.append(prev,select,next,home);toolbar.append(title,nav,status,retry);
  const remember=()=>{if(open&&ready&&current&&shown)memories.set(current.key+':'+shown.id,lightbox.getState());};
  function close(){++generation;remember();lightbox.close();open=false;ready=false;}
  function adjacent(direction){const sequence=bookPages(),p=sequence[sequence.indexOf(shown)+direction];if(p)show(p.printedPages[0]);}
  async function show(number,retryLoad=false){
    const page=byNumber(number);if(!page||!current||disposed)return;
    remember();shown=page;lastPages.set(current.key,page.printedPages[0]);ready=false;open=true;const token=++generation;
    title.textContent=bookName()+'・印刷第'+page.printedPages.join('–')+'頁'+(page.printedPages.length>1?'・完整拉頁':'');
    const sequence=bookPages();prev.disabled=sequence.indexOf(page)===0;next.disabled=sequence.indexOf(page)===sequence.length-1;select.value=String(page.printedPages[0]);
    select.setAttribute('aria-label','目前第'+page.printedPages.join('–')+'頁；選擇課本頁碼');
    status.textContent='正在開啟課本…';status.classList.remove('is-error');retry.hidden=true;
    const options={fit:'width',initialScale:.8,minScale:.2,zoomStep:.1,toolbar,closeLabel:back.textContent,state:memories.get(current.key+':'+page.id),onStateChange:state=>{if(ready&&token===generation)memories.set(current.key+':'+page.id,state);},onClose:()=>{
      ++generation;open=false;ready=false;window.scrollTo({top:questionScroll,behavior:'instant'});(opener?.isConnected?opener:article?.querySelector('.qtb-entry'))?.focus({preventScroll:true});
    }};
    try{
      const src=await resolvePage(page,{retry:retryLoad});if(token!==generation||disposed)return;
      const loaded=await lightbox.open(src,bookName()+'印刷第'+page.printedPages.join('、')+'頁',options);if(token!==generation||disposed)return;
      if(!loaded)throw Error('image_unavailable');ready=true;remember();status.textContent='首次以適合寬度的80%開啟；可放大、縮小及拖曳閱讀。';
    }catch{
      if(token!==generation||disposed)return;
      await lightbox.open('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E','課本暫時無法載入',{...options,state:undefined});
      if(token!==generation)return;status.classList.add('is-error');status.textContent='圖片暫時無法開啟，可先參考紙本課本第'+page.printedPages.join('–')+'頁，或返回繼續作答。';retry.hidden=false;
    }
  }
  function start(page,trigger){
    opener=trigger;questionScroll=window.scrollY;back.textContent='← 回到'+(trigger?.dataset.returnCaption||'題目');
    const direction=textbookReadingDirection(current.bookId),rtl=direction==='rtl';
    if(nav.dataset.readingDirection!==direction){
      nav.dataset.readingDirection=direction;prev.textContent=rtl?'›':'‹';next.textContent=rtl?'‹':'›';
      nav.replaceChildren(...(rtl?[next,select,prev,home]:[prev,select,next,home]));
    }
    select.replaceChildren(...bookPages().map(p=>{const related=p.printedPages.some(n=>current.references.includes(n)),o=make('option','第'+p.printedPages.join('–')+'頁'+(related?'（本題參考）':''));o.value=String(p.printedPages[0]);return o;}));
    show(page??lastPages.get(current.key)??current.primary);
  }
  function attach(){
    if(disposed)return;const articles=[...root.querySelectorAll('.question[data-question-id]')];
    if(!articles.length){if(open)close();++generation;current=null;shown=null;memories.clear();lastPages.clear();return;}
    let activeFound=false;
    for(const found of articles){const context=getContext(found);if(!context)continue;
    if(open&&current?.key===context.key){current=context;article=found;activeFound=true;}
    if(nodes.has(found))continue;nodes.add(found);
    const begin=(page,trigger)=>{if(open&&current?.key!==context.key)close();current=context;article=found;start(page,trigger);};
    let host=found.querySelector('.quiz-explanation-panel');if(!host){host=make('aside',null,'quiz-explanation-panel');found.append(host);}
    const feedback=found.querySelector('.answer-preview'),heading=host.querySelector(':scope>h3');if(heading)heading.textContent=feedback?'這題怎麼想？':'課本';
    host.querySelector('.quiz-explanation-placeholder')?.remove();
    if(!feedback){const card=make('section',null,'qtb-card');card.append(make('strong','一起翻翻課本，找找線索吧！'),make('p',bookName()+'第'+context.primary+'頁'),button('翻課本找線索',e=>begin(undefined,e.currentTarget),'qtb-entry qtb-open'));host.append(card);}
    for(const field of context.fields||[]){const target=found.querySelector(field.selector);if(target){const b=button('看課本第'+field.page+'頁',e=>begin(field.page,e.currentTarget),'qtb-field-entry');b.dataset.returnCaption=field.label;target.closest('.slot')?.append(b);}}
    if(feedback){const entry=button('對照課本第'+context.primary+'頁',e=>begin(undefined,e.currentTarget),'qtb-entry qtb-after-entry'),answerRow=feedback.querySelector('.quiz-answer-row');if(answerRow)answerRow.append(entry);else{const hint=make('div',null,'qtb-after-hint');hint.append(make('p',context.afterHint||'可以翻回課本，再對照一次。'),entry);feedback.append(hint);}}
    }
    if(open&&!activeFound)close();
  }
  const observer=new MutationObserver(attach);observer.observe(root,{childList:true,subtree:true});attach();
  return {close,destroy(){if(open)close();disposed=true;++generation;observer.disconnect();memories.clear();lastPages.clear();}};
}
