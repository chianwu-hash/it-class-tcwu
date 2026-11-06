import {mountPaperPicker} from './paper-picker.mjs?v=20261105-self';

const messages={MATCH_DISABLED:'目前暫停幫忙找夥伴，仍可使用邀請碼組隊。',MATCH_NO_PAPER:'目前沒有適合全隊一起練的共用卷，請稍後再試。',MATCH_CHANGED:'小隊狀態已更新，請確認目前畫面後再操作。',MATCH_ACTIVE:'你正在找夥伴，請先回到候配畫面或取消。',MATCH_HOST_ONLY:'請由畫面上標示的隊長選卷及出發。',MATCH_PAPER_UNAVAILABLE:'這份卷目前無法讓全隊一起練，請隊長重新選卷。',MATCH_POOL_FULL:'目前找夥伴的人較多，請稍後再試。',STALE_REVISION:'小隊剛更新，請確認畫面後再按一次。',ROOM_RATE_LIMIT:'建立小隊太快了，請稍後再試。',TOO_MANY_ROOMS:'未出發的小隊較多，請先接續原有小隊。'};
Object.assign(messages,{HOST_ONLY:'請由畫面上標示的隊長選卷及出發。',MATCH_RATE_LIMIT:'操作比較頻繁，請稍等一下再試。',ACCESS_DENIED:'請使用正式名冊中的學生 Google 帳號。',AUTH_REQUIRED:'登入狀態已失效，請重新登入後再試。',MATCH_IDENTITY_CHANGED:'名冊資料已更新，請先離開原候配再重新參加。'});
export const matchMessage=e=>messages[e.code]||e.message||'連線未完成，請稍後再試。';
export const matchInstalledError=e=>['PGRST202','42883','404'].includes(String(e.code))||/Could not find the function public\.quiz_partner_match_action/.test(e.message||'');
export function remainingSeconds(deadline,serverNow,elapsed=0){return deadline?Math.max(0,Math.ceil((Date.parse(deadline)-Date.parse(serverNow)-elapsed)/1000)):null;}

// One controller owns its timers and pending request. A retry never gets a new request ID.
export function createMatchmaking({root,rpc,userId,esc,onExit,onActive,onStage,notice,returnToInvite=false}){
 let state=null,disposed=false,poll=null,tick=null,busy=false,fetching=false,epoch=0,pending=null,key='',serial=0,clockAt=0,serverNow=null,teamHint=null;
 const $=s=>root.querySelector(s),alive=n=>!disposed&&n===serial;
 function stopTimers(){clearTimeout(poll);clearInterval(tick);poll=tick=null;}
 function dispose(){disposed=true;serial++;stopTimers();document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);}
 function schedule(){clearTimeout(poll);if(!disposed)poll=setTimeout(refresh,document.hidden?30000:8000);}
 function clock(){const e=$('[data-match-countdown]');if(!e||!state)return;const left=remainingSeconds(state.deadline,serverNow,performance.now()-clockAt);e.textContent=left===null?'等下一位夥伴加入，再開始新的 30 秒集合。':left>0?`這輪集合還有 ${left} 秒`:'正在整理這一輪的小隊，請稍等一下…';}
 function requestArgs(){return {ticket:state?.ticket,...(state?.team?{teamId:state.team.id,revision:state.team.revision}:{})};}
 function feedback(text,bad=false){const el=$('[data-match-feedback]');if(el){el.textContent=text;el.className=bad?'error':'ok';}else notice(text,bad);}
 function locks(){root.querySelectorAll('button,input,select').forEach(e=>{if(e.dataset.matchRetry!==undefined)e.disabled=busy;else if(busy||pending){if(!e.hasAttribute('data-match-disabled'))e.dataset.matchDisabled=String(e.disabled);e.disabled=true;}else if(e.hasAttribute('data-match-disabled')){e.disabled=e.dataset.matchDisabled==='true';delete e.dataset.matchDisabled;}});const p=$('[data-match-pending]');if(p)p.hidden=!pending||busy;}
 async function accept(next){
  if(disposed)return;state=next;serverNow=next.now;clockAt=performance.now();teamHint=next.team?.id||teamHint;
  if(next.phase==='active'){dispose();await onActive(next.roomId);return;}
  const nextKey=JSON.stringify({...next,now:null,deadline:next.deadline});
  if(nextKey!==key){key=nextKey;render();}clock();
 }
 async function refresh(){
  if(disposed||busy||pending||fetching){schedule();return;}fetching=true;const n=serial,atEpoch=epoch;
  try{const next=await rpc({action:'status',...(teamHint?{teamId:teamHint}:{})});if(alive(n)&&atEpoch===epoch)await accept(next);}
  catch(e){if(alive(n))feedback(matchMessage(e),true);}
  finally{fetching=false;if(alive(n))schedule();}
 }
 async function mutate(action,extra={}){if(disposed||busy||pending)return;epoch++;pending={action,...requestArgs(),...extra,requestId:crypto.randomUUID()};await send();}
 async function send(){
  if(disposed||busy||!pending)return;busy=true;locks();const n=serial;
  try{const next=await rpc(pending);if(!alive(n))return;const withdrew=['cancel','leave'].includes(pending.action)&&next.phase==='idle';pending=null;if(withdrew&&returnToInvite){dispose();onExit();return;}await accept(next);}
  catch(e){if(!alive(n))return;const transient=e instanceof TypeError||e.busy||!e.code;if(transient){feedback('連線結果待確認。請重送同一次操作，避免重複排隊或建立小隊。',true);}else{pending=null;feedback(matchMessage(e),true);key='';}}
  finally{if(alive(n)){busy=false;locks();if(!pending){if(!key)queueMicrotask(refresh);else schedule();}}}
 }
 function shell(body){root.innerHTML=`<section class="card match-panel">${body}<p data-match-feedback role="status" aria-live="polite"></p><div data-match-pending hidden><p>上一筆結果還沒確認。</p><button type="button" data-match-retry class="primary">重送同一次操作</button></div></section>`;$('[data-match-retry]').onclick=send;}
 function render(){
  onStage('match');clearInterval(tick);tick=null;
  if(state.phase==='idle'){
   shell(`<span class="badge">自願參加・同年級跨班</span><h2>幫我找夥伴</h2>${state.reason==='alone'?'<p class="match-note">其他夥伴已退出，這次小隊還沒出發。你可以重新找夥伴。</p>':state.reason==='idle'?'<p class="match-note">這次小隊尚未出發，已先收起。需要時可以重新找夥伴。</p>':''}<p>和同年級的同學一起練，不比較成績，也不公布誰正在等。</p><ol><li>加入這輪 30 秒集合；時間到再安排 2～4 人的小隊。</li><li>成隊後隨機選一位隊長，由隊長選卷，再帶大家出發。</li><li>老師卷、考古卷跨班共用；隊長也可分享自己的 10／20 題自組卷。</li></ol><p>只有你一人時會繼續等候；出發前隨時可以退出。原有任務與紀錄會保留。</p><div class="actions"><button type="button" class="primary" data-match-join ${state.enabled&&state.available?'':'disabled'}>願意一起練，幫我找夥伴 →</button><button type="button" data-match-exit>回到組隊入口</button></div>${state.enabled&&state.available?'':'<p>目前暫無可候配的共用卷，仍可使用邀請碼組隊。</p>'}`);
   $('[data-match-join]').onclick=()=>mutate('join');$('[data-match-exit]').onclick=()=>{dispose();onExit();};
  }else if(state.phase==='waiting'){
   shell('<span class="badge">正在幫你找夥伴</span><h2>這一輪，等等彼此</h2><p class="match-countdown" data-match-countdown role="timer"></p><p>集合時間到才安排小隊，不會因為先湊滿四人就提早出發。</p><p>不用一直按按鈕；你也可以取消後回去自己練。</p><button type="button" data-match-leave>取消找夥伴</button>');
   $('[data-match-leave]').onclick=()=>mutate('cancel');tick=setInterval(clock,1000);
  }else if(state.phase==='identity_changed'){
   shell('<h2>名冊資料已更新</h2><p>請先離開原來的候配，再依目前年級重新參加。</p><button type="button" data-match-leave>離開原來的候配</button>');$('[data-match-leave]').onclick=()=>mutate('cancel');
  }else if(state.phase==='selecting'){
   const t=state.team,captain=t.host===userId,host=t.members.find(m=>m.id===t.host);
   shell(`<span class="badge">${t.members.length} 位夥伴・${captain?'你是隊長':'等隊長選卷'}</span><h2>夥伴到齊，選一份卷就能出發</h2><p>這一輪由 ${esc(host?.name||'夥伴')} 當隊長。人物只增加趣味，答題權重相近。</p><ul class="match-roster">${t.members.map(m=>`<li><strong>${esc(m.name)}${m.id===userId?'（我）':''}</strong><span class="badge">${m.id===t.host?'隊長':'夥伴'}</span></li>`).join('')}</ul>${t.idleWarning?'<p class="match-note">還在選卷嗎？可以按「我還在」，或讓隊長選好後一起出發。</p>':''}${t.selectionUnavailable?'<p class="error">剛才的卷目前無法讓全隊一起練，請隊長重新選卷。</p>':''}<div class="match-selected"><h3>全隊要練的卷</h3><p>${t.selected?`${esc(t.selected.title)}・${t.selected.total} 題`:'尚未選卷'}</p>${t.alreadyAwarded?'<p class="match-note">相同題目、相同夥伴的紀念已收藏。這次仍可一起練，會保留紀錄，不重複計葉花。</p>':''}</div>${captain?`<details class="match-paper-options" ${t.selected?'':'open'}><summary>${t.selected?'換一份全隊的卷':'由隊長選卷'}</summary><div data-match-picker><p>正在整理適合全隊的卷…</p></div><button type="button" data-match-select disabled>確認選這份卷</button></details>`:'<p>隊長選好後會顯示在這裡，由隊長按「一起出發」。</p>'}<div class="actions">${captain?`<button type="button" class="primary" data-match-start ${t.selected?'':'disabled'}>一起出發 →</button>`:''}<button type="button" data-match-ping>我還在</button><button type="button" data-match-leave>退出這次小隊</button></div>`);
   $('[data-match-ping]').onclick=()=>mutate('ping');$('[data-match-leave]').onclick=()=>mutate('leave');
   if(captain){$('[data-match-start]').onclick=()=>mutate('start');loadPicker(t);}
  }
  locks();
 }
 async function loadPicker(team){const n=serial,atKey=key;try{const result=await rpc({action:'catalog',...requestArgs()});if(!alive(n)||key!==atKey||result.revision!==team.revision)return;const target=$('[data-match-picker]');if(!target)return;let draft=null;mountPaperPicker(target,{papers:result.papers,selected:result.papers.find(p=>p.id===team.selected?.id),esc,onChange:p=>{draft=p;const b=$('[data-match-select]');b.disabled=!p||p.id===state.team.selected?.id;}});$('[data-match-select]').onclick=()=>{if(draft)mutate('select',{paper:draft.id});};locks();}catch(e){if(alive(n)&&key===atKey){$('[data-match-picker]').innerHTML='<p>題目暫時無法載入，請再試一次。</p><button type="button" data-match-reload>重新載入題組</button>';$('[data-match-reload]').onclick=()=>loadPicker(state.team);feedback(matchMessage(e),true);}}}
 function wake(){if(!disposed&&!busy&&!pending){clearTimeout(poll);refresh();}}
 document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);
 return {async start(initial){if(initial)await accept(initial);else await refresh();schedule();},dispose};
}
