import { initNavbarAuth } from './navbar-auth.js';
import { isTeacher } from './auth.js';
import { homeworkRequest, homeworkStatus } from './homework-api.js';
const status = document.getElementById('homework-status');
const list = document.getElementById('homework-list');
const refresh = document.getElementById('refresh-homework');
let session = null, busy = false, generation = 0, maxSize = 104857600, pendingStorageKey = null;
function el(tag, text, cls) { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; }
function lock() { refresh.disabled = busy || !session?.user; list.querySelectorAll('fieldset').forEach(n => { n.disabled = busy || !session?.user; }); }
async function run(task) {
  if (busy || !session?.user) return;
  busy = true; lock(); const g = generation;
  try { await task(g); } catch (e) {
    if (e.code === 'upload_expired' && pendingStorageKey) sessionStorage.removeItem(pendingStorageKey);
    if (g === generation) status.textContent = e.message || '連線中斷，請接續重試。';
  }
  finally { busy = false; lock(); if (g !== generation && session?.user) setTimeout(() => run(load),0); }
}
async function call(action, data, edge, g) {
  if (g !== generation) throw new Error('登入身分已變更，請重新操作。');
  const result = await homeworkRequest(session, action, data, edge);
  if (g !== generation) throw new Error('登入身分已變更，請重新操作。');
  return result;
}
async function load(g) {
  const data = await call('list', {}, false, g); maxSize = data.max_file_bytes;
  list.replaceChildren();
  status.textContent = data.assignments.length ? `每份作業一個檔案，最多 ${Math.floor(maxSize/1048576)} MB。可交 Canva 影片、圖片、文件或 Scratch。` : '目前還沒有老師開放的作業。';
  if (data.teacher) status.textContent = '你目前是老師帳號；請至收件後台管理作業。學生使用名冊中的學校帳號交件。';
  for (const a of data.assignments) {
    const card = el('section', '', 'card'); card.append(el('h2', `第 ${Number(a.week_code)} 週・${a.title}`));
    card.append(el('p', a.instructions, 'feedback'));
    const s = a.submission;
    card.append(el('span', homeworkStatus[s?.status || 'missing'], `badge ${s?.status || ''}`));
    if (s) card.append(el('p', `${s.file_name} · ${new Date(s.submitted_at).toLocaleString('zh-TW')}`, 'file-name'));
    if (s?.feedback) card.append(el('p', `老師回饋：${s.feedback}`, 'feedback'));
    if (a.state !== 'open' || data.teacher) { card.append(el('p', a.state === 'closed' ? '老師已關閉收件。' : '請使用學生帳號繳交。', 'note')); list.append(card); continue; }
    const form = el('form'), field = el('fieldset'), input = el('input'); input.type = 'file'; input.required = true;
    input.accept = '.mp4,.webm,.mov,.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.sb3,.txt,.zip';
    input.id = `file-${a.id}`; const label = el('label', s ? '選擇新的作品版本' : '選擇作品檔案'); label.htmlFor = input.id;
    const button = el('button', s ? '重交／接續重試' : '上傳／接續重試'); button.type = 'submit';
    const progress = el('progress'); progress.max = 100; progress.value = 0; progress.setAttribute('aria-label','上傳進度');
    const note = el('p', '中斷時保留此頁，按同一按鈕接續。重整後可在 24 小時內重新選相同檔案。', 'note');
    field.append(label,input,el('p',s ? '重交會保留舊檔，最新版本將重新等待老師評比。' : '', 'note'),button); form.append(field,progress,note); card.append(form); list.append(card);
    form.addEventListener('submit', e => { e.preventDefault(); run(async current => {
      const file = input.files[0]; if (!file) return;
      if (!file.size || file.size > maxSize) throw new Error(`請選擇非空白且不超過 ${Math.floor(maxSize/1048576)} MB 的檔案。`);
      status.textContent = '正在確認檔案，請稍候…';
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), x => x.toString(16).padStart(2,'0')).join('');
      const key = `homework-upload:${session.user.id}:${a.id}`;
      pendingStorageKey = key;
      let pending; try { pending = JSON.parse(sessionStorage.getItem(key)); } catch { /* Optional recovery metadata. */ }
      if (!pending || pending.sha256 !== digest || pending.name !== file.name || pending.size !== file.size || pending.expires < Date.now()) {
        pending = { id: crypto.randomUUID(), sha256: digest, name: file.name, size: file.size, expires: Date.now()+86400000 };
        // Only a temporary upload handle. No completed progress, tokens or file bytes.
        sessionStorage.setItem(key, JSON.stringify(pending));
      }
      let result = await call('prepare', { assignment_id: a.id, id: pending.id, file_name: file.name, file_size: file.size, sha256: digest }, true, current);
      let stalls = 0;
      while (!result.done) {
        if (!Number.isInteger(result.offset) || result.offset < 0 || result.offset > file.size || stalls > 2) throw new Error('上傳暫停，請按接續重試。');
        progress.value = Math.floor(result.offset/file.size*100); note.textContent = `已上傳 ${progress.value}%`;
        status.textContent = `正在上傳 ${file.name}（${progress.value}%）…請保留此頁。`;
        const form = new FormData(); form.set('assignment_id',a.id); form.set('id',pending.id); form.set('offset',String(result.offset));
        form.set('chunk',file.slice(result.offset,Math.min(result.offset+4*1024*1024,file.size)),'chunk.bin');
        const next = await call('chunk', form, true, current);
        stalls = next.offset <= result.offset ? stalls+1 : 0; result = next;
      }
      sessionStorage.removeItem(key); progress.value = 100; await load(current);
      status.textContent = '已繳交，雲端檔案已確認完整！等待老師評比。';
    }); });
  }
  lock();
}
refresh.addEventListener('click', () => run(load));
initNavbarAuth({ onSessionResolved(next) {
  const changed = session?.user?.id !== next?.user?.id; session = next;
  document.getElementById('teacher-homework').classList.toggle('hidden',!isTeacher(session));
  if (changed) { generation++; list.replaceChildren(); }
  lock();
  if (!session?.user) { status.textContent = '請先登入學校 Google 帳號。'; return; }
  if (changed) setTimeout(() => run(load),0);
} });
