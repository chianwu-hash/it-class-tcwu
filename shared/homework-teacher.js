import { initNavbarAuth } from './navbar-auth.js';
import { isTeacher } from './auth.js';
import { homeworkRequest, homeworkStatus } from './homework-api.js';
const $ = id => document.getElementById(id);
const status = $('homework-status');
let session = null, busy = false, generation = 0, selected = null, roster = null;
function el(tag, text, cls) { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; }
function lock() { $('teacher-tools').querySelectorAll('button,fieldset').forEach(n => { n.disabled = busy || !isTeacher(session); }); }
async function call(action, data={}, edge=false, g=generation) {
  if (g!==generation || !isTeacher(session)) throw new Error('請先登入網站教師帳號。');
  const result = await homeworkRequest(session,action,data,edge);
  if (g!==generation) throw new Error('登入帳號已變更。');
  return result;
}
async function run(task) {
  if (busy || !isTeacher(session)) return; busy=true; lock(); const g=generation;
  try { await task(g); } catch(e) { if (g===generation) status.textContent=e.message; }
  finally { busy=false; lock(); if(g!==generation&&isTeacher(session))setTimeout(()=>run(load),0); }
}
async function load(g) {
  const data=await call('list',{},false,g); const container=$('assignment-list'); container.replaceChildren();
  status.textContent=`共 ${data.assignments.length} 份作業。單檔上限 ${Math.floor(data.max_file_bytes/1048576)} MB，支援影片分段上傳。`;
  for (const a of data.assignments) {
    const card=el('article','','card'); card.append(el('h2',`第 ${Number(a.week_code)} 週・${a.title}`));
    card.append(el('p',`${a.class_code==='*'?'全部六年級':a.class_code} · ${{draft:'草稿',open:'收件中',closed:'已關閉'}[a.state]}`));
    card.append(el('p',a.instructions,'feedback')); const actions=el('div','','actions');
    const toggle=el('button',a.state==='open'?'關閉收件':'開放收件');
    toggle.addEventListener('click',()=>run(async current=>{
      status.textContent=a.state==='open'?'正在關閉收件…':'正在確認學校 Drive 資料夾並開放收件…';
      await call(a.state==='open'?'set_state':'open',{assignment_id:a.id,state:'closed'},a.state!=='open',current); await load(current);
    }));
    const view=el('button','查看收件與評比','secondary'); view.addEventListener('click',()=>run(async current=>{selected=a.id;await loadRoster(current);}));
    actions.append(toggle,view); card.append(actions); container.append(card);
  }
  if(selected) await loadRoster(g);
}
async function loadRoster(g) {
  roster=await call('roster',{assignment_id:selected},false,g); $('roster-panel').hidden=false;
  $('roster-title').textContent=roster.assignment.title; renderRoster();
}
function renderRoster() {
  if(!roster)return;
  const summary=$('roster-summary');summary.replaceChildren();
  for(const code of ['missing','submitted','needs_revision','passed']) summary.append(el('span',`${homeworkStatus[code]} ${roster.students.filter(s=>s.status===code).length} 人`));
  const container=$('roster-list');container.replaceChildren();
  const filter=$('status-filter').value;
  for(const s of roster.students.filter(s=>filter==='all'||s.status===filter)) {
    const row=el('article','','student-row');row.append(el('h3',`${s.class_code} 班 ${s.seat_no} 號 ${s.display_name}`));
    row.append(el('span',homeworkStatus[s.status],`badge ${s.status}`));
    if(s.upload_id) {
      const link=el('a',s.file_name,'file-name');link.href=`https://drive.google.com/file/d/${encodeURIComponent(s.drive_file_id)}/view`;link.target='_blank';link.rel='noopener noreferrer';
      const p=el('p');p.append(link);row.append(p,el('p',new Date(s.submitted_at).toLocaleString('zh-TW'),'note'));
      const label=el('label','老師回饋');const feedback=el('textarea');feedback.maxLength=2000;feedback.value=s.feedback||'';feedback.id=`feedback-${s.user_id}`;label.htmlFor=feedback.id;
      const actions=el('div','','actions');
      for(const code of ['passed','needs_revision']) {
        const button=el('button',code==='passed'?'評為過關':'請再修改',code==='passed'?'':'secondary');
        button.addEventListener('click',()=>run(async current=>{
          await call('review',{assignment_id:roster.assignment.id,user_id:s.user_id,upload_id:s.upload_id,status:code,feedback:feedback.value},false,current);
          await loadRoster(current);status.textContent='評比與努力樹紀錄已同步保存。';
        }));actions.append(button);
      }
      row.append(label,feedback,actions);
    }
    container.append(row);
  }
  if(!container.children.length)container.append(el('p','這個篩選條件下沒有學生。','note'));lock();
}
$('status-filter').addEventListener('change',renderRoster);
$('refresh-homework').addEventListener('click',()=>run(load));
$('create-homework').addEventListener('submit',e=>{e.preventDefault();run(async g=>{
  await call('create',{week_code:String(Number($('week').value)).padStart(2,'0'),class_code:$('class-code').value.trim(),title:$('title').value.trim(),instructions:$('instructions').value},false,g);
  $('title').value='';$('instructions').value='';await load(g);status.textContent='作業草稿已保存。請確認內容後按「開放收件」。';
});});
initNavbarAuth({onSessionResolved(next){
  const changed=session?.user?.id!==next?.user?.id;session=next;
  if(changed){generation++;selected=null;roster=null;$('assignment-list').replaceChildren();$('roster-list').replaceChildren();$('roster-panel').hidden=true;}
  $('teacher-tools').hidden=!isTeacher(session);lock();
  if(!isTeacher(session)){status.textContent='請先登入網站教師帳號（chianwu@gmail.com）。';return;}
  if(changed)setTimeout(()=>run(load),0);
}});
