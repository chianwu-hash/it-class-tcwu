export function initQuizSessions({ root, request, local = false }) {
  let version = null, pendingOpen = null, timer, activeId = null, generation = 0, monitorGeneration = 0, enabled = false;
  let activePanel=null,monitoring=false;
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&enabled&&activeId&&activePanel&&!monitoring)void monitor(activeId,activePanel,generation,monitorGeneration);});
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const button = (text, action, cls = 'secondary') => { const b = node('button', text, cls); b.type = 'button'; b.addEventListener('click', () => action().catch(e => say(e.message))); return b; };
  const heading = node('h2', '◎ 開場與教師監看'), note = node('p', '先從「已固定的版本」選擇一個版本，再建立場次。', 'hint');
  const status = node('p'); status.setAttribute('role', 'status');
  const form = node('form'); form.hidden = true;
  const makeField = (label, initial, type = 'text') => { const l = node('label', label), i = node('input'); i.type = type; i.value = initial; l.append(i); form.append(l); return i; };
  const year = makeField('學年度', '115', 'number'), classes = makeField('適用班級（以逗號分開）', '603');
  const revealLabel = node('label', '揭答時機'), reveal = node('select');
  for (const [value, title] of [['immediate', '單題完成立即揭答；題組完成整組才揭答'], ['complete', '該學生自己完成整份後揭答']]) { const o = node('option', title); o.value = value; reveal.append(o); }
  revealLabel.append(reveal); form.append(revealLabel);
  const shuffleQuestions = makeField('題目亂序（題組位置暫固定）', '', 'checkbox');
  const shuffleOptions = makeField('選項亂序', '', 'checkbox');
  const open = node('button', '開啟新場次'); open.type = 'submit'; form.append(open);
  const controls = node('div', undefined, 'toolbar');
  controls.append(button('更新場次清單', refresh), button('暫停自動監看', async () => { clearTimeout(timer); monitorGeneration++; activeId = null; say('已暫停自動更新，可隨時重新監看。'); }));
  const list = node('div'); root.append(heading, note, form, controls, status, list);
  const say = text => { status.textContent = text; };
  const lockConfiguration = value => form.querySelectorAll('input,select').forEach(input => { input.disabled = value; });
  function linkFor(id) { const url = new URL('/grade6/115-1/quiz.html', location.origin); url.searchParams.set('session', id); if (local) url.searchParams.set('local', '1'); return url.href; }
  async function monitor(id, panel, token, monitorToken) {
    if (document.hidden || !enabled || generation !== token || monitorGeneration !== monitorToken || activeId !== id) return;
    monitoring=true;
    try {
      const data = await request('monitor', { session_id: id });
      if (generation !== token || monitorGeneration !== monitorToken || activeId !== id) return;
      panel.replaceChildren(node('p', `場次${data.status === 'open' ? '進行中' : '已結束'} · 已加入 ${data.students.length} / 29 位學生`));
      const table = node('table'), head = node('tr'); ['班級', '座號', '姓名', '個人進度'].forEach(t => head.append(node('th', t))); table.append(head);
      for (const s of data.students) { const row = node('tr'); [s.class_code, s.seat_no, s.display_name, `${s.answered} / ${s.total}`].forEach(t => row.append(node('td', String(t ?? '')))); table.append(row); }
      panel.append(table); say(`監看已更新：${new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
      if (data.status === 'closed') { activeId = null; return; }
    } catch (e) { if (generation === token && monitorGeneration === monitorToken) say(`監看尚未更新：${e.message}`); }
    finally{monitoring=false;}
    if (!document.hidden && enabled && generation === token && monitorGeneration === monitorToken && activeId === id) timer = setTimeout(() => monitor(id,panel,token,monitorToken),8000);
  }
  async function refresh() {
    if (!enabled) return;
    const token = generation;
    const { sessions } = await request('sessions'); if (token !== generation) return;
    clearTimeout(timer); monitorGeneration++; activeId = null; list.replaceChildren();
    if (!sessions.length) list.append(node('p', '還沒有場次。', 'hint'));
    for (const s of sessions) {
      const card = node('article', undefined, 'session-card'); card.dataset.sessionId = s.id;
      card.append(node('h3', `${s.title} · 固定第 ${s.revision} 版`), node('p', `${s.class_codes.join('、')} · ${s.status === 'open' ? '進行中' : '已結束'}`));
      const a = node('a', '學生加入連結', 'join-link'); a.href = linkFor(s.id); a.target = '_blank'; a.rel = 'noopener'; card.append(a);
      const address = node('input'); address.value = linkFor(s.id); address.readOnly = true; address.setAttribute('aria-label', '學生加入網址'); card.append(address);
      const actions = node('div', undefined, 'toolbar'), panel = node('div', undefined, 'session-monitor');
      actions.append(button('開始監看（每 8 秒更新）', async () => { clearTimeout(timer); monitorGeneration++; activeId = s.id;activePanel=panel; await monitor(s.id, panel, token, monitorGeneration); }));
      if (s.status === 'open') actions.append(button('結束場次', async () => {
        if (!confirm('確定結束本場次？結束後不再接受新答案，已保存紀錄仍保留。')) return;
        await request('close', { session_id: s.id }); await refresh(); say('場次已結束。');
      }, 'danger'));
      card.append(actions, panel); list.append(card);
    }
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!version || !enabled) return;
    if (!pendingOpen) {
      const codes = classes.value.split(/[,，、\s]+/).filter(Boolean);
      if (!codes.length || new Set(codes).size > 20 || codes.some(c => !/^[36]\d{2}$/.test(c))) return say('請填入完整班級，例如 603、604，最多 20 班。');
      if (!Number.isInteger(Number(year.value)) || Number(year.value) < 100 || Number(year.value) > 200) return say('請確認學年度，例如 115。');
      pendingOpen = { session_id: crypto.randomUUID(), version_id: version.id, school_year: Number(year.value), class_codes: [...new Set(codes)],
        reveal: reveal.value, shuffle_questions: shuffleQuestions.checked, shuffle_options: shuffleOptions.checked };
    }
    const token = generation; open.disabled = true; lockConfiguration(true);
    try {
      await request('open', pendingOpen); if (generation !== token) return;
      pendingOpen = null; lockConfiguration(false); open.textContent = '開啟新場次'; await refresh(); say('已開場。可複製加入連結，並開始監看。');
    } catch (e) {
      if (generation === token) { say(`${e.message}；可用相同設定重試，避免重複開場。`); open.textContent = '以相同設定重試開場'; }
    } finally { if (generation === token) open.disabled = false; }
  });
  return {
    selectVersion(v) { if (pendingOpen) return say('上次開場尚未確認，請先重試或更新場次清單。'); version = v; note.textContent = `已選擇：${v.title??v.document?.title} · 固定第 ${v.revision} 版`; form.hidden = false; root.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
    async setEnabled(value) { enabled = value; generation++; monitorGeneration++; clearTimeout(timer); activeId = null; pendingOpen = null; version = null; lockConfiguration(false); open.disabled = false; open.textContent = '開啟新場次'; form.hidden = true; list.replaceChildren(); note.textContent = '先從「已固定的版本」選擇一個版本，再建立場次。'; if (value) await refresh(); },
  };
}
