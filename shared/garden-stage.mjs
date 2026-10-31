import {createCompanionPolicy} from './garden-companion-policy.mjs';
import {petName} from './garden-pet-names.mjs';
const policy=createCompanionPolicy();let lastCompanionState='';
const frame=document.getElementById('garden-scene');
const petButton=document.getElementById('pet-tap');
let data={leaves:[],flowers:[],pendingLeaves:[],pendingFlowers:[],petUnlocked:false,pet:null,home:null,treeSkin:'a'},key='',childReady=false;
let paused=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,atmosphere={scene:'day',isDay:true},transition=null;
let soundVersion=0,soundBusy=false;
let loadVersion=0,loadTimer=null,assetIssues=[];
const defaults={cat:'b',dog:'a',rabbit:'b'};
const child=()=>{try{return frame.contentWindow.__gardenShelterV21||frame.contentWindow.__homesV5}catch{return null}};
const post=(message)=>parent.postMessage(message,location.origin);
function syncSoundControl(){const b=document.getElementById('thunder-sound');b.hidden=atmosphere.scene!=='thunder';b.disabled=!childReady||reduced||soundBusy;b.title=reduced?'省略動畫過程時不播放雷聲':''}
function stopSound(){soundVersion++;soundBusy=false;const b=document.getElementById('thunder-sound');b.setAttribute('aria-pressed','false');b.textContent='開啟雷聲';void Promise.resolve(child()?.enableAudio?.(false)).catch(()=>{});syncSoundControl()}
function publishCompanion(){const state={...policy.snapshot(),owned:data.petUnlocked===true&&childReady},key=JSON.stringify(state);if(key!==lastCompanionState){lastCompanionState=key;post({type:'garden-companion-state',state})}}
function applyCompanion(){const state=policy.snapshot();child()?.setCompanionControl?.({homeVisible:state.preferredVisible,rest:state.forceRest});publishCompanion()}
function showAssetStatus(text,canRetry){const box=document.getElementById('scene-load-status'),button=document.getElementById('scene-retry');document.getElementById('scene-load-message').textContent=text;box.hidden=!text;button.hidden=!canRetry;button.disabled=false}
function showAssetIssues(){const visible=assetIssues.filter(x=>typeof x?.text==='string');showAssetStatus(visible.map(x=>x.text).join(' '),!!visible.length)}
function beginLoad(){clearTimeout(loadTimer);childReady=false;assetIssues=[];loadVersion++;showAssetStatus('正在準備花園…',false);loadTimer=setTimeout(()=>showAssetStatus('花園讀取較久，可以重新讀取。學習成果都保留著。',true),45000);syncSoundControl();}
function retryScene(){transition?.();stopSound();beginLoad();const u=new URL(frame.src);u.searchParams.set('load',String(loadVersion));frame.src=u.href;publishCompanion();}
function command(action){if(!childReady)return {ok:false,reason:'loading'};const result=policy.command(action);if(result.ok){applyCompanion();if(!paused)child()?.play()}return result}
function sync(){
 const c=child();if(!c||!childReady)return;
 c.configure?.(data);applyCompanion();c.setAtmosphere?.(atmosphere.scene,atmosphere.isDay);c.setReduce(reduced);
 if(paused||reduced)c.pause();else c.play();
 petButton.hidden=!data.petUnlocked;
 petButton.textContent='和'+petName(data.pet)+'打招呼';
 if(reduced||atmosphere.scene!=='thunder')stopSound();else syncSoundControl();
}
function ready(){
 const c=child();let current;try{current=new URL(frame.contentWindow.location.href);if(current.searchParams.get('species')+'-'+current.searchParams.get('home')!==key||current.searchParams.get('load')!==String(loadVersion))return}catch{return}
 if(!c||!c.snapshot().ready)return;
 clearTimeout(loadTimer);childReady=true;assetIssues=c.snapshot().assetIssues||assetIssues;showAssetIssues();sync();post({type:'garden-scene-ready'});
}
function configure(next){
 data={...data,...next};policy.configure(data);
 const pet=Object.hasOwn(defaults,data.pet)?data.pet:'cat';
 const home=['a','b','c'].includes(data.home)?data.home:defaults[pet];
 const nextKey=pet+'-'+home;
 if(nextKey!==key){
  policy.reset();policy.weather(atmosphere.scene);policy.configure(data);
  transition?.();stopSound();beginLoad();key=nextKey;
  frame.src='/garden/'+(pet==='cat'?'scene-cat.html':'scene-pets.html')+'?species='+pet+'&home='+home+'&load='+loadVersion;
 }else sync();
 publishCompanion();return api.snapshot();
}
function syncMotionControls(){const b=document.getElementById('motion-toggle');b.disabled=reduced;b.textContent=reduced?'已省略動畫過程':paused?'繼續動畫':'暫停動畫';document.getElementById('motion-reduce').checked=reduced}
function pause(){paused=true;child()?.pause();syncMotionControls()}
function play(){paused=false;if(childReady&&!reduced)child()?.play();syncMotionControls()}
function setReduce(v){reduced=!!v;transition?.();if(childReady){const c=child();c.setReduce(reduced);if(reduced||paused)c.pause();else c.play()}if(reduced)stopSound();else syncSoundControl();syncMotionControls();return reduced}
async function changeTreeSkin(k){
 if(!['a','b'].includes(k)||data.treeSkin===k)return data.treeSkin;
 transition?.();const c=child(),canvas=frame.contentDocument?.querySelector('canvas');
 data.treeSkin=k;
 if(!childReady||!canvas||reduced||document.hidden||!canvas.animate){c?.setTree(k);return k}
 // Reuse the approved growth-like appearance transition around the actual scene.
 const old=document.createElement('canvas');old.width=canvas.width;old.height=canvas.height;old.getContext('2d').drawImage(canvas,0,0);
 old.setAttribute('aria-hidden','true');old.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:12px;z-index:2';
 document.getElementById('scene-wrap').append(old);c.setTree(k);
 const animation=old.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.035)'}],{duration:1150,easing:'cubic-bezier(.22,.68,.2,1)',fill:'both'});
 await new Promise(resolve=>{let done=false;function finish(){if(done)return;done=true;animation.cancel();old.remove();transition=null;resolve()}transition=finish;animation.finished.then(finish,finish)});
 return k;
}
const api={
 configure,play,pause,setReduce,changeTreeSkin,command,retry:retryScene,
 setTree(k){if(['a','b'].includes(k)){data.treeSkin=k;child()?.setTree(k)}return data.treeSkin},
 setAtmosphere(scene,isDay){atmosphere={scene,isDay};policy.weather(scene);if(childReady){applyCompanion();child()?.setAtmosphere(scene,isDay)}if(scene!=='thunder')stopSound();else syncSoundControl();publishCompanion()},
 snapshot(){const s=childReady?child()?.snapshot():null;return {...s,ready:childReady&&!!s?.ready,loading:!childReady,manuallyPaused:paused,assetIssues:assetIssues.slice(),pet:data.petUnlocked?data.pet:null,home:data.home,counts:s?.counts||{leaves:0,flowers:0},playing:!paused&&!reduced&&s?.playing===true,reduced,companion:policy.snapshot()}},
 tap(){if(data.petUnlocked&&childReady)return child()?.tap?.()||child()?.tapCat?.()},
 advanceForTest(ms){return child()?.advanceForTest?.(ms)},
 demo(kind){if(['enter','sleep'].includes(kind)){api.setAtmosphere('downpour',atmosphere.isDay)}else if(['exit','roam','peek','behind'].includes(kind)){api.setAtmosphere('day',atmosphere.isDay);command('walk')}return child()?.demo?.(kind)}
};
window.__gardenShelterV21=window.__gardenScene=api;
frame.addEventListener('load',ready);
window.addEventListener('message',e=>{
 if(e.origin!==location.origin)return;
 if(e.source===parent&&e.data?.type==='garden-companion-command'){command(e.data.action);return}
 if(e.source===parent&&e.data?.type==='garden-state'){configure(e.data);return}
 if(e.source!==frame.contentWindow)return;
 if(e.data?.type==='garden-scene-status'&&e.data.token===String(loadVersion)&&Array.isArray(e.data.issues)){assetIssues=e.data.issues;if(assetIssues.some(x=>x.fatal))clearTimeout(loadTimer);showAssetIssues();return}
 if(e.data?.type==='garden-pet-state'){policy.observe(e.data.state);publishCompanion();return}
 if(e.data?.type==='garden-scene-ready'){ready();return}
 if(['garden-select','garden-pending'].includes(e.data?.type)&&typeof e.data.id==='string'){
  const allowed=e.data.type==='garden-select'?[...data.leaves,...data.flowers]:[...data.pendingLeaves,...data.pendingFlowers];
  if(allowed.some(r=>r?.id===e.data.id)){pause();post({type:e.data.type,id:e.data.id})}
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)transition?.()});
document.getElementById('motion-toggle').onclick=()=>paused?play():pause();
syncMotionControls();document.getElementById('motion-reduce').onchange=e=>setReduce(e.target.checked);
petButton.onclick=()=>api.tap();
document.getElementById('scene-retry').onclick=retryScene;
new ResizeObserver(()=>post({type:'garden-height',height:Math.ceil(document.body.getBoundingClientRect().height+8)})).observe(document.body);
// Wait for the authenticated parent's saved choice before fetching pet art.
post({type:'garden-ready'});

document.getElementById('thunder-sound').onclick=async e=>{
 if(!childReady||reduced||soundBusy||atmosphere.scene!=='thunder')return;
 const button=e.currentTarget,c=child(),version=soundVersion;soundBusy=true;syncSoundControl();
 try{const s=await c.enableAudio(button.getAttribute('aria-pressed')!=='true');
  if(version!==soundVersion||c!==child()||reduced||atmosphere.scene!=='thunder'){await c.enableAudio(false);return}
  button.setAttribute('aria-pressed',String(!!s.enabled));button.textContent=s.enabled?'關閉雷聲':'開啟雷聲';
 }catch{if(version===soundVersion)stopSound()}
 finally{if(version===soundVersion)soundBusy=false;syncSoundControl()}
};
