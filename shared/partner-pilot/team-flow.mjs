import {mountPaperPicker,partySizes} from './paper-picker.mjs?v=20261105-self';
import {inviteMarkup,bindInvite} from './invite.mjs?v=20261106-team-flow';

export const phaseLabel=phase=>({waiting:'等隊員集合',practice:'練習中',review:'共同回顧',completed:'已完成'})[phase]||'接續練習';
export const pendingTeams=rooms=>rooms.filter(r=>!r.finished&&r.phase!=='completed');
const roster=r=>(r.members||[]).map(m=>m.name).join('、');

export function mountTeamHome({root,esc,rooms=[],initialMode='home',initialCode='',picked=null,requested=false,loadPapers,onNavigate,onCreate,onJoin,onResume,onRefresh,onStage,notice}){
 root.innerHTML='<div data-team-home></div>';
 const frame=root.firstElementChild;let mode='home',token=0;
 const $=s=>frame.querySelector(s),live=t=>frame.isConnected&&t===token;
 const back='<button type="button" data-home>回到組隊入口</button>';
 function cards(list){return list.map(r=>`<article class="team-resume"><div><span class="badge">${phaseLabel(r.phase|| (r.started?'practice':'waiting'))}</span><h3>${esc(r.title||r.team)}</h3><p>${esc(r.team)}${r.members?.length?'・'+esc(roster(r)):''}</p>${!r.started?`<p class="muted">已加入 ${r.count??r.members?.length??1}／${r.capacity??2} 位${r.inviteExpired?'・邀請已到期':''}</p>`:''}</div><button type="button" data-resume="${esc(r.id)}" class="green">${r.finished?'翻開紀錄':'接續任務 →'}</button></article>`).join('');}
 function bind(){frame.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>show('home'));frame.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>onResume(b.dataset.resume));}
 async function show(next){mode=next;const t=++token;onNavigate();onStage(next==='captain'?'captain':next==='member'?'member':'home');
  if(next==='captain'){
   frame.innerHTML=`<section class="card"><h2>我當隊長：選一份卷，邀夥伴來</h2><p role="status">正在找可以一起練的題目…</p>${back}</section>`;bind();
   let papers;try{papers=await loadPapers();}catch(e){if(live(t)){notice(e.message,true);frame.querySelector('[role=status]').textContent='題目暫時無法載入，請返回後再試。';}return;}if(!live(t))return;
   const selected=picked||(!requested?papers[0]:null);
   frame.innerHTML=`<section class="card"><h2>我當隊長：選卷與人數</h2><form id="create"><div id="paper-picker"></div><label for="capacity">這次幾人一起練？（包含隊長）</label><select id="capacity"></select><details class="team-options"><summary>修改小隊名稱與主題人物</summary><label for="team">小隊名稱</label><input id="team" maxlength="24" value="森林探險隊" required><label for="theme">主題人物（只增加趣味）</label><select id="theme"><option value="forest">森林探險隊</option><option value="space">星際夥伴隊</option><option value="dora">哆啦A夢隊</option></select></details><div class="actions"><button class="primary" id="create-room">建立小隊，邀請夥伴 →</button>${back}</div></form></section>`;
   mountPaperPicker($('#paper-picker'),{papers,selected,esc,onChange:p=>{const sizes=partySizes(p),old=Number($('#capacity').value);$('#capacity').innerHTML=sizes.map(n=>`<option value="${n}" ${n===old?'selected':''}>${n} 人${sizes.length===1?'（10題固定2人）':''}</option>`).join('');$('#create-room').disabled=!p;}});
   if(requested&&!picked)notice('這份卷目前無法組隊，請返回原卷，或明確改選另一份題組。',true);
   $('#create').onsubmit=e=>{e.preventDefault();const paper=$('#paper').value;if(!papers.some(p=>p.id===paper))return;onCreate({paper,capacity:Number($('#capacity').value),team:$('#team').value,theme:$('#theme').value});};bind();
  }else if(next==='member'){
   frame.innerHTML=`<section class="card team-join"><h2>我當隊員</h2><p>輸入隊長的邀請碼，加入後等隊長出發。</p><form id="join-code"><label for="code">六位數邀請碼</label><input id="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" required value="${esc(initialCode)}"><p id="join-feedback" role="status" aria-live="polite"></p><button class="green" id="join-team">加入小隊 →</button></form>${back}</section>`;
   $('#join-code').onsubmit=async e=>{e.preventDefault();const code=$('#code').value.trim(),submit=$('#join-team');if(!/^[0-9]{6}$/.test(code))return;submit.disabled=true;$('#join-feedback').textContent='正在加入小隊…';try{await onJoin(code);}finally{if(live(t)){submit.disabled=false;$('#join-feedback').textContent='';}}};bind();
  }else if(next==='records'){
   const done=rooms.filter(r=>r.finished||r.phase==='completed');frame.innerHTML=`<section class="card"><h2>我的共同紀錄冊</h2>${done.length?cards(done):'<p>完成小隊任務後，紀錄會留在這裡。</p>'}${back}</section>`;bind();
  }else{
   const pending=pendingTeams(rooms),done=rooms.some(r=>r.finished||r.phase==='completed');frame.innerHTML=`<div class="grid team-entry"><section class="card"><span class="badge">選卷・邀人</span><h2>我當隊長</h2><p>選好今天的題目，邀夥伴加入，人到齊後一起出發。</p><button type="button" class="primary" data-captain>選卷，邀夥伴 →</button></section><section class="card"><span class="badge">輸碼・加入</span><h2>我當隊員</h2><p>拿到隊長的邀請碼，加入後等隊長出發。</p><button type="button" class="green" data-member>輸入邀請碼 →</button></section></div>${pending.length?`<section class="card" id="resume-tasks"><h2>接續任務</h2><p>回到原來的小隊，不用重新組隊。</p>${cards(pending)}</section>`:''}<div class="actions"><button type="button" data-refresh>更新我的小隊</button>${done?'<button type="button" data-records>翻看共同紀錄冊</button>':''}</div>`;
   $('[data-captain]').onclick=()=>show('captain');$('[data-member]').onclick=()=>show('member');$('[data-refresh]').onclick=()=>onRefresh();if($('[data-records]'))$('[data-records]').onclick=()=>show('records');bind();
  }
 }
 show(initialMode);
 return {isMember:()=>mode==='member'&&frame.isConnected,feedback(message){const e=$('#join-feedback');if(e)e.textContent=message;},setRooms(next){rooms=next;if(mode==='home'||mode==='records')show(mode);}};
}

export function mountWaitingTeam({root,room,viewer,esc,sync,onRefresh,onStart,onResize,onLeave,onHome,notice,pageUrl}){
 const captain=room.host===viewer.id,count=room.members.length,full=count===room.capacity,host=room.members.find(m=>m.id===room.host);
 root.innerHTML=`<section class="card team-waiting"><div class="actions"><span id="sync" class="badge">${esc(sync)}</span><button type="button" id="refresh">更新狀態</button></div><span class="badge">${captain?'你是隊長':'你是隊員'}</span><h2>${esc(room.team)}</h2><p>${esc(room.paperInfo?.title||'共同任務')}・隊長：${esc(host?.name||'夥伴')}</p><p class="team-assembly" role="status">已加入 ${count}／${room.capacity} 位${full?'，人數到齊了！':`，還差 ${Math.max(0,room.capacity-count)} 位。`}</p>${captain?inviteMarkup({pageUrl,code:room.code,esc}):'<p class="team-member-wait">已加入小隊，等隊長按「一起出發」。</p>'}<div>${room.members.map(m=>`<div class="member"><div><b>${esc(m.name)}${m.id===viewer.id?'（我）':''}</b><span class="muted">・${esc(m.character)}${m.id===room.host?'・隊長':''}</span></div><span class="badge">已加入</span></div>`).join('')}</div><div class="actions">${captain?`<button type="button" id="start" class="primary" ${full?'':'disabled'}>一起出發 →</button>`:''}<button type="button" id="team-home">稍後接續</button><button type="button" id="leave">${captain?'退出小隊':'加錯隊？退出'}</button></div>${captain?`<p class="muted">${full?'人數到齊，可以由你帶大家出發。':'等夥伴加入後就能出發；也可以調整這次的人數。'}</p><label for="resize">預計人數（包含隊長）</label><select id="resize">${!partySizes(room.paperInfo).includes(room.capacity)?`<option value="${room.capacity}" selected disabled>原小隊 ${room.capacity} 人，請先符合題卷人數規則</option>`:''}${partySizes(room.paperInfo).map(n=>`<option value="${n}" ${n===room.capacity?'selected':''} ${n<count?'disabled':''}>${n} 人</option>`).join('')}</select>`:''}</section>`;
 const $=s=>root.querySelector(s);$('#refresh').onclick=onRefresh;$('#team-home').onclick=onHome;
 $('#leave').onclick=()=>{if(captain&&count>1&&!globalThis.confirm('退出後，會由最早加入的夥伴接任隊長。確定退出這個小隊嗎？'))return;onLeave();};
 if(captain){bindInvite(root,{code:room.code,notice});$('#start').onclick=onStart;$('#resize').onchange=e=>onResize(Number(e.target.value));}
}
