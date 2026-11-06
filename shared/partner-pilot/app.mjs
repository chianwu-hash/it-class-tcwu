import {createMatchmaking,matchInstalledError} from './matchmaking.mjs?v=20261106-match-reviewed';
import {readInvite} from './invite.mjs?v=20261106-team-flow';
import {mountTeamHome,mountWaitingTeam} from './team-flow.mjs?v=20261106-match-reviewed';
import {createLearningUI} from './learning.js?v=20261106-drawing-draft';
import {setPartnerStage,scene} from './presentation.mjs?v=20261106-match';
import * as auth from '../auth.js';
import {initNavbarAuth} from '../navbar-auth.js';
import {createAuthenticatedTransport} from '../quiz-transport.mjs?v=20261106-auth-errors';
const sb=auth.supabase; let currentSession=null;
const transport=createAuthenticatedTransport({auth,getSession:()=>currentSession});
const $=s=>document.querySelector(s),app=$('#app');
let me=null,room=null,channel=null,topic=null,pending=null,pendingSaveExit=true,busy=false,generation=0,view=0,refreshing=false,again=false,authUser=undefined,subscriptionSerial=0,recoveryTimer=null,recoveryCount=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const papers={ten:'共同任務・10 題',twenty:'共同任務・20 題',exam:'考古卷流程示範・12 題'};
let matchUI=null,matchAvailable=false;
async function matchRPC(body){return transport('/rest/v1/rpc/quiz_partner_match_action',{p:body});}
function stopMatch(){matchUI?.dispose();matchUI=null;}
async function matchStatus(){try{return await matchRPC({action:'status'});}catch(e){if(!matchInstalledError(e))status('找夥伴服務暫時無法載入，原有邀請組隊仍可使用。',true);return null;}}
function showMatch(initial){if(busy||pending)return;view++;lookupSerial++;room=null;learning.clear();stopMatch();clearChannel();matchUI=createMatchmaking({root:app,rpc:matchRPC,userId:me.id,esc,onStage:setPartnerStage,notice:status,returnToInvite:!!readInvite(location.href).code,onExit:()=>home(),onActive:async id=>{matchUI=null;await openMatchedRoom(id);}});status();matchUI.start(initial);}
let catalog=[],inviteAttempted='',homeUI=null,entryView=null,sourceConsumed=false;
async function loadCatalog(){const gen=generation,result=await rpc({action:'catalog'});if(gen!==generation)return false;catalog=Array.isArray(result.papers)?result.papers:[];for(const p of catalog)papers[p.id]=p.title;return true;}
const errors={ALLOCATION_UNAVAILABLE:'這份考古卷的配題資料尚未備妥，請重新選卷；既有紀錄仍保留。',ALLOCATION_TOO_FEW_UNITS:'這份卷能完整分配的題目包不足，請減少人數或改選其他試卷。',ALLOCATION_SOURCE_FROZEN:'這份小隊的題目已固定，請使用原小隊繼續練習。',ROOM_RATE_LIMIT:'建立小隊太快了，請稍等一分鐘，或接續現有小隊。',PAIR_ONLY:'10題共同任務限2人。尚未出發的舊小隊請先由多出的夥伴離開，再由隊長調整為2人。',SELF_UNAVAILABLE:'這份自組卷目前無法組隊。請選擇本人儲存的10或20題自組卷。',SELF_MEDIA_UNAVAILABLE:'這份自組卷有尚未備妥的圖片或音檔，請先回原卷練習。',SOURCE_CHANGED:'這份題目已更新或暫停開放。請返回考前練功房重新選題；原紀錄仍保留。',INVALID_CAPACITY:'請選擇2～4位夥伴。',INVALID_DRAFT:'草稿暫時無法儲存，請更新狀態後再試；較大的畫圖可先送出作答再退出。',invalid_response:'請確認答案格式，並完成這題的自我檢查。',ACCESS_DENIED:'請使用正式名冊中的學生Google帳號。',NOT_MEMBER:'你已不在這個小隊。',ROOM_NOT_FOUND:'找不到小隊，邀請碼可能已失效。',INVALID_CODE:'請輸入六位數邀請碼。',STALE_REVISION:'夥伴的狀態剛更新，已重新載入，請再操作一次。',NOT_READY:'等預計人數到齊後，由隊長按一起出發。',HOST_ONLY:'請由隊長操作。',ROOM_FULL:'小隊已滿。',JOIN_CLOSED:'這個小隊已出發或邀請碼已失效。',ALREADY_STARTED:'小隊已出發。',INVALID_ROOM:'請確認小隊名稱與人數。',TOO_MANY_ROOMS:'未出發的小隊太多，請先使用現有小隊。'};
function renderPending(){learning?.setTransport({pending:!!pending,busy});const el=$('#pending');el.hidden=!pending;el.innerHTML=pending?'<p>上一筆操作的結果待確認。重送會沿用同一個請求編號。</p><button id="retry" class="primary">重送同一次操作</button>':'';if(pending){$('#retry').disabled=busy;$('#retry').onclick=sendPending;}}
function status(message='',bad=false){learning?.setTransport({message,bad});$('#status').textContent=message;$('#status').className=message?(bad?'error':'ok'):'';}
const disabledBefore=new WeakMap();
function controls(disabled){learning?.setTransport({busy,pending:!!pending});for(const b of document.querySelectorAll('main button,main input,main select,main textarea')){if(b.closest('#lightbox')||b.closest('[data-ui-only]'))continue;if(disabled){if(!disabledBefore.has(b))disabledBefore.set(b,b.disabled);b.disabled=true;}else if(disabledBefore.has(b)){b.disabled=disabledBefore.get(b);disabledBefore.delete(b);}}}
async function rpc(body){try{return await transport('/rest/v1/rpc/'+(body.attachmentIds?.length||body.action==='save_draft'&&body.state?.media?'quiz_partner_message_action':'quiz_partner_pilot_action'),{p:body});}catch(cause){const e=Error(errors[cause.code]||cause.message||'連線未完成，請稍後再試。');e.code=cause.code;e.transient=cause.busy||cause instanceof TypeError||!cause.code;throw e;}}
async function clearChannel(){subscriptionSerial++;if(recoveryTimer){clearTimeout(recoveryTimer);recoveryTimer=null;}topic=null;if(channel){const old=channel;channel=null;await sb.removeChannel(old);}}
async function loadMe(){const gen=generation,next=await rpc({action:'me'});if(gen!==generation)return false;me=next;$('#identity').textContent=me.name+'｜夥伴練功';return true;}
function login(){setPartnerStage('login');document.documentElement.dataset.booted='true';app.innerHTML='<section class="card"><h2>使用學校 Google 帳號登入</h2><p>請使用上方原有的 Google 登入按鈕。登入後即可建立小隊或接受夥伴邀請。</p></section>';$('#identity').textContent='';if(readInvite(location.href).code)status('你收到一份小隊邀請。登入後會直接加入小隊，等隊長出發。');}
function home(mode){
 stopMatch();learning.clear();setPartnerStage('home');document.documentElement.dataset.booted='true';view++;room=null;
 const source=new URLSearchParams(location.search),invitation=readInvite(location.href);
 const picked=catalog.find(p=>(source.has('session')&&(source.get('session')===p.sourceSession||p.sourceSessions?.includes(source.get('session'))))||(source.has('paper')&&source.get('paper')===p.sourcePaper));
 const requested=source.has('session')||source.has('paper'),initial=mode||(invitation.code||invitation.invalid?'member':requested&&!sourceConsumed?'captain':'home');
 if(initial==='captain')sourceConsumed=true;
 homeUI=mountTeamHome({root:app,esc,rooms:me.rooms,initialMode:initial,initialCode:invitation.code||'',picked,requested,
  resolvePicked:papers=>papers.find(p=>(source.has('session')&&(source.get('session')===p.sourceSession||p.sourceSessions?.includes(source.get('session'))))||(source.has('paper')&&source.get('paper')===p.sourcePaper)),
  onFindPartner:matchAvailable?()=>showMatch():null,
  loadPapers:async()=>{if(!await loadCatalog())throw Error('登入狀態已改變，請重新開啟。');return catalog;},
  onNavigate:()=>{view++;lookupSerial++;},onStage:setPartnerStage,notice:status,
  onCreate:body=>mutate({action:'create',...body}),onJoin:joinByCode,onResume:openRoom,onRefresh:updateMine});
 if(invitation.invalid)status('邀請碼格式不正確，請輸入隊長提供的六位數邀請碼。',true);
 if(invitation.code){const key=generation+':'+invitation.code;if(inviteAttempted!==key){inviteAttempted=key;queueMicrotask(()=>joinByCode(invitation.code));}}
}
let lookupSerial=0;
function consumeInvite(){const url=new URL(location.href);if(url.searchParams.has('invite')){url.searchParams.delete('invite');history.replaceState(history.state,'',url);}}
async function joinByCode(code){
 if(room||busy||pending||!homeUI?.isMember())return;
 const gen=generation,serial=++lookupSerial,atView=view;
 if(!/^[0-9]{6}$/.test(code)){status(errors.INVALID_CODE,true);return;}
 homeUI.feedback('正在加入小隊…');
 try{
  const r=await rpc({action:'lookup',code});
  if(gen!==generation||atView!==view||serial!==lookupSerial||room||!homeUI?.isMember())return;
  consumeInvite();
  if(me.rooms.some(item=>item.id===r.id)){await openRoom(r.id);return;}
  if(r.started)throw Object.assign(Error('小隊已出發，請改輸入其他邀請碼。'),{code:'JOIN_CLOSED'});
  if(r.count>=r.capacity)throw Object.assign(Error('這個小隊已滿，請改輸入其他邀請碼。'),{code:'ROOM_FULL'});
  await mutate({action:'join',roomId:r.id,code});
 }catch(e){if(gen===generation&&atView===view&&serial===lookupSerial&&!room){consumeInvite();status(e.message,true);}}
 finally{if(gen===generation&&atView===view&&serial===lookupSerial&&!room)homeUI?.feedback('可確認邀請碼後再送出，或返回組隊入口。');}
}
async function updateMine(){const gen=generation;try{if(!await loadMe())return;if(gen!==generation||room)return;homeUI?.setRooms(me.rooms);}catch(e){status(e.message,true);}}
async function openRoom(id){if(busy||pending)return;const serial=++view,gen=generation;try{const r=await rpc({action:'snapshot',roomId:id});if(gen!==generation||serial!==view)return;entryView=r.exercise?.finished?'book':r.exercise?.reviewOpen?'review':null;await accept(r);status();return true;}catch(e){if(gen===generation&&serial===view)status(e.message,true);return false;}}
async function openMatchedRoom(id){const gen=generation;if(await openRoom(id)||gen!==generation)return;app.innerHTML='<section class="card"><h2>小隊已出發，進度已保留</h2><p>剛才未能載入題目，可以重試，或回到組隊入口接續任務。</p><div class="actions"><button class="primary" data-match-open-retry>重新進入題目</button><button data-match-open-home>回到組隊入口</button></div></section>';$('[data-match-open-retry]').onclick=()=>openMatchedRoom(id);$('[data-match-open-home]').onclick=async()=>{try{if(await loadMe())home();}catch(e){if(gen===generation)status(e.message,true);}};}
async function accept(r){if(room?.id===r.id&&r.revision<room.revision)return;const captainChanged=room?.id===r.id&&room.host!==r.host&&r.host===me.id&&!r.started;const unchanged=JSON.stringify(r)===JSON.stringify(room);room=r;if(!unchanged)renderRoom();if(captainChanged)status('你現在是隊長。人數到齊後，由你按一起出發。');if(r.paused){await clearChannel();}else if(r.topic&&(topic!==r.topic||!channel))await subscribe(r);}
async function subscribe(r){const serial=++subscriptionSerial,previous=channel;channel=null;topic=r.topic;if(previous)await sb.removeChannel(previous);if(serial!==subscriptionSerial||room?.topic!==r.topic)return;const currentTopic=topic;channel=sb.channel(topic,{config:{private:true}}).on('broadcast',{event:'revision'},message=>{if(!heldRevision(message))refresh();});channel.subscribe(s=>{if(topic!==currentTopic)return;if(s==='SUBSCRIBED'){recoveryCount=0;const label=$('#sync');if(label)label.textContent='即時同步已連線';refresh();}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s)){const label=$('#sync');if(label)label.textContent='同步連線恢復中，可手動更新';if(!recoveryTimer&&recoveryCount<3){const gen=generation,id=room?.id;recoveryTimer=setTimeout(()=>{recoveryTimer=null;if(gen===generation&&room?.id===id)refresh();},1000*2**recoveryCount++);}}});}
// A broadcast for a revision this page already holds (our own mutation result) needs no extra snapshot.
// Anything unreadable falls back to refreshing, as before.
function heldRevision(message){const p=message?.payload?.revision!==undefined?message.payload:message?.payload?.payload,rev=Number(p?.revision);return Boolean(room)&&p?.room_id===room.id&&Number.isFinite(rev)&&rev<=room.revision;}
async function refresh(){if(!room)return;if(refreshing){again=true;return;}refreshing=true;const id=room.id,gen=generation;try{const r=await rpc({action:'snapshot',roomId:id});if(gen===generation&&room?.id===id)await accept(r);}catch(e){if(gen!==generation||room?.id!==id)return;if(e.code==='NOT_MEMBER'||e.code==='ACCESS_DENIED'){learning.clear();room=null;await clearChannel();home();}status(e.message,true);}finally{refreshing=false;if(again){again=false;refresh();}}}
function renderRoom(){if(room.paused){learning.clear();setPartnerStage(room.award||room.recordOnly?'record':'room');const a=room.award;app.innerHTML=`<section class="card"><h2>${esc(room.team)}・共同紀錄冊</h2><p>${room.recordOnly?'一起走過的努力，會保留在我們的紀錄裡。':'這份題組目前暫停作答，原有進度與紀念都保留。'}</p>${a?`<p>已取得 ${a.leaves} 片紀念葉、${a.flowers} 朵紀念花，已計入努力樹。</p>${(a.record.stories||[]).map(s=>`<h3>${esc(s.name)}</h3><p>${(s.lines||[]).map(esc).join('<br>')}</p>`).join('')}`:'<p>這個小隊尚未完成，已保存的作答與草稿仍保留。</p>'}<button id="paused-home">回到我的小隊</button>${scene('keepsake','partner-record-art')}</section>`;$('#paused-home').onclick=()=>{room=null;home();};return;}if(room.started&&room.exercise){learning.render(room,me,entryView);entryView=null;if(busy||pending)controls(true);renderPending();return;}setPartnerStage('room');
 mountWaitingTeam({root:app,room,viewer:me,esc,pageUrl:location.href,sync:channel?.state==='joined'?'即時同步已連線':'正在接上同步',notice:status,onRefresh:refresh,
  onStart:()=>mutate({action:'start',roomId:room.id,revision:room.revision}),
  onResize:capacity=>mutate({action:'resize',roomId:room.id,revision:room.revision,capacity}),
  onLeave:()=>mutate({action:'leave',roomId:room.id,revision:room.revision}),
  onHome:async()=>{if(busy||pending)return;view++;room=null;await clearChannel();if(await loadMe())home();}});
 if(busy||pending)controls(true);renderPending();}
async function mutate(body,options={}){if(busy){status('正在處理上一筆操作，這次內容仍保留，請稍後再送出。',true);return;}if(pending){status('請先重送上一筆操作，確認結果後再繼續。',true);renderPending();return;}pendingSaveExit=options.stay!==true;pending={...body,requestId:crypto.randomUUID()};return await sendPending();}
async function dispatchPending(){return await rpc(pending);}
async function sendPending(){if(!pending||busy)return;busy=true;controls(true);const gen=generation;try{const result=await dispatchPending();if(gen!==generation)return;const left=pending.action==='leave',draftSaved=pending.action==='save_draft',savedExit=draftSaved&&pendingSaveExit;learning.committed(pending,result);pending=null;if(left||savedExit){if(savedExit)learning.clear();room=null;await clearChannel();if(await loadMe())home();}else await accept(result);status(savedExit?'進度與未送出的草稿已儲存。回到首頁可接續任務，或翻看已完成的紀錄冊。':left?'已離開小隊。':draftSaved?'草稿已儲存，尚未傳給隊友。可以繼續編輯。':'小隊狀態已儲存。');return {ok:true};}catch(e){if(gen!==generation)return;const transient=e.transient||e instanceof TypeError;if(transient){status('連線中斷。請按「重送同一次操作」，避免建立重複資料。',true);renderPending();}else{pending=null;status(e.message,true);if(room)await refresh();}return {ok:false,pending:!!pending};}finally{if(gen===generation){busy=false;controls(!!pending);if(room&&!pending)renderRoom();renderPending();}}}
async function sessionChanged(session){const uid=session?.user?.id??null;if(uid===authUser)return;const sessionGen=++generation;stopMatch();matchAvailable=false;view++;busy=false;learning.clear();authUser=uid;pending=null;room=null;await clearChannel();renderPending();if(!uid){me=null;login();return;}try{await sb.realtime.setAuth(session.access_token);if(!await loadMe()||uid!==authUser)return;if(!readInvite(location.href).code&&!await loadCatalog())return;if(sessionGen!==generation||uid!==authUser)return;const matching=await matchStatus();if(sessionGen!==generation||uid!==authUser)return;matchAvailable=!!(matching?.enabled&&matching?.available);if(['waiting','selecting','identity_changed'].includes(matching?.phase)){showMatch(matching);if(readInvite(location.href).code)status('你正在找夥伴。若要使用收到的邀請，請先取消候配或退出這次小隊。邀請連結仍保留。');return;}home();const award=new URLSearchParams(location.search).get('award');if(award){try{await accept(await rpc({action:'record',awardId:award}));document.querySelector('[data-view="book"]')?.click();}catch(e){if(sessionGen===generation)status(e.message,true);}}if(!new URLSearchParams(location.search).has('invite'))status('選擇建立小隊或輸碼加入，和夥伴一起練。');}catch(e){if(uid!==authUser)return;login();status(e.message,true);}}
const learning=createLearningUI({container:app,esc,onStage:setPartnerStage,scene,onAction:mutate,onRefresh:refresh,onRetry:sendPending,storeMessageMedia:payload=>transport('/functions/v1/quiz-partner-message-media',{action:'store',...payload}),readMessageMedia:payload=>transport('/functions/v1/quiz-partner-message-media',{action:'read',...payload}),loadMedia:async(roomId,hash)=>transport('/functions/v1/quiz-partner-pilot-media',{roomId,hash}),onHome:async()=>{if(busy||pending){status('請先確認上一筆操作結果。',true);return;}room=null;view++;await clearChannel();if(await loadMe())home();},notice:status});
Object.assign(errors,{INVALID_MEDIA:'這份附件格式不符，請重新錄音或畫圖。',MEDIA_DENIED:'這份附件目前無法傳送，請移除後重新附上。',MEDIA_QUOTA:'目前暫存的附件較多，請先使用文字，或稍後再試。',MEDIA_ALREADY_LINKED:'這份附件已送出，請重新附上新的語音或畫圖。',MESSAGE_RATE_LIMIT:'訊息傳得比較快，請稍等一下。',ATTACHMENT_CLIENT_ID_CONFLICT:'附件內容剛更新，請重新附上。',INVALID_DRAFT_MEDIA:'附件草稿尚未存好，請先確認附件後再試。',INVALID_DRAFT:'草稿內容太長，請縮短後再儲存。',DRAFT_CHANGED:'另一個視窗已更新草稿，請確認畫面後再按一次儲存退出。',INVALID_TAG:'請選擇想分享這題的原因。',THREAD_NOT_FOUND:'找不到這則請教，請先更新小隊狀態。',INVALID_QUESTION:'找不到這道題，請先更新小隊狀態。',INVALID_CHOICE:'請選擇題目中的一個選項。',REQUEST_REUSED:'這次操作編號已使用，請重新整理確認狀態。',NOT_STARTED:'請等隊長帶大家一起出發。',OWN_QUESTION_ONLY:'這是夥伴負責的題目。可以給提示，再讓他自己試。',ANSWER_CHANGED:'這題的作答已更新，已載入最新紀錄，請確認後再試。',REVIEW_NOT_READY:'等全組每一題都留下作答，就能共同回顧。',WAIT_FOR_REVIEW:'等每一位夥伴都看過共同回顧，再收進紀錄冊。',NOT_ELIGIBLE:'完成共同回顧且全組達 60% 後，才能收藏紀念。',INVALID_TEXT:'請填入簡短的內容，最多 600 字。'});
initNavbarAuth({onSessionResolved(session){currentSession=session;queueMicrotask(()=>sessionChanged(session));}});
sb.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED'&&session)queueMicrotask(()=>sb.realtime.setAuth(session.access_token));});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&room)refresh();});
window.addEventListener('online',()=>{if(room)refresh();});
app.textContent='正在確認學校登入與名冊資格…';
