// Complete symbol sets only; never accepted answers or submission state.
let activeKeyboard=null,keyboardId=0;
export function attachPastInputKeyboard(host,input,{bopomofo=false,punctuation=false,math=false}={}){
 if(input.disabled||(!bopomofo&&!punctuation&&!math))return;
 const doc=host.ownerDocument||document,view=doc.defaultView,sets=[];
 if(bopomofo)sets.push(['bopomofo','注音鍵盤',[...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˊˇˋ˙']]);
 if(punctuation)sets.push(['punctuation','標點鍵盤',['，','。','、','：','；','？','！','「','」','『','』','（','）','《','》','〈','〉','——','……','‧','—','－','‧','…']]);
 if(math)sets.push(['math','數學符號',['π','sqrt(',')','(', '/', '+','−','*',',','<','>']]);
 const tools=doc.createElement('div');tools.className='past-input-tools';host.append(tools);
 for(const [kind,title,keys] of sets){
  const toggle=doc.createElement('button'),panel=doc.createElement('div'),header=doc.createElement('div'),heading=doc.createElement('strong'),closeButton=doc.createElement('button'),grid=doc.createElement('div');
  toggle.type='button';toggle.className='past-input-toggle';toggle.textContent=title;toggle.setAttribute('aria-expanded','false');
  panel.hidden=true;panel.className='past-input-popover';panel.id=(input.id||'answer-keyboard-'+(++keyboardId))+'-'+kind;panel.setAttribute('popover','manual');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-label',title);toggle.setAttribute('aria-controls',panel.id);
  header.className='past-input-header';heading.textContent=title;closeButton.type='button';closeButton.className='past-input-close';closeButton.textContent='關閉 ×';closeButton.setAttribute('aria-label','關閉'+title);header.append(heading,closeButton);
  grid.className='past-input-keyboard';grid.setAttribute('role','group');grid.setAttribute('aria-label',title+'按鍵');panel.append(header,grid);
  let opened=false,events=null,observer=null,resizeObserver=null,oldInputMode=null,changedInputMode=false;
  const close=(restoreFocus=false)=>{
   if(!opened)return;opened=false;events?.abort();events=null;observer?.disconnect();observer=null;resizeObserver?.disconnect();resizeObserver=null;
   if(typeof panel.hidePopover==='function'&&panel.matches(':popover-open'))panel.hidePopover();
   panel.hidden=true;toggle.setAttribute('aria-expanded','false');
   if(changedInputMode){if(oldInputMode===null)input.removeAttribute('inputmode');else input.setAttribute('inputmode',oldInputMode);changedInputMode=false;}
   if(activeKeyboard?.panel===panel)activeKeyboard=null;
   if(restoreFocus&&toggle.isConnected!==false)toggle.focus({preventScroll:true});
  };
  const position=()=>{
   if(!view||!opened)return;
   if(input.isConnected===false||panel.isConnected===false||input.disabled){close();return;}
   const viewport=view.visualViewport,left=(viewport?.offsetLeft||0)+12,top=(viewport?.offsetTop||0)+12,right=left+(viewport?.width||view.innerWidth)-24;
   let bottom=top+(viewport?.height||view.innerHeight)-24;
   for(const dock of doc.querySelectorAll('.quiz-workspace-dock')){const r=dock.getBoundingClientRect();if(r.height&&r.top>top&&r.top<bottom)bottom=r.top-10;}
   const width=Math.min(520,right-left),room=bottom-top;if(room<120){close();return;}
   // Size to every key, rather than cutting the default off at 380px.
   panel.style.width=width+'px';panel.style.maxHeight=room+'px';
   const rect=input.getBoundingClientRect(),height=Math.min(panel.getBoundingClientRect().height,room);let x,y;
   if((viewport?.width||view.innerWidth)>=900&&rect.right+width+12<=right){x=rect.right+10;y=Math.max(top,Math.min(rect.top,bottom-height));}
   else{x=Math.max(left,Math.min(rect.left,right-width));y=bottom-height;if((viewport?.width||view.innerWidth)>=700&&rect.bottom+height+10<bottom)y=rect.bottom+10;else if(rect.top-height-10>=top)y=rect.top-height-10;}
   panel.style.left=x+'px';panel.style.top=Math.max(top,Math.min(y,bottom-height))+'px';
  };
  const open=()=>{
   if(input.disabled||input.isConnected===false)return;
   if(opened){close(true);return;}activeKeyboard?.close();opened=true;activeKeyboard={panel,close};
   const label=input.closest?.('.quiz-field')?.querySelector('legend')?.textContent||input.getAttribute?.('aria-label')||'';heading.textContent=label?label+' · '+title:title;
   panel.hidden=false;if(typeof panel.showPopover==='function')panel.showPopover();toggle.setAttribute('aria-expanded','true');
   if(view?.matchMedia('(pointer:coarse)').matches&&kind!=='math'){oldInputMode=input.getAttribute('inputmode');input.setAttribute('inputmode','none');changedInputMode=true;}
   position();
   if(view&&opened){
    const r=input.getBoundingClientRect(),p=panel.getBoundingClientRect();
    if(r.top<12||r.bottom>p.bottom||(r.bottom>p.top-10&&r.top<p.bottom&&r.left<p.right&&r.right>p.left)){
     const margin=input.style.scrollMarginBlockStart;
     input.style.scrollMarginBlockStart=Math.max(12,Math.min(88,p.top-r.height-12))+'px';
     try{input.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});}finally{input.style.scrollMarginBlockStart=margin;}
     position();
    }
    events=new view.AbortController();const signal=events.signal;
    doc.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&!tools.contains(e.target)&&e.target!==input)close();},{capture:true,signal});
    doc.addEventListener('focusin',e=>{if(e.target!==input&&!panel.contains(e.target)&&!tools.contains(e.target))close();},{signal});
    doc.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(true);}},{signal});
    view.addEventListener('resize',position,{signal});doc.addEventListener('scroll',position,{capture:true,signal});view.visualViewport?.addEventListener('resize',position,{signal});view.visualViewport?.addEventListener('scroll',position,{signal});
    observer=new view.MutationObserver(()=>{if(!input.isConnected||!panel.isConnected||input.disabled)close();});observer.observe(doc.documentElement,{childList:true,subtree:true});observer.observe(input,{attributes:true,attributeFilter:['disabled']});
    resizeObserver=new view.ResizeObserver(position);resizeObserver.observe(panel);resizeObserver.observe(input);for(const dock of doc.querySelectorAll('.quiz-workspace-dock'))resizeObserver.observe(dock);
   }
  };
  const insert=text=>{if(input.disabled||input.isConnected===false)return;const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;if(input.maxLength>0&&input.value.length-(end-start)+text.length>input.maxLength)return;input.setRangeText(text,start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});};
  for(const key of [...new Set(keys)]){const b=doc.createElement('button');b.type='button';b.textContent=key;b.setAttribute('aria-label','輸入'+key);b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>insert(key));grid.append(b);}
  const back=doc.createElement('button');back.type='button';back.textContent='刪除';back.className='past-input-delete';back.addEventListener('pointerdown',e=>e.preventDefault());back.addEventListener('click',()=>{let start=input.selectionStart??input.value.length,end=input.selectionEnd??start;if(start===end)start=Math.max(0,start-(Array.from(input.value.slice(0,start)).at(-1)?.length||0));input.setSelectionRange(start,end);insert('');});grid.append(back);
  closeButton.addEventListener('click',()=>close(true));toggle.addEventListener('click',open);panel.addEventListener('toggle',e=>{if(e.newState==='closed'&&opened)close();});tools.append(toggle);host.append(panel);
 }
}
