import {createCompanionChooser} from './garden-companions.mjs';
import {checkGardenUnlock} from './garden-unlock-notice.mjs';
import {createTreeSkinChooser} from './garden-tree-skin.mjs';
// This module never awards progress. Server-owned milestones are cosmetic only.
export function createGardenUpgrade({supabase,getSession,stage,onSelect}){
 const root=document.createElement('section');root.className='garden-upgrade';root.hidden=true;
 root.innerHTML=`<div data-scene></div><p class="garden-state" role="status"></p><div class="garden-actions"><button type="button" data-replay>重播我的成長</button><button type="button" data-prev>上一區</button><span data-page></span><button type="button" data-next>下一區</button></div><details data-pending-box hidden><summary>繼續練習</summary><ul data-pending-list></ul></details><details><summary>查看全部花葉與來源</summary><p>成果全部保留。樹冠每區最多呈現 96 葉、24 花。</p><ol data-list></ol><div class="garden-actions"><button type="button" data-list-prev>上一頁</button><span data-list-page></span><button type="button" data-list-next>下一頁</button></div></details>`;
 stage.after(root);
 const $=s=>root.querySelector(s),status=$('.garden-state');let version=0,frame=null,state=null,model=null,course=null,page=0,listPage=0,growth=null;
 const skin=createTreeSkinChooser({root,supabase,getSession,getFrame:()=>frame});
 const companion=createCompanionChooser({root,supabase,getSession,onChange:()=>send(),onCommand:action=>frame?.contentWindow?.postMessage({type:'garden-companion-command',action},location.origin)});
 const rpc=async(c,action='get')=>{const {data,error}=await supabase.rpc('garden_growth',{p_course_id:c,p_action:action});if(error)throw error;return data;};
 function reset(){version++;growth?.close(false);companion.reset();skin.reset();$('[data-pending-list]').replaceChildren();$('[data-pending-box]').hidden=true;frame?.remove();frame=null;root.hidden=true;root.querySelector('.garden-actions').hidden=false;$('[data-list]').replaceChildren();$('[data-scene]').replaceChildren();stage.hidden=false;state=null;model=null;course=null;page=0;listPage=0;}
 function ordered(kind){const byId=new Map(model.rewards.map(r=>[r.id,r]));return state.order.filter(r=>(r.kind==='flower')===kind).map(r=>byId.get(r.id)||null);}
 function pending(kind){const earned=new Set(model.rewards.map(r=>r.id));return ((kind?model.pendingFlowers:model.pendingLeaves)||[]).filter(r=>r&&!earned.has(r.id)&&safePracticeHref(r.href)).slice(0,kind?2:8)}
 function safePracticeHref(href){try{const u=new URL(href,location.href);return u.origin===location.origin&&/^\/grade[36]\//.test(u.pathname)?u.pathname+u.search+u.hash:null}catch{return null}}
 function pendingList(){const ul=$('[data-pending-list]');ul.replaceChildren();for(const r of [...pending(false),...pending(true)]){const li=document.createElement('li'),a=document.createElement('a');a.textContent=r.title||'繼續練習';a.href=safePracticeHref(r.href);li.append(a);ul.append(li)}$('[data-pending-box]').hidden=!ul.children.length}
 function pageCount(){return Math.max(1,Math.ceil(ordered(false).length/96),Math.ceil(ordered(true).length/24));}
 function send(){if(!frame||!model)return;frame.contentWindow?.postMessage({type:'garden-state',petUnlocked:!!companion.value.selectedPet,pet:companion.value.selectedPet,home:companion.value.selectedHome,homeVisible:companion.value.homeVisible===true,
  leaves:ordered(false).slice(page*96,(page+1)*96),flowers:ordered(true).slice(page*24,(page+1)*24),flowerStyle:document.documentElement.dataset.flower,treeSkin:skin.value,pendingLeaves:page===pageCount()-1?pending(false):[],pendingFlowers:page===pageCount()-1?pending(true):[]},location.origin);
  $('[data-page]').textContent=`樹冠第 ${page+1}／${pageCount()} 區`;$('[data-prev]').disabled=page===0;$('[data-next]').disabled=page+1>=pageCount();}
 function list(){pendingList();const items=model.rewards.slice(listPage*30,(listPage+1)*30),ol=$('[data-list]');ol.replaceChildren();for(const r of items){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=r.title;b.onclick=()=>{frame?.contentWindow?.__gardenShelterV21?.pause();onSelect(r);document.getElementById('detail-title')?.scrollIntoView({behavior:'smooth',block:'nearest'});};li.append(b);ol.append(li);}const pages=Math.max(1,Math.ceil(model.rewards.length/30));$('[data-list-page]').textContent=`${listPage+1}／${pages}`;$('[data-list-prev]').disabled=listPage===0;$('[data-list-next]').disabled=listPage+1>=pages;}
 function replay(){
  if(!model)return;if(growth){growth.frame.contentWindow.__growthPreview?.start();return;}
  const captured=version,c=course,uid=getSession()?.user?.id,host=$('[data-scene]'),scene=frame?.contentWindow?.__gardenScene;
  const wasPlaying=scene?.snapshot()?.manuallyPaused!==true,previousStatus=status.textContent,returnFocus=document.activeElement===root.querySelector('[data-replay]');
  const f=document.createElement('iframe');f.title='努力樹在主場景成長';f.className='garden-growth-inline';
  const controls=document.createElement('div');controls.className='garden-actions garden-growth-controls';
  const pause=document.createElement('button'),finish=document.createElement('button');pause.type=finish.type='button';pause.textContent='暫停成長';finish.textContent='直接看第二級努力樹';pause.disabled=true;
  controls.append(pause,finish);status.after(controls);
  const locked=[...root.querySelectorAll('[data-prev],[data-next],.garden-companions button,.garden-companions input,.garden-skins button')].map(el=>({el,disabled:el.disabled}));locked.forEach(({el})=>el.disabled=true);
  const inertPanels=[...document.querySelectorAll('.garden-companions,.garden-skins')].map(el=>({el,inert:el.inert}));inertPanels.forEach(({el})=>el.inert=true);
  let timer,closed=false,started=false;
  function close(resume=true,message='恭喜，努力樹長大到第二級了！原有花葉全部保留。'){
   if(closed)return;closed=true;clearTimeout(timer);window.removeEventListener('message',receive);f.remove();controls.remove();host.classList.remove('garden-is-growing');if(frame)frame.style.visibility='';
   locked.forEach(({el,disabled})=>el.disabled=disabled);inertPanels.forEach(({el,inert})=>el.inert=inert);growth=null;$('[data-replay]').textContent='重播我的成長';
   if(captured===version){status.textContent=message;if(resume&&wasPlaying)frame?.contentWindow?.__gardenScene?.play();if(returnFocus)$('[data-replay]').focus({preventScroll:true});}
  }
  async function receive(e){
   if(e.origin!==location.origin||e.source!==f.contentWindow||captured!==version||uid!==getSession()?.user?.id)return;
   if(e.data?.type==='growth-ready'){
    const byId=new Map(model.rewards.map(r=>[r.id,r]));f.contentWindow.postMessage({type:'growth-state',reducedMotion:frame?.contentWindow?.__gardenScene?.snapshot().reduced===true,rewards:state.baseline.map(r=>({...r,title:byId.get(r.id)?.title||'一路累積的成果'}))},location.origin);
   }else if(e.data?.type==='growth-started'){
    clearTimeout(timer);pause.disabled=false;pause.textContent='暫停成長';status.textContent='努力樹正在長大，每一片葉、每一朵花都陪著你。';
    if(!started&&!state.seen){started=true;try{await rpc(c,'seen');if(captured===version)state.seen=true;}catch{if(captured===version)status.textContent+=' 成長紀念尚未同步，下次仍可重看。';}}
   }else if(e.data?.type==='growth-complete'){clearTimeout(timer);timer=setTimeout(()=>close(),350);}
   else if(e.data?.type==='growth-error')close(true,'成長動畫暫時無法讀取，花葉全部保留。請按「重播我的成長」再試。');
  }
  growth={frame:f,close};window.addEventListener('message',receive);scene?.pause();if(frame)frame.style.visibility='hidden';host.classList.add('garden-is-growing');status.textContent='正在準備成長動畫，原有花葉全部保留。';$('[data-replay]').textContent='從頭再看';
  pause.onclick=()=>{const a=f.contentWindow.__growthPreview;a?.pause();pause.textContent=a?.snapshot().playing?'暫停成長':'繼續成長';};finish.onclick=()=>close(true,started?undefined:previousStatus);
  timer=setTimeout(()=>close(true,'成長動畫讀取較久，花葉全部保留。可以稍後重播。'),45000);
  f.src='/garden/growth/index.html?embedded=1&v=20261031-main-scene';host.append(f);host.scrollIntoView({behavior:'smooth',block:'start'});
 }
 $('[data-replay]').onclick=replay;$('[data-prev]').onclick=()=>{page=Math.max(0,page-1);send();};$('[data-next]').onclick=()=>{page=Math.min(pageCount()-1,page+1);send();};$('[data-list-prev]').onclick=()=>{listPage=Math.max(0,listPage-1);list();};$('[data-list-next]').onclick=()=>{listPage++;list();};
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='garden-companion-state')companion.sceneState(e.data.state);if(e.data?.type==='garden-ready')send();if(e.data?.type==='garden-scene-ready')skin.sceneReady();if(growth&&['garden-ready','garden-scene-ready'].includes(e.data?.type))frame.contentWindow.__gardenScene?.pause();if(e.data?.type==='garden-height'&&Number.isFinite(e.data.height))frame.style.height=Math.max(300,Math.min(2600,e.data.height))+'px';if(e.data?.type==='garden-pending'){const r=[...pending(false),...pending(true)].find(r=>r.id===e.data.id);const href=r&&safePracticeHref(r.href);if(href)location.assign(href);}if(e.data?.type==='garden-select'){const r=model?.rewards.find(r=>r.id===e.data.id);if(r)onSelect(r);}});
 new MutationObserver(send).observe(document.documentElement,{attributes:true,attributeFilter:['data-flower']});
 async function render(m,c){reset();if(!getSession()?.user||m.stats.leafCount+(m.stats.pastExamFlowerCount||0)<44||m.stats.flowerCount<10)return;const captured=version,uid=getSession().user.id;
  try{const data=await rpc(c);if(captured!==version||uid!==getSession()?.user?.id||data?.level!==2)return;
   // Refuse an inconsistent source snapshot rather than drawing unearned rewards.
   if(!Array.isArray(data.order)||!Array.isArray(data.baseline))throw Error('invalid_state');
   state=data;model=m;course=c;checkGardenUnlock(getSession(),c);root.hidden=false;stage.hidden=true;
   status.textContent='第二級努力樹・記錄你一路學習與練習的足跡。';
   await companion.load(c);if(captured!==version||uid!==getSession()?.user?.id)return;
   frame=document.createElement('iframe');frame.title='我的第二級努力樹';frame.src='/garden/stage.html?v=20261031-prerelease-fixes';$('[data-scene]').replaceChildren(frame);void skin.load();send();list();
   if(!data.seen)replay();
  }catch{if(captured!==version)return;root.hidden=false;status.textContent='成長狀態暫時無法同步，花葉仍保留。';const b=document.createElement('button');b.textContent='重新確認成長';b.type='button';b.onclick=()=>render(m,c);status.append(' ',b);root.querySelector('.garden-actions').hidden=true;}
 }
 return{render,reset};
}
