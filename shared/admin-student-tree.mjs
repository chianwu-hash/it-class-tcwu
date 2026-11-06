import {createLearningRequest,learningError,beginLearningTeacherLogin} from './admin-learning-api.mjs';
import {teacherTreeModel,teacherTreeScene} from './admin-student-tree-model.mjs';
import {renderRewardTree,selectReward} from './reward-tree-renderer.js?v=20261106-keepsake';
import {LEAF_SLOTS,FLOWER_SLOTS} from './reward-tree-config.js';

export async function mountTeacherTree(){
 const $=id=>document.getElementById(id),make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const q=new URLSearchParams(location.search),course=q.get('course'),cls=q.get('class_code'),seat=q.get('seat_no');
 $('notice-card').setAttribute('role','status');$('notice-card').setAttribute('aria-live','polite');
 document.title='學生努力樹・教師檢視';document.documentElement.dataset.rewardColorMode='source';document.documentElement.dataset.flower='sunrise';
 document.querySelector('h1').textContent='學生努力樹・教師檢視';
 document.querySelector('.palette-card').hidden=true;$('course-select').hidden=true;
 const actions=document.querySelector('.actions');actions.replaceChildren();
 const back=make('a','返回學生學習檔案');back.href='/admin-learning.html';back.className='btn';actions.append(back);
 const login=make('button','教師登入'),refresh=make('button','重新讀取');for(const el of [login,refresh]){el.type='button';el.className='btn';actions.append(el);}
 const teacher=make('p'),banner=make('p','教師唯讀檢視｜顯示已儲存的努力樹、寵物與小窩，不觸發升級或更動學生紀錄。');
 banner.className='notice-card';document.querySelector('.topbar').after(banner,teacher);
 const stage=$('tree-level-one'),shell=stage.parentElement,host=make('section');host.className='garden-upgrade';host.hidden=true;shell.append(host);
 const pages=make('div');pages.className='garden-actions';shell.append(pages);
 const sources=make('details'),sourceTitle=make('summary','查看花葉來源'),sourceList=make('ol'),sourcePages=make('div');sourcePages.className='garden-actions';sources.append(sourceTitle,sourceList,sourcePages);document.querySelector('.side-panel').append(sources);
 const info=make('details'),infoTitle=make('summary','場景資訊'),diagnostics=make('p'),inspect=make('button','更新場景資訊');inspect.type='button';inspect.className='btn';info.append(infoTitle,diagnostics,inspect);document.querySelector('.side-panel').append(info);
 const note=make('p','花色偏好目前儲存在學生自己的裝置；此檢視採用學習來源配色。寵物的隨機位置與天氣動畫不代表學生此刻螢幕截圖。');note.className='notice-card';document.querySelector('.side-panel').append(note);
 let auth,session=null,request,epoch=0,controller,frame=null,model=null,scene=null,data=null,page=0,listPage=0;
 function status(text,error=false){$('notice-card').hidden=false;$('notice-card').classList.toggle('error',error);$('notice-card').textContent=text;}
 function clear(){
  epoch++;controller?.abort();frame?.remove();frame=null;model=scene=data=null;
  shell.hidden=true;host.replaceChildren();host.hidden=true;stage.hidden=false;pages.replaceChildren();sources.open=info.open=false;
  sourceList.replaceChildren();sourcePages.replaceChildren();diagnostics.textContent='尚未讀取';
  $('reward-layer').replaceChildren();$('profile-title').textContent='尚未讀取學生';$('profile-meta').textContent='';$('subtitle').textContent='請以教師身分讀取名冊中的學生。';
  $('leaf-count').textContent=$('flower-count').textContent='—';$('leaf-text').textContent=$('flower-text').textContent='尚未讀取';
  $('detail-title').textContent='選一片葉子或一朵花';$('detail-text').textContent='點選花葉查看學習來源。';
 }
 function showReward(r){
  selectReward(r,$('detail-title'),$('detail-text'));
  // Student source URLs may initialize writable student flows. Do not expose them here.
  for(const a of $('detail-text').querySelectorAll('a'))a.replaceWith(make('span',a.textContent));
  if(!sources.contains(document.activeElement))$('detail-title').scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 const button=(text,fn,disabled=false)=>{const b=make('button',text);b.type='button';b.className='btn';b.disabled=disabled;b.onclick=fn;return b;};
 const ordered=flower=>{const byId=new Map(model.rewards.map(r=>[r.id,r]));return scene.order.filter(r=>(r.kind==='flower')===flower).map(r=>byId.get(r.id)||null);};
 function diagnosticsText(){
  if(!model)return;const snap=frame?.contentWindow?.__gardenScene?.snapshot();
  diagnostics.textContent=`第 ${scene.level} 級・${model.leaves.length} 葉／${model.flowers.length} 花・樹型 ${scene.treeSkin.toUpperCase()}・寵物 ${{cat:'貓咪',dog:'小狗',rabbit:'兔子'}[scene.pet]||'無'}・小窩 ${scene.home?.toUpperCase()||'無'}（${scene.homeVisible?'顯示':'收起'}）・${scene.petMode==='rest'?'休息':'散步'}。`+
   (frame?` 場景${snap?.ready?'已就緒':'載入中'}；素材問題：${snap?.assetIssues?.map(x=>x.text).join('、')||'未回報'}。`:
    document.querySelector('.tree-image').complete&&!document.querySelector('.tree-image').naturalWidth?' 第一級樹形素材載入失敗，請重新整理。':' 使用學生端第一級樹形。');
 }
 function send(){
  if(!frame||!model)return;
  frame.contentWindow?.postMessage({type:'garden-state',...scene,petUnlocked:!!scene.pet,
   leaves:ordered(false).slice(page*96,(page+1)*96),flowers:ordered(true).slice(page*24,(page+1)*24),
   rewardColorMode:'source',flowerStyle:'sunrise',pendingLeaves:[],pendingFlowers:[],surpriseAllowed:false,surpriseDecision:false,surpriseMessage:false},location.origin);
 }
 function draw(){
  if(!model)return;
  const size=scene.level===2?96:LEAF_SLOTS.length,flowerSize=scene.level===2?24:FLOWER_SLOTS.length;
  const total=Math.max(1,Math.ceil((scene.level===2?ordered(false).length:model.leaves.length)/size),Math.ceil((scene.level===2?ordered(true).length:model.flowers.length)/flowerSize));
  pages.replaceChildren(button('上一區',()=>{page--;draw();},page===0),make('span',`樹冠第 ${page+1}／${total} 區`),button('下一區',()=>{page++;draw();},page+1>=total));
  if(scene.level===2)send();else renderRewardTree({layer:$('reward-layer'),leaves:model.leaves.slice(page*size,(page+1)*size),flowers:model.flowers.slice(page*flowerSize,(page+1)*flowerSize),pendingLeaves:[],pendingFlowers:[],leafSlots:LEAF_SLOTS,flowerSlots:FLOWER_SLOTS,onSelect:showReward,ghostLeafCount:0,ghostFlowerCount:0});
  diagnosticsText();
 }
 function list(){
  sourceList.replaceChildren();sourceList.start=listPage*30+1;
  for(const r of model.rewards.slice(listPage*30,(listPage+1)*30)){const li=make('li');li.append(button(r.title,()=>showReward(r)));sourceList.append(li);}
  const total=Math.max(1,Math.ceil(model.rewards.length/30));
  sourcePages.replaceChildren(button('上一頁',()=>{listPage--;list();},listPage===0),make('span',`${listPage+1}／${total}`),button('下一頁',()=>{listPage++;list();},listPage+1>=total));
 }
 async function load(){
  clear();refresh.disabled=true;
  if(!auth.isTeacher(session)){status('請使用具有權限的教師帳號登入。',true);return;}
  const version=epoch,owner=session.user.id;controller=new AbortController();status('正在讀取學生努力樹…');
  try{
   const result=await request('tree_snapshot',course,{class_code:cls,seat_no:Number(seat)},controller.signal);
   if(version!==epoch||session?.user?.id!==owner)return;
   if(result.identity?.class_code!==cls||Number(result.identity?.seat_no)!==Number(seat))throw Error('invalid_tree_snapshot');
   const nextModel=teacherTreeModel(result,course),nextScene=teacherTreeScene(result,nextModel);
   data=result;model=nextModel;scene=nextScene;page=listPage=0;
   $('profile-title').textContent=result.identity.display_name;$('profile-meta').textContent=`${cls} 班 ${seat} 號・${course}`;
   $('subtitle').textContent=`${result.identity.display_name}的努力樹｜資料時間：${new Date(result.as_of).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（臺灣時間）`;
   $('leaf-count').textContent=model.leaves.length;$('flower-count').textContent=model.flowers.length;$('leaf-text').textContent='已入帳葉片';$('flower-text').textContent='已入帳花朵';
   shell.hidden=false;
   if(scene.level===2){stage.hidden=true;host.hidden=false;frame=make('iframe');frame.title='學生目前的第二級努力樹（教師唯讀檢視）';frame.src='/garden/stage.html?v=20261106-keepsake';host.append(frame);}
   draw();list();status(scene.warning||'已讀取目前儲存的努力樹；教師檢視不會更動學生紀錄。');
  }catch(error){if(version!==epoch)return;clear();status(learningError(error),true);}
  finally{if(auth.isTeacher(session))refresh.disabled=false;}
 }
 clear();
 if(!/^grade[3469]-115-1$/.test(course||'')||!new RegExp(`^${course?.[5]}[0-9]{2}$`).test(cls||'')||!/^([1-9]|[1-9][0-9])$/.test(seat||'')){status('學生或課程參數不完整，請從教師後台重新開啟。',true);login.hidden=true;refresh.disabled=true;return;}
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame?.contentWindow||!model)return;
  if(e.data?.type==='garden-ready')send();
  if(e.data?.type==='garden-scene-ready')diagnosticsText();
  if(e.data?.type==='garden-height'&&Number.isFinite(e.data.height))frame.style.height=Math.max(300,Math.min(2600,e.data.height))+'px';
  if(e.data?.type==='garden-select'){const r=model.rewards.find(r=>r.id===e.data.id);if(r)showReward(r);}
 });
 inspect.onclick=diagnosticsText;refresh.onclick=load;
 auth=await import('./auth.js');request=createLearningRequest({auth,getSession:()=>session});
 login.onclick=async()=>{try{await beginLearningTeacherLogin({auth,session,returnTo:location.href});}catch{status('教師登入未完成，請重試。',true);}};
 function identity(next){
  const prior=session?.user?.id;session=next;
  teacher.textContent=next?.user?.email?`目前登入：${next.user.email}`:'尚未登入教師帳號';login.hidden=auth.isTeacher(next);refresh.disabled=!auth.isTeacher(next);
  if(prior!==next?.user?.id){clear();if(auth.isTeacher(next))setTimeout(()=>load(),0);else status('請使用具有權限的教師帳號登入。',true);}
 }
 let authEvents=0;
 auth.supabase.auth.onAuthStateChange((_event,next)=>{authEvents++;identity(next);});
 const initialEvents=authEvents,initial=await auth.resolveSession();
 if(initialEvents===authEvents)identity(initial);
 window.addEventListener('pagehide',clear);
 window.addEventListener('pageshow',event=>{if(event.persisted&&auth.isTeacher(session))void load();});
}
