import {createTreeSkinChooser} from './garden-tree-skin.mjs';
// This module never awards progress. Server-owned milestones are cosmetic only.
export function createGardenUpgrade({supabase,getSession,stage,onSelect}){
 const root=document.createElement('section');root.className='garden-upgrade';root.hidden=true;
 root.innerHTML=`<div data-scene></div><p class="garden-state" role="status"></p><div class="garden-actions"><button type="button" data-replay>重播我的成長</button><button type="button" data-prev>上一區</button><span data-page></span><button type="button" data-next>下一區</button></div><details><summary>查看全部花葉與來源</summary><p>成果全部保留。樹冠每區最多呈現 96 葉、24 花。</p><ol data-list></ol><div class="garden-actions"><button type="button" data-list-prev>上一頁</button><span data-list-page></span><button type="button" data-list-next>下一頁</button></div></details>`;
 stage.after(root);
 const $=s=>root.querySelector(s),status=$('.garden-state');let version=0,frame=null,state=null,model=null,course=null,page=0,listPage=0,dialog=null;
 const skin=createTreeSkinChooser({root,supabase,getSession,getFrame:()=>frame});
 const rpc=async(c,action='get')=>{const {data,error}=await supabase.rpc('garden_growth',{p_course_id:c,p_action:action});if(error)throw error;return data;};
 function reset(){skin.reset();version++;frame?.remove();frame=null;dialog?.close();dialog?.remove();dialog=null;root.hidden=true;root.querySelector('.garden-actions').hidden=false;$('[data-list]').replaceChildren();$('[data-scene]').replaceChildren();stage.hidden=false;state=null;model=null;course=null;page=0;listPage=0;}
 function ordered(kind){const byId=new Map(model.rewards.map(r=>[r.id,r]));return state.order.filter(r=>(r.kind==='flower')===kind).map(r=>byId.get(r.id)||null);}
 function pageCount(){return Math.max(1,Math.ceil(ordered(false).length/96),Math.ceil(ordered(true).length/24));}
 function send(){if(!frame||!model)return;frame.contentWindow?.postMessage({type:'garden-state',petUnlocked:state.petUnlocked,
  leaves:ordered(false).slice(page*96,(page+1)*96),flowers:ordered(true).slice(page*24,(page+1)*24),flowerStyle:document.documentElement.dataset.flower,treeSkin:skin.value},location.origin);
  $('[data-page]').textContent=`樹冠第 ${page+1}／${pageCount()} 區`;$('[data-prev]').disabled=page===0;$('[data-next]').disabled=page+1>=pageCount();}
 function list(){const items=model.rewards.slice(listPage*30,(listPage+1)*30),ol=$('[data-list]');ol.replaceChildren();for(const r of items){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=r.title;b.onclick=()=>{frame?.contentWindow?.__gardenShelterV21?.pause();onSelect(r);document.getElementById('detail-title')?.scrollIntoView({behavior:'smooth',block:'nearest'});};li.append(b);ol.append(li);}const pages=Math.max(1,Math.ceil(model.rewards.length/30));$('[data-list-page]').textContent=`${listPage+1}／${pages}`;$('[data-list-prev]').disabled=listPage===0;$('[data-list-next]').disabled=listPage+1>=pages;}
 function replay(){if(!model||dialog)return;const captured=version,c=course,uid=getSession()?.user?.id;
  dialog=document.createElement('dialog');dialog.className='garden-growth-dialog';dialog.dataset.firstGrowth=String(!state.seen);dialog.setAttribute('aria-labelledby','growth-congratulations');
  const close=document.createElement('button');close.type='button';close.textContent='回到我的努力樹';
  const celebration=document.createElement('header');celebration.className='garden-celebration';
  const mark=document.createElement('span');mark.className='garden-celebration-mark';mark.setAttribute('aria-hidden','true');mark.textContent=state.seen?'🌳':'🌱 ✨';
  const message=document.createElement('div'),heading=document.createElement('h2'),description=document.createElement('p');heading.id='growth-congratulations';heading.textContent=state.seen?'回看我的成長紀念':'恭喜，努力樹長大了！';description.textContent=state.seen?'原有的每一份成果，都陪著樹一起長大。':'你持續累積的練習，讓努力樹成長到第二級。原有花葉全部保留，新的背景與天氣也開啟了！';
  if(!state.seen)message.setAttribute('role','status');message.append(heading,description);celebration.append(mark,message);
  const f=document.createElement('iframe');f.title='努力樹成長紀念';f.src='/garden/growth/index.html?v=20261030-release';dialog.append(close,celebration,f);document.body.append(dialog);close.onclick=()=>dialog?.close();dialog.addEventListener('close',()=>{dialog?.remove();dialog=null;frame?.contentWindow?.__gardenShelterV21?.play();},{once:true});frame?.contentWindow?.__gardenShelterV21?.pause();dialog.showModal();close.focus();
  const receive=async e=>{if(e.origin!==location.origin||e.source!==f.contentWindow||e.data?.type!=='growth-ready')return;window.removeEventListener('message',receive);if(captured!==version||uid!==getSession()?.user?.id)return;const byId=new Map(model.rewards.map(r=>[r.id,r]));f.contentWindow.postMessage({type:'growth-state',rewards:state.baseline.map(r=>({...r,title:byId.get(r.id)?.title||'一路累積的成果'}))},location.origin);
   if(!state.seen){try{await rpc(c,'seen');if(captured===version)state.seen=true;}catch{if(captured===version)status.textContent+=' 成長紀念尚未同步，下次仍可重看。';}}
  };window.addEventListener('message',receive);dialog.addEventListener('close',()=>window.removeEventListener('message',receive),{once:true});
 }
 $('[data-replay]').onclick=replay;$('[data-prev]').onclick=()=>{page=Math.max(0,page-1);send();};$('[data-next]').onclick=()=>{page=Math.min(pageCount()-1,page+1);send();};$('[data-list-prev]').onclick=()=>{listPage=Math.max(0,listPage-1);list();};$('[data-list-next]').onclick=()=>{listPage++;list();};
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='garden-ready')send();if(e.data?.type==='garden-scene-ready')skin.sceneReady();if(e.data?.type==='garden-height'&&Number.isFinite(e.data.height))frame.style.height=Math.max(300,Math.min(2600,e.data.height))+'px';if(e.data?.type==='garden-select'){const r=model?.rewards.find(r=>r.id===e.data.id);if(r)onSelect(r);}});
 new MutationObserver(send).observe(document.documentElement,{attributes:true,attributeFilter:['data-flower']});
 async function render(m,c){reset();if(!getSession()?.user||m.stats.leafCount<44||m.stats.flowerCount<10)return;const captured=version,uid=getSession().user.id;
  try{const data=await rpc(c);if(captured!==version||uid!==getSession()?.user?.id||data?.level!==2)return;
   // Refuse an inconsistent source snapshot rather than drawing unearned rewards.
   if(!Array.isArray(data.order)||!Array.isArray(data.baseline))throw Error('invalid_state');
   state=data;model=m;course=c;root.hidden=false;stage.hidden=true;
   status.textContent='第二級努力樹・記錄你一路學習與練習的足跡。';
   frame=document.createElement('iframe');frame.title='我的第二級努力樹';frame.src='/garden/stage.html?v=20261030-release';$('[data-scene]').replaceChildren(frame);void skin.load();send();list();
   if(!data.seen)replay();
  }catch{if(captured!==version)return;root.hidden=false;status.textContent='成長狀態暫時無法同步，花葉仍保留。';const b=document.createElement('button');b.textContent='重新確認成長';b.type='button';b.onclick=()=>render(m,c);status.append(' ',b);root.querySelector('.garden-actions').hidden=true;}
 }
 return{render,reset};
}
