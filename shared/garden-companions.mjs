import {petName} from './garden-pet-names.mjs';
export function createCompanionChooser({root,supabase,getSession,onChange,onCommand=()=>{}}){
 const host=document.createElement('section');host.className='garden-companions';host.hidden=true;
 const heading=document.createElement('h3');heading.textContent='我的陪伴';
 const pets=document.createElement('div');pets.className='garden-companion-options';pets.setAttribute('role','group');pets.setAttribute('aria-label','選擇陪伴寵物');
 const homeTitle=document.createElement('h3');homeTitle.textContent='更換小窩';
 const homes=document.createElement('div');homes.className='garden-home-options';homes.setAttribute('role','group');homes.setAttribute('aria-label','選擇小窩');
 const status=document.createElement('p');status.setAttribute('role','status');
 const retry=document.createElement('button');retry.type='button';retry.textContent='重新讀取';retry.hidden=true;
 const controls=document.createElement('div');controls.className='garden-pet-controls';
 const toggle=document.createElement('input');toggle.type='checkbox';const label=document.createElement('label');label.append(toggle,' 顯示小窩');
 const walk=document.createElement('button');walk.type='button';walk.textContent='出來散步';const rest=document.createElement('button');rest.type='button';rest.textContent='回窩休息';
 const activity=document.createElement('p');activity.setAttribute('role','status');controls.append(label,walk,rest,activity);
 host.append(heading,pets,homeTitle,homes,controls,status,retry);(document.querySelector('.profile-card')||root).append(host);
 let value={pets:[],homes:[],selectedPet:null,selectedHome:null},course=null,version=0,busy=false,scene=null;
 const valid=(v,uid)=>v===version&&uid===getSession()?.user?.id;
 function button({name,image,selected,choose}){
  const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(selected));b.disabled=busy;
  const img=document.createElement('img');img.src=image;img.alt='';img.loading='lazy';const label=document.createElement('span');label.textContent=name;
  b.append(img,label);b.onclick=choose;return b;
 }
 function renderControls(){
  for(const b of [...pets.querySelectorAll('button'),...homes.querySelectorAll('button')])b.disabled=busy||!scene?.owned||scene.busy||scene.travelling;
  const available=!!value.selectedPet,blocked=busy||!scene||!scene.owned||scene.busy||scene.travelling;controls.hidden=!available;
  toggle.checked=scene?scene.visible:value.homeVisible===true;toggle.disabled=blocked||scene?.wet;
  walk.disabled=blocked||scene?.wet||scene?.mode==='walk';rest.disabled=blocked||scene?.mode==='rest';
  activity.textContent=!scene?'正在準備夥伴…':scene.wet?'外面雨大，讓牠在小窩休息一下。':scene.travelling?(scene.mode==='walk'&&!value.homeVisible?'正在走出小窩，出來後收起小窩。':'夥伴正在路上，等牠走好喔。'):scene.mode==='walk'&&scene.inside?(value.homeVisible?'夥伴準備走出小窩，等牠伸伸懶腰。':'夥伴準備走出小窩，出來後收起小窩。'):scene.inside?'夥伴正在小窩休息，點牠也能打招呼。':scene.mode==='rest'?'夥伴準備回窩休息。':'夥伴在樹旁散步。';
 }
 function render(){
  pets.replaceChildren(...value.pets.map(p=>button({name:petName(p.id),image:p.portrait,selected:p.id===value.selectedPet,choose:()=>save({pet:p.id})})));
  const showHomes=value.homes.length>1;homeTitle.hidden=homes.hidden=!showHomes;
  homes.replaceChildren(...value.homes.map(h=>button({name:h.name,image:h.preview,selected:h.home===value.selectedHome,choose:()=>save({pet:value.selectedPet,home:h.home})})));
  renderControls();
 }
 async function request(action,data={}){
  const response=await supabase.rpc('garden_companions',{p_course_id:course,p_action:action,p_data:data});
  if(response.error||!Array.isArray(response.data?.pets)||!Array.isArray(response.data?.homes))throw Error('unavailable');
  return response.data;
 }
 async function load(nextCourse){
  course=nextCourse;const v=++version,uid=getSession()?.user?.id;busy=true;retry.hidden=true;
  try{const next=await request('get');if(!valid(v,uid))return;value=next;host.hidden=!next.pets.length;status.textContent='';onChange(value)}
  catch{if(valid(v,uid)){host.hidden=false;status.textContent='陪伴設定暫時無法讀取，請稍後重試。';retry.hidden=false}}
  finally{if(valid(v,uid)){busy=false;render()}}
 }
 async function save(data){
  if(busy)return false;
  if((!data.pet||data.pet===value.selectedPet)&&(!data.home||data.home===value.selectedHome)&&(!Object.hasOwn(data,'homeVisible')||data.homeVisible===value.homeVisible)&&(!Object.hasOwn(data,'petMode')||data.petMode===(value.petMode||'walk')))return true;
  const v=version,uid=getSession()?.user?.id;busy=true;status.textContent='正在儲存選擇…';render();
  try{const next=await request('save',data);if(!valid(v,uid))return;value=next;onChange(value);status.textContent='選擇已儲存';return true}
  catch{if(valid(v,uid))status.textContent='這次選擇尚未儲存，請再試一次。';return false}
  finally{if(valid(v,uid)){busy=false;render()}}
 }
 toggle.onchange=async()=>{const visible=toggle.checked,v=version,uid=getSession()?.user?.id;if(scene?.wet){renderControls();return}if(await save(visible?{homeVisible:true}:{homeVisible:false,petMode:'walk'})&&valid(v,uid))onCommand(visible?'show':'hide');else renderControls()};
 walk.onclick=async()=>{if(walk.disabled)return;const v=version,uid=getSession()?.user?.id;if(await save({petMode:'walk'})&&valid(v,uid))onCommand('walk')};
 rest.onclick=async()=>{if(rest.disabled)return;const v=version,uid=getSession()?.user?.id;if(await save({homeVisible:true,petMode:'rest'})&&valid(v,uid))onCommand('rest')};
 retry.onclick=()=>load(course);
 return {load,sceneState(next){scene=next;renderControls()},get value(){return value},reset(){scene=null;version++;course=null;busy=false;value={pets:[],homes:[],selectedPet:null,selectedHome:null};host.hidden=true;pets.replaceChildren();homes.replaceChildren();status.textContent='';retry.hidden=true}};
}
