import { content, newDocument, newQuestion, importQuestionBank, validateDocument } from './quiz-document.mjs';
import { renderTeacherPreview } from './quiz-render.mjs?v=20261029-load-batch1';
import { initQuizSessions } from './quiz-sessions.mjs?v=20261029-load-batch2';
import { createQuizRequest } from './quiz-api.mjs?v=20261029-load-batch3';

const $ = id => document.getElementById(id);
let doc = newDocument(), bankId = crypto.randomUUID(), revision = 0, dirty = false, busy = false, request, identityKey, currentSession = null;
const sessions = initQuizSessions({ root: $('quiz-sessions'), request: (...args) => request(...args),
  local: new URLSearchParams(location.search).get('local') === '1' && ['localhost', '127.0.0.1'].includes(location.hostname) });
const labels = {
  login_required: '請先登入。', teacher_required: '這個帳號沒有教師權限。', bank_unavailable: '無法開啟這份題庫。',
  revision_changed: '其他頁面已更新草稿。你的輸入仍保留，請先下載備份，再重新開啟題庫。',
  invalid_document: '請確認測驗名稱及區塊。', invalid_question: '請確認題幹、公式媒體內容及識別碼。',
  invalid_options: '選擇題需有 2～8 個不同的選項。', invalid_answer: '請設定有效正解或可接受答案。',
};
const node = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
function message(text, error = false) { $('status').textContent = text; $('status').dataset.error = String(error); }
function markDirty() { dirty = true; updateRevision(); }
function updateRevision() { $('revision').textContent = `${revision ? `草稿第 ${revision} 版` : '尚未儲存'}${dirty ? ' · 有未儲存變更' : ''}`; }
function discard() { return !dirty || window.confirm('這份草稿有未儲存變更，確定離開？'); }
async function run(action) {
  if (busy) return;
  busy = true; $('workspace').inert = true;
  try { await action(); } catch (error) { message(labels[error.message] || error.message || '操作失敗，輸入仍保留。', true); }
  finally { busy = false; $('workspace').inert = false; }
}
function field(parent, title, value, change, type = 'input') {
  const label = node('label', title), input = node(type); input.value = value ?? '';
  input.addEventListener('input', () => { change(input.value); markDirty(); }); label.append(input); parent.append(label); return input;
}
function button(parent, title, click, className = 'secondary compact') {
  const b = node('button', title, className); b.type = 'button'; b.addEventListener('click', click); parent.append(b); return b;
}
function richField(parent, title, c) {
  const wrapper = node('div', undefined, 'content-editor');
  if (c.layout) {
    const text = field(wrapper, `${title}（原文）`, c.text, () => {}, 'textarea'); text.readOnly = true;
    wrapper.append(node('p', '此段保留匯入的原圖及表格結構；請用教師預覽檢視，修改來源後重新匯入。', 'hint'));
    parent.append(wrapper); return;
  }
  field(wrapper, title, c.text, v => { c.text = v; }, 'textarea');
  for (const [index, media] of c.media.entries()) {
    const row = node('div', undefined, 'media-row'); row.append(node('span', media.kind === 'image' ? '圖片' : '音檔'));
    field(row, 'HTTPS 網址', media.url, v => { media.url = v; });
    const alt = node('div', undefined, 'alt'); field(alt, '替代文字／音檔說明', media.alt, v => { media.alt = v; }); row.append(alt);
    button(row, '移除此媒體', () => { c.media.splice(index, 1); markDirty(); renderEditor(); }, 'danger compact'); wrapper.append(row);
  }
  const actions = node('div', undefined, 'media-buttons');
  for (const [kind, title] of [['image', '＋ 圖片網址'], ['audio', '＋ 音檔網址']]) {
    button(actions, title, () => { c.media.push({ kind, url: '', alt: '' }); markDirty(); renderEditor(); });
  }
  wrapper.append(actions); parent.append(wrapper);
}
function renderEditor() {
  const fields = $('editor-fields'); fields.replaceChildren();
  field(fields, '測驗名稱', doc.title, v => { doc.title = v; });
  const catalog = node('div', undefined, 'catalog');
  for (const [key, title] of Object.entries({ school_year: '學年度', subject: '科目', publisher: '版本／出版社', volume: '冊數', unit: '單元名／課名', learning_performance: '學習表現（選填）', learning_content: '學習內容（選填）' })) {
    field(catalog, title, doc.catalog[key], v => { doc.catalog[key] = v; });
  }
  fields.append(catalog);
  doc.blocks.forEach((block, bi) => {
    const section = node('section', undefined, 'block');
    const head = node('div', undefined, 'section-head'); head.append(node('h3', `區塊 ${bi + 1}${block.questions.length > 1 ? ' · 題組' : ''}`));
    const controls = node('div', undefined, 'inline');
    button(controls, '上移', () => moveBlock(bi, -1)).disabled = bi === 0;
    button(controls, '下移', () => moveBlock(bi, 1)).disabled = bi === doc.blocks.length - 1;
    button(controls, '刪除區塊', () => {
      if (doc.blocks.length === 1) return message('測驗至少保留一個區塊。', true);
      if (!confirm('刪除這個區塊與其中所有子題？')) return;
      doc.blocks.splice(bi, 1); markDirty(); renderEditor();
    }, 'danger compact'); head.append(controls); section.append(head);
    richField(section, '共用材料（文章、圖片、圖表或音檔）', block.material);
    block.questions.forEach((q, qi) => {
      const card = node('article', undefined, 'question');
      const qhead = node('div', undefined, 'section-head'); qhead.append(node('h4', `子題 ${qi + 1}`));
      if (block.questions.length > 1) button(qhead, '刪除子題', () => { block.questions.splice(qi, 1); markDirty(); renderEditor(); }, 'danger compact');
      card.append(qhead);
      const label = node('label', '題型'), select = node('select');
      for (const [value, text] of [['single', '選擇題（單選）'], ['short', '簡答題']]) {
        const option = node('option', text); option.value = value; select.append(option);
      }
      select.value = q.type; label.append(select); card.append(label);
      select.addEventListener('change', () => {
        if (!confirm('切換題型會清除這一題的選項與答案，題幹及解析保留。確定切換？')) { select.value = q.type; return; }
        const fresh = newQuestion(select.value); q.type = fresh.type; q.answer = fresh.answer;
        if (fresh.options) q.options = fresh.options; else delete q.options;
        markDirty(); renderEditor();
      });
      richField(card, '題幹', q.prompt);
      if (q.type === 'single') {
        q.options.forEach((option, oi) => {
          const row = node('div', undefined, 'option-editor'); row.append(node('span', String.fromCharCode(65 + oi)));
          const body = node('div'); richField(body, '選項內容', option.content);
          if (q.options.length > 2) button(body, '移除選項', () => {
            q.options.splice(oi, 1); if (q.answer.option_id === option.id) q.answer.option_id = q.options[0].id;
            markDirty(); renderEditor();
          }, 'danger compact'); row.append(body); card.append(row);
        });
        if (q.options.length < 8) button(card, '＋ 新增選項', () => { q.options.push({ id: crypto.randomUUID(), content: content() }); markDirty(); renderEditor(); });
        const answerLabel = node('label', '正確選項'), answer = node('select');
        q.options.forEach((o, i) => { const opt = node('option', String.fromCharCode(65 + i)); opt.value = o.id; answer.append(opt); });
        answer.value = q.answer.option_id; answer.addEventListener('change', () => { q.answer.option_id = answer.value; markDirty(); }); answerLabel.append(answer); card.append(answerLabel);
      } else {
        field(card, '可接受答案（每行一個）', q.answer.accepted.join('\n'), v => { q.answer.accepted = v.split('\n').filter(s => s.trim()); }, 'textarea');
        card.append(node('p', '初版只忽略答案頭尾空白；大小寫、全半形與單位仍須符合其中一個答案。', 'hint'));
      }
      richField(card, '解析', q.explanation); section.append(card);
    });
    button(section, '＋ 加入子題（共用上方材料）', () => { block.questions.push(newQuestion()); markDirty(); renderEditor(); });
    fields.append(section);
  });
  updateRevision();
}
function moveBlock(index, delta) {
  const [block] = doc.blocks.splice(index, 1); doc.blocks.splice(index + delta, 0, block); markDirty(); renderEditor();
}
function preview(documentToShow, title) {
  renderTeacherPreview($('preview-body'), documentToShow); $('preview-title').textContent = title;
  if (!$('preview-dialog').open) $('preview-dialog').showModal();
}
async function refreshBanks() {
  const { banks } = await request('list', { search: $('search').value });
  $('bank-list').replaceChildren();
  if (!banks.length) $('bank-list').append(node('p', '目前沒有符合的題庫。', 'hint'));
  for (const bank of banks) {
    const b = button($('bank-list'), `${bank.title} · 草稿 ${bank.revision}`, () => run(async () => {
      if (!discard()) return;
      const loaded = await request('get', { bank_id: bank.id });
      doc = loaded.draft; bankId = loaded.id; revision = loaded.revision; dirty = false;
      renderEditor(); await refreshBanks(); await refreshVersions(); message('已開啟草稿。');
    }), 'bank-item'); b.setAttribute('aria-current', String(bank.id === bankId));
  }
}
async function refreshVersions() {
  $('versions').replaceChildren();
  if (!revision) { $('versions').append(node('p', '儲存草稿後，即可固定版本。', 'hint')); return; }
  const owner=identityKey,bank=bankId;
  const { versions } = await request('version_list', { bank_id: bank });
  if(owner!==identityKey||bank!==bankId)return;
  if (!versions.length) $('versions').append(node('p', '還沒有固定版本。', 'hint'));
  for (const v of versions) {
    const row = node('div', undefined, 'version-row'); row.append(node('span', `第 ${v.revision} 版 · ${new Date(v.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`));
    button(row, '預覽此版本', () => run(async()=>{
      const version=await request('version_get',{bank_id:bank,version_id:v.id});
      if(owner!==identityKey||bank!==bankId)return;
      preview(version.document,`${version.document.title} · 固定第 ${version.revision} 版`);
    })); $('versions').append(row);
    button(row, '用此版本開場', () => sessions.selectVersion(v));
  }
}
async function saveDraft() {
  validateDocument(doc);
  // 驗證公式但不載入任何預覽媒體；附件的可達性需在預覽中檢查。
  const probe = document.createElement('div'); renderTeacherPreview(probe, doc, { strict: true, loadMedia: false });
  const saved = await request('save', { bank_id: bankId, expected_revision: revision, document: doc });
  revision = saved.revision; dirty = false; updateRevision(); await refreshBanks(); await refreshVersions(); return saved;
}
function reset(documentToLoad = newDocument()) {
  doc = documentToLoad; bankId = crypto.randomUUID(); revision = 0; dirty = true; renderEditor();
  $('versions').replaceChildren(node('p', '尚未固定版本。', 'hint')); message('新草稿尚未儲存。');
}
function bind() {
  $('new-bank').addEventListener('click', () => { if (discard()) reset(); });
  $('search-form').addEventListener('submit', e => { e.preventDefault(); run(refreshBanks); });
  $('save').addEventListener('click', () => run(async () => { await saveDraft(); message('草稿已儲存。'); }));
  $('publish').addEventListener('click', () => run(async () => {
    await saveDraft(); const version = await request('publish', { bank_id: bankId, expected_revision: revision });
    await refreshVersions(); $('history').open = true; message(`已固定第 ${version.revision} 版。之後修改草稿不會影響這個版本。`);
  }));
  $('preview').addEventListener('click', () => run(async () => preview(doc, `${doc.title} · 草稿預覽`)));
  $('close-preview').addEventListener('click', () => { $('preview-dialog').querySelectorAll('audio').forEach(a => a.pause()); $('preview-dialog').close(); });
  $('preview-dialog').addEventListener('close', () => $('preview-dialog').querySelectorAll('audio').forEach(a => a.pause()));
  for (const [id, group] of [['add-single', false], ['add-group', true]]) $(id).addEventListener('click', () => {
    doc.blocks.push({ id: crypto.randomUUID(), material: content(), questions: group ? [newQuestion(), newQuestion('short')] : [newQuestion()] }); markDirty(); renderEditor();
  });
  $('export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    const link = node('a'); link.href = url; link.download = `題庫備份-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  for (const [id, parser] of [['import-md', importQuestionBank], ['import-json', JSON.parse]]) $(id).addEventListener('change', e => run(async () => {
    const file = e.target.files[0]; e.target.value = ''; if (!file || !discard()) return;
    if (file.size > 1000000) throw new Error('匯入檔案上限為 1 MB。');
    const candidate = validateDocument(parser(await file.text()));
    // 在獨立的 DOM 預先驗證結構，失敗不替換當前草稿。
    renderTeacherPreview(document.createElement('div'), candidate, { strict: true, loadMedia: false });
    reset(candidate); message('已匯入為新草稿，請儲存後再固定版本。');
  }));
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
}
async function start() {
  bind(); renderEditor();
  if (new URLSearchParams(location.search).get('local') === '1' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    const health = await fetch('/__quiz-local', { cache: 'no-store' }).then(r => r.json());
    if (!health.local) throw new Error('本機測試服務尚未啟動。');
    request = await createQuizRequest({ local: true });
    $('identity').textContent = '本機合成教師'; $('environment').hidden = false;
    document.querySelector('.back').hidden = true;
    $('environment').textContent = '本機測試模式：使用合成身分與本機資料，未連線正式 Supabase。';
    $('workspace').hidden = false; await refreshBanks(); await refreshVersions(); await sessions.setEnabled(true); message('可建立測驗，或匯入現有 Markdown 題庫。'); return;
  }
  const auth = await import('./auth.js');
  const showSession = async session => {
    currentSession = session;
    const key = session?.user?.id || ''; if (identityKey === key) return; identityKey = key;
    $('identity').replaceChildren(node('span', session?.user?.email || '未登入'));
    if (session) button($('identity'), '登出', () => auth.signOutAndReload());
    $('workspace').hidden = !auth.isTeacher(session); $('locked').hidden = auth.isTeacher(session);
    $('preview-dialog').close();$('preview-body').replaceChildren();$('preview-title').textContent='';doc = newDocument(); bankId = crypto.randomUUID(); revision = 0; dirty = false;
    $('versions').replaceChildren(); $('bank-list').replaceChildren(); renderEditor();
    if (!auth.isTeacher(session)) { await sessions.setEnabled(false); message(session ? '此帳號沒有教師權限。' : '請登入後開始備課。'); return; }
    request = await createQuizRequest({ getSession: () => currentSession });
    await run(async () => { await refreshBanks(); await sessions.setEnabled(true); message('教師題庫已就緒。'); });
  };
  $('quiz-login').addEventListener('click', () => auth.beginCentralizedLogin());
  auth.supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => showSession(session).catch(e => message(e.message, true)), 0); });
  await showSession(await auth.resolveSession());
}
start().catch(error => message(error.message, true));
