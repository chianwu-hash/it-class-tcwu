const SKINS=['a','b'];
export function createTreeSkinChooser({root,supabase,getSession,getFrame}) {
 const box=document.createElement('fieldset');box.className='garden-skins';box.innerHTML='<legend>第二級禮物・樹型外觀</legend><p>換個樹型，原有花葉都會保留。</p><div class="garden-skin-options"><button type="button" data-skin="a" aria-pressed="true"><img src="/garden/assets/processed/tree-candidates/tree-a.webp" alt="" width="56" height="70">舒展大樹</button><button type="button" data-skin="b" aria-pressed="false"><img src="/garden/assets/processed/tree-candidates/tree-b.webp" alt="" width="56" height="70">層層大樹</button></div><p data-skin-status role="status"></p><button type="button" data-skin-retry hidden>重新讀取外觀</button>';
 root.querySelector('[data-scene]').after(box);
 const buttons=[...box.querySelectorAll('[data-skin]')],status=box.querySelector('[data-skin-status]'),retry=box.querySelector('[data-skin-retry]');
 let value='a',version=0,loaded=false,busy=false,sceneReady=false;
 const controls=()=>buttons.forEach(b=>{b.disabled=!loaded||busy||!sceneReady;b.setAttribute('aria-pressed',String(b.dataset.skin===value))});
 const valid=(v,uid)=>v===version&&uid===getSession()?.user?.id;
 async function load(){const v=++version,uid=getSession()?.user?.id;loaded=false;retry.hidden=true;status.textContent='正在讀取樹型外觀…';controls();
  try{const {data,error}=await supabase.rpc('garden_tree_skin',{p_skin:null});if(!valid(v,uid))return;if(error||!SKINS.includes(data?.skin))throw Error('skin_unavailable');value=data.skin;loaded=true;getFrame()?.contentWindow?.__gardenShelterV21?.setTree(value);status.textContent='外觀會儲存在你的帳號，下次回來也會保留。';}
  catch{if(valid(v,uid)){status.textContent='外觀設定暫時無法讀取，請稍後重試。';retry.hidden=false;}}
  finally{if(valid(v,uid)){sceneReady=!!getFrame()?.contentWindow?.__gardenShelterV21?.snapshot().ready;controls()}}
 }
 async function choose(next){if(!loaded||busy||!sceneReady||next===value)return;const v=version,uid=getSession()?.user?.id;busy=true;controls();status.textContent='正在儲存樹型外觀…';
  try{const {data,error}=await supabase.rpc('garden_tree_skin',{p_skin:next});if(!valid(v,uid))return;if(error||data?.skin!==next)throw Error('skin_save_failed');value=next;status.textContent='正在換上新的樹型…';controls();await getFrame()?.contentWindow?.__gardenShelterV21?.changeTreeSkin(next);if(valid(v,uid))status.textContent='新外觀已儲存，原有花葉都在！';}
  catch{if(valid(v,uid))status.textContent='外觀暫時未能更新，請再試一次。';}
  finally{if(valid(v,uid)){busy=false;controls()}}
 }
 buttons.forEach(b=>b.onclick=()=>choose(b.dataset.skin));retry.onclick=load;controls();
 return {get value(){return value},load,sceneReady(){sceneReady=true;controls()},reset(){version++;value='a';loaded=false;busy=false;sceneReady=false;status.textContent='';retry.hidden=true;controls()}};
}
