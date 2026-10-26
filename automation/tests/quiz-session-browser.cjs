// 登記 AI Work Browser 的本機測試；不接正式 Supabase。
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const runtime = createRequire('D:/projects/cdp-tools/package.json');
const { connectCdp, safeScreenshot } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async () => {
  const url = 'http://127.0.0.1:4340/admin-quiz.html?local=1';
  const connection = await connectCdp({ cdpUrl: process.env.CDP_URL, targetUrl: url, puppeteer: runtime('puppeteer-core') });
  const { browser } = connection;
  const target = browser.targets().find(t => t._targetId === process.argv[2]); assert.ok(target, '已取得的教師分頁必須存在');
  const teacher = await target.page(), owned = [], errors = [], report = {};
  const out = path.resolve('automation/output/quiz'); await fs.mkdir(out, { recursive: true });
  let phase = '初始化';
  const step = async text => { phase = text; await fs.writeFile(path.join(out, 'session-phase.txt'), text, 'utf8'); };
  const watchdog = setTimeout(() => { console.error(`測驗瀏覽器驗證逾時：${phase}`); browser.disconnect(); process.exitCode = 1; }, 240000);
  const wait = (p, fn, ...args) => p.waitForFunction(fn, { polling: 'mutation', timeout: 25000 }, ...args);
  const status = (p, text) => wait(p, t => document.querySelector('#status')?.textContent.includes(t), text);
  // 背景多分頁驗證使用 DOM 控制項事件，避免捲動等待背景 rAF。
  const click = (p, selector) => p.$eval(selector, e => e.click());
  const teacherCall = (action, data = {}) => teacher.evaluate(async (a, d) => {
    const r = await fetch(a === 'publish' ? '/__quiz-media' : '/__quiz-rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: a === 'publish' ? 'freeze' : a, data: d }) });
    const body = await r.json(); if (!r.ok) throw new Error(JSON.stringify(body)); return body;
  }, action, data);
  const studentPath = (id, n) => `http://127.0.0.1:4340/grade6/115-1/quiz.html?local=1&session=${id}&student=${n}`;
  const last = p => p.evaluate(() => window.__quizResponses?.at(-1));
  async function activateForMedia(p) {
    const session = await p.target().createCDPSession();
    try {
      if (typeof session.grantForegroundOnce !== 'function') throw new Error('共用保護工具不支援單次分頁啟用');
      session.grantForegroundOnce('Page.bringToFront', '驗證本次合成學生分頁音檔；Chrome 延後從未顯示分頁的媒體載入');
      await session.send('Page.bringToFront');
      assert.equal(await p.evaluate(() => document.visibilityState), 'visible');
    } finally { await session.detach(); }
  }
  const decodeMedia = async (p, activate = true) => {
    if (activate) await activateForMedia(p);
    let deadline;
    try { return await Promise.race([p.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('#server-quiz img')].map(i => i.complete && i.naturalWidth ? Promise.resolve() : new Promise((ok, fail) => { i.onload = ok; i.onerror = fail; })));
    const a = document.querySelector('#server-quiz audio');
    if (a && a.readyState < 2) await new Promise((ok, fail) => { a.onloadeddata = ok; a.onerror = fail; a.load(); });
    }), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('合成媒體20秒內未完成解碼')), 20000); })]); }
    finally { clearTimeout(deadline); }
  };
  const wav = Buffer.alloc(8044); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(8000, 40);
  async function student(id, n) {
    const p = await browser.newPage(); owned.push(p); p.on('pageerror', e => errors.push(e.message));
    await p.evaluateOnNewDocument(() => {
      window.__quizResponses = []; window.__quizCalls = []; const original = window.fetch;
      window.fetch = async (...args) => {
        const rpc = String(args[0]).includes('__quiz-rpc'); const entry = rpc ? { action: JSON.parse(args[1].body).action, started: performance.now() } : null;
        if (entry) window.__quizCalls.push(entry);
        try { const r = await original(...args); if (entry) { entry.elapsed = performance.now() - entry.started; entry.status = r.status; }
          if (rpc && r.ok) window.__quizResponses.push(await r.clone().json()); return r;
        } catch (e) { if (entry) entry.error = e.message; throw e; }
      };
    });
    await p.setRequestInterception(true); // 只為驗證合成媒體，不讀其他站點。
    p.on('request', async req => {
      if (req.url().startsWith('https://quiz-media.example.invalid/')) await req.respond(req.url().endsWith('.wav')
        ? { contentType: 'audio/wav', headers: { 'Access-Control-Allow-Origin': '*' }, body: wav }
        : { contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#ded8f4"/></svg>' });
      else await req.continue();
    });
    await p.goto(studentPath(id, n), { waitUntil: 'domcontentloaded' });
    await wait(p, () => Boolean(document.querySelector('#server-submit')) || document.querySelector('#server-quiz')?.textContent.includes('名額已滿'));
    return p;
  }
  async function startAnswer(p, value) {
    await p.evaluate(v => {
      const area = document.querySelector('#server-quiz textarea');
      if (area) { area.value = v; area.dispatchEvent(new Event('input', { bubbles: true })); }
      else { const input = [...document.querySelectorAll('#server-quiz input[type=radio]')].find(e => e.value === v); if (!input) throw new Error('選項不存在'); input.click(); }
      const submit = document.querySelector('#server-submit'); if (!submit || submit.disabled) throw new Error('送答按鈕尚未可用'); submit.click();
    }, value);
  }
  async function answer(p, value) {
    await startAnswer(p, value);
    await wait(p, () => document.querySelector('#server-quiz [role=status]').textContent.includes('答案已保存'));
  }
  const next = async p => { await p.evaluate(() => [...document.querySelectorAll('#server-quiz button')].find(b => b.textContent === '下一題').click()); };
  try {
    teacher.on('dialog', d => d.accept()); await teacher.goto(url, { waitUntil: 'networkidle0' }); await status(teacher, '可建立測驗');
    if (process.argv.includes('--visual-only')) {
      const baseline = await browser.newPage(); owned.push(baseline); await baseline.setViewport({ width: 1280, height: 1000 });
      const html = (await fs.readFile('grade6/week17.html', 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, text => text.includes('cdn.tailwindcss.com') ? text : '');
      await baseline.setContent(html, { waitUntil: 'domcontentloaded' });
      await wait(baseline, () => getComputedStyle(document.querySelector('header')).backgroundImage.includes('gradient'));
      await safeScreenshot(baseline, { path: path.join(out, 'reference-week17-desktop.png') });
      await baseline.setViewport({ width: 390, height: 844 }); await safeScreenshot(baseline, { path: path.join(out, 'reference-week17-mobile.png') });
      const links = JSON.parse(await fs.readFile(path.join(out, 'demo-links.json'), 'utf8'));
      const demoId = new URL(links.immediate).searchParams.get('session'); const demo = await student(demoId, 1);
      await activateForMedia(demo); await demo.setViewport({ width: 1280, height: 1000 }); await demo.evaluate(() => document.fonts.ready);
      await demo.click('input[type=radio]');
      const borders = await demo.evaluate(() => ({ selected: parseFloat(getComputedStyle(document.querySelector('.student-option:has(input:checked)')).borderTopWidth), unselected: parseFloat(getComputedStyle(document.querySelector('.student-option:has(input:not(:checked))')).borderTopWidth) }));
      assert.ok(borders.selected > borders.unselected, '選取後的邊框必須明顯加粗，容許瀏覽器縮放的像素取整');
      await safeScreenshot(demo, { path: path.join(out, 'student-question-desktop.png') });
      await demo.setViewport({ width: 390, height: 844 }); assert.ok(await demo.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await safeScreenshot(demo, { path: path.join(out, 'student-question-mobile.png') });
      await fs.writeFile(path.join(out, 'student-visual-qa.json'), JSON.stringify({ reference: 'grade6/week17.html（移除互動程式後渲染）', sizes: [1280, 390], computedBorders: borders, mobileNoOverflow: true, fractionRendered: await demo.$$('.mfrac').then(x => x.length > 0) }, null, 2), 'utf8');
      console.log('學生入口與固定視覺基準已渲染；選取邊框、分數與390px版面通過。'); return;
    }
    await step('舊模式回歸');
    report.legacy = await teacher.evaluate(async () => {
      const { initQuizModule } = await import('/shared/quiz-module.js');
      const host = document.createElement('div'); host.innerHTML = '<div id="legacy-lock"></div><div id="legacy-content"><div id="quiz-container"></div></div>'; document.body.append(host);
      let score = null, completed = 0;
      const quiz = initQuizModule({ questions: [{ id: 901, questionHtml: '舊模式測試', options: [{ text: '甲', correct: true }, { text: '乙', correct: false }] }],
        selectors: { lock: 'legacy-lock', content: 'legacy-content', container: 'quiz-container' }, getCurrentUser: () => ({ id: 'synthetic' }), loadProgress: async () => null,
        saveProgress: async s => { score = s; }, onAfterSubmit: () => { completed++; } });
      await quiz.handleAuthChange(null); const locked = !document.querySelector('#quiz-container button');
      await quiz.handleAuthChange({ user: { id: 'synthetic' } }); quiz.selectOption(901, document.querySelector('[data-correct=true]')); await quiz.submit();
      const passed = score === 1 && completed === 1; host.remove();
      const pHost = document.createElement('div'); pHost.innerHTML = '<div id="p-lock"></div><div id="p-content"><div id="p-container"></div></div>'; document.body.append(pHost);
      let practiceScore = 0;
      const practice = initQuizModule({ mode: 'practice', questions: [{ id: 1, questionHtml: '逐題練習', options: [{ text: '甲', correct: true }] }],
        selectors: { lock: 'p-lock', content: 'p-content', container: 'p-container' }, getCurrentUser: () => ({ id: 'synthetic' }), loadProgress: async () => null, saveProgress: async s => { practiceScore = s; } });
      await practice.handleAuthChange({ user: { id: 'synthetic' } }); document.querySelector('#p-container button').click();
      await new Promise(resolve => setTimeout(resolve, 0)); pHost.remove(); return { locked, scoredSaved: passed, practiceSaved: practiceScore === 1 };
    });
    assert.deepEqual(report.legacy, { locked: true, scoredSaved: true, practiceSaved: true });
    report.authLifecycle = await teacher.evaluate(async () => {
      const { initQuizModule } = await import('/shared/quiz-module.js');
      const host = document.createElement('div'); host.innerHTML = '<div id="s-lock"></div><div id="s-content" hidden><div id="s-container"></div></div>'; document.body.append(host);
      let resolveFirst, calls = 0;
      const payload = title => ({ document: { title, questions: [{ id: 'q', type: 'single', block_id: 'b', material: { text: '', media: [] }, prompt: { text: '安全題目', media: [] }, options: [{ id: 'a', content: { text: '甲', media: [] } }] }] }, responses: {}, reviews: [], status: 'open', complete: false });
      const quiz = initQuizModule({ mode: 'server', selectors: { lock: 's-lock', content: 's-content', container: 's-container' }, server: { sessionId: 'synthetic', request: () => {
        calls++; return calls === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve(payload('學生乙'));
      } } });
      await quiz.handleAuthChange(null); const anonymousCalls = calls;
      const first = quiz.handleAuthChange({ user: { id: 'student-a' } });
      await quiz.handleAuthChange({ user: { id: 'student-b' } }); resolveFirst(payload('學生甲')); await first;
      const isolated = document.querySelector('#s-container').textContent.includes('學生乙') && !document.querySelector('#s-container').textContent.includes('學生甲');
      await quiz.handleAuthChange(null); const cleared = document.querySelector('#s-container').textContent === '' && document.querySelector('#s-content').hidden;
      host.remove(); return { anonymousCalls, isolated, cleared };
    });
    assert.deepEqual(report.authLifecycle, { anonymousCalls: 0, isolated: true, cleared: true });
    report.guestRegression = await teacher.evaluate(async () => {
      const { initQuizModule } = await import('/shared/quiz-module.js');
      const host = document.createElement('div'); host.innerHTML = '<div id="g-lock"></div><div id="g-content"><div id="quiz-container"></div><div id="g-banner"><span id="g-status"></span></div></div>'; document.body.append(host);
      let grade = 0, saved = 0;
      const quiz = initQuizModule({ mode: 'assessment', questions: [{ id: 902, questionHtml: '舊身分卡測驗', options: [{ text: '甲', correct: true }] }],
        selectors: { lock: 'g-lock', content: 'g-content', container: 'quiz-container', statusBanner: 'g-banner', statusText: 'g-status' },
        requireAuth: false, getCurrentUser: () => null, saveGuestProgress: async () => { throw new Error('合成保存失敗'); }, onAfterGrade: () => { grade++; }, onAfterSubmit: () => { saved++; } });
      await quiz.handleAuthChange(null); quiz.selectOption(902, host.querySelector('[data-correct=true]')); await quiz.submit();
      const result = { gradeBeforeSave: grade === 1, savedCallbackNotCalled: saved === 0, scorePreserved: host.querySelector('#quiz-result-score').textContent.includes('1 / 1'), retryEnabled: !host.querySelector('#quiz-submit-btn').disabled };
      host.remove(); return result;
    });
    assert.ok(Object.values(report.guestRegression).every(Boolean));
    if (process.argv.includes('--module-only')) {
      await fs.writeFile(path.join(out, 'module-regression-qa.json'), JSON.stringify({ legacy: report.legacy, authLifecycle: report.authLifecycle, guestRegression: report.guestRegression }, null, 2), 'utf8');
      console.log(JSON.stringify({ legacy: report.legacy, authLifecycle: report.authLifecycle, guestRegression: report.guestRegression })); return;
    }
    const { newDocument, newQuestion, content } = await import(pathToFileURL(path.resolve('shared/quiz-document.mjs')));
    const doc = newDocument(); doc.title = `學生流程驗證 ${Date.now()}`;
    doc.blocks[0].questions[0].explanation.text = '單題秘密解析';
    const q2 = newQuestion('short'); q2.answer.accepted = ['空氣']; q2.explanation.text = '題組秘密解析';
    const q3 = newQuestion(); q3.answer.option_id = 'b'; q3.explanation.text = '題組第三題解析';
    const q4 = newQuestion('short'); q4.answer.accepted = ['完成'];
    doc.blocks.push({ id: crypto.randomUUID(), material: content('共用材料與音檔', [
      { kind: 'image', url: 'https://quiz-fixture.example.invalid/test.png', alt: '合成材料圖' },
      { kind: 'audio', url: 'https://quiz-fixture.example.invalid/test.wav', alt: '合成音檔' },
    ]), questions: [q2, q3] }, { id: crypto.randomUUID(), material: content(), questions: [q4] });
    await step('教師介面開場');
    const fixture = path.join(out, 'session-bank.json'); await fs.writeFile(fixture, JSON.stringify(doc), 'utf8');
    await (await teacher.$('#import-json')).uploadFile(fixture); await status(teacher, '已匯入為新草稿'); await step('已匯入，固定版本');
    await click(teacher, '#publish'); await status(teacher, '已固定第 1 版'); await step('已固定，選版本開場');
    await teacher.$eval('#history', e => { e.open = true; }); await click(teacher, '#versions button:last-child'); await step('已選版本，送出開場設定');
    await click(teacher, '#quiz-sessions form button[type=submit]'); await status(teacher, '已固定第 1 版');
    await wait(teacher, () => document.querySelector('#quiz-sessions [role=status]').textContent.includes('已開場'));
    const id = await teacher.$eval('.session-card', e => e.dataset.sessionId);
    const sessions = (await teacherCall('sessions')).sessions; const versionId = sessions.find(s => s.id === id).version_id;
    await step('開場完成，學生加入'); const s1 = await student(id, 1), s2 = await student(id, 2);
    assert.equal((await last(s1)).reviews.length, 0);
    assert.doesNotMatch(JSON.stringify((await last(s1)).document), /"answer"|"explanation"|"accepted"|"correct"/);
    await step('送達但遺失回應後重試');
    await s1.evaluate(() => {
      const real = window.fetch; window.__requests = [];
      window.fetch = async (...args) => {
        const body = args[1]?.body && JSON.parse(args[1].body);
        if (body?.action === 'submit') { window.__requests.push(body.data.request_id); const response = await real(...args);
          if (window.__requests.length === 1) throw new Error('合成回應遺失'); return response; }
        return real(...args);
      };
    });
    await s1.$eval('input[type=radio][value=a]', e => e.click()); await click(s1, '#server-submit');
    await wait(s1, () => document.querySelector('#server-quiz [role=status]').textContent.includes('網路中斷'));
    assert.equal(await s1.$eval('fieldset', e => e.disabled), true);
    await click(s1, '#server-submit'); await wait(s1, () => document.querySelector('#server-quiz [role=status]').textContent.includes('答案已保存'));
    const ids = await s1.evaluate(() => window.__requests); assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]);
    assert.equal((await last(s1)).reviews.length, 1); assert.equal(Object.keys((await last(s2)).responses).length, 0);
    await next(s1); await answer(s1, '  空氣  ');
    assert.equal((await last(s1)).reviews.length, 1); assert.doesNotMatch(await s1.$eval('#server-quiz', e => e.textContent), /題組秘密解析/);
    await step('重整接回與題組揭答');
    await s1.reload({ waitUntil: 'domcontentloaded' }); await wait(s1, () => Boolean(document.querySelector('#server-submit')));
    assert.equal(await s1.$eval('article[data-question-id]', e => e.dataset.questionId), q3.id);
    await decodeMedia(s1);
    assert.equal(await s1.$eval('audio', a => a.autoplay), false);
    await answer(s1, 'b'); assert.equal((await last(s1)).reviews.length, 3);
    await next(s1); await answer(s1, '完成'); assert.equal((await last(s1)).complete, true);
    await s1.setViewport({ width: 390, height: 844 }); assert.ok(await s1.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await safeScreenshot(s1, { path: path.join(out, 'student-complete-mobile.png') });
    await step('整份揭答');
    const whole = await teacherCall('open', { session_id: crypto.randomUUID(), version_id: versionId, school_year: 115, class_codes: ['603'], reveal: 'complete', shuffle_questions: false, shuffle_options: true });
    const wholePage = await student(whole.id, 1);
    for (const [i, value] of ['a', '空氣', 'b', '完成'].entries()) {
      await answer(wholePage, value); assert.equal((await last(wholePage)).reviews.length, i === 3 ? 4 : 0); if (i !== 3) await next(wholePage);
    }
    report.student = { isolated: true, noAnswerBeforeReveal: true, lostResponseRetrySameId: true, groupDelayedReveal: true, reloadResume: true, wholePaperReveal: true, mediaDecoded: true, mobileNoOverflow: true };
    await step('教師監看與關場');
    const roster = await teacherCall('monitor', { session_id: id }); assert.equal(roster.students.length, 2); assert.equal(Number(roster.students.find(s => Number(s.seat_no) === 1).answered), 4);
    await activateForMedia(teacher);
    await teacher.evaluate(() => { const original = window.fetch; window.__monitorCalls = 0; window.fetch = async (...args) => {
      const r = await original(...args); if (JSON.parse(args[1]?.body || '{}').action === 'monitor') window.__monitorCalls++; return r;
    }; });
    await click(teacher, `.session-card[data-session-id="${id}"] button`);
    await wait(teacher, sid => document.querySelector(`.session-card[data-session-id="${sid}"] .session-monitor`).textContent.includes('4 / 4'), id);
    await wait(teacher, () => window.__monitorCalls >= 2);
    await click(teacher, `.session-card[data-session-id="${id}"] button.danger`);
    await wait(teacher, () => document.querySelector('#quiz-sessions [role=status]').textContent.includes('場次已結束'));
    await s2.evaluate(() => [...document.querySelectorAll('#server-quiz button')].find(b => b.textContent === '更新保存狀態').click());
    await wait(s2, () => document.querySelector('#server-quiz').textContent.includes('老師已結束本場次'));
    assert.equal(await s2.$('#server-submit'), null);
    report.teacher = { openFromVersion: true, monitorSavedCount: true, autoMonitorRepeated: true, closePreventsSubmission: true };
    await step('30個同時開啟的瀏覽器頁面');
    // 結束其他學生測試分頁，保留教師與29位學生，共30個測試客戶端。
    for (const p of owned.splice(0)) await p.close();
    const small = newDocument(); small.title = '30端合成測驗'; small.blocks[0].questions[0].prompt.media = [
      { kind: 'image', url: 'https://quiz-fixture.example.invalid/parallel.png', alt: '30端合成圖' },
      { kind: 'audio', url: 'https://quiz-fixture.example.invalid/parallel.wav', alt: '30端合成音檔' },
    ];
    const bankId = crypto.randomUUID(); await teacherCall('save', { bank_id: bankId, expected_revision: 0, document: small });
    const v = await teacherCall('publish', { bank_id: bankId, expected_revision: 1 });
    const thirty = await teacherCall('open', { session_id: crypto.randomUUID(), version_id: v.id, school_year: 115, class_codes: ['603'], reveal: 'complete' });
    const started = Date.now();
    // 背景分頁由共用 CDP guard 建立並保存精確 page 物件，不掃描搶用既有頁籤。
    const pages = await Promise.all(Array.from({ length: 29 }, (_, i) => student(thirty.id, i + 1)));
    // Chrome 單一視窗一次只有一個可見分頁；逐頁保持可見直到原生媒體解碼。
    for (const p of pages) await decodeMedia(p);
    const transfers = await Promise.all(pages.map(p => p.evaluate(async () => (await (await fetch('https://quiz-media.example.invalid/parallel.wav')).arrayBuffer()).byteLength)));
    assert.ok(transfers.every(n => n === 8044));
    // 媒體替身驗證結束後解除逐請求 CDP 攔截，集中送答直接走本機 HTTP。
    // 用來排除逐請求攔截因素；背景資源排程仍需另行驗證。
    await Promise.all(pages.map(async p => { p.removeAllListeners('request'); await p.setRequestInterception(false); }));
    const joinedMs = Date.now() - started; const submitStart = Date.now();
    if (process.argv.includes('--visible-submit')) {
      const pending = [];
      for (const p of pages) {
        await activateForMedia(p); await startAnswer(p, 'a');
        pending.push(wait(p, () => document.querySelector('#server-quiz [role=status]').textContent.includes('答案已保存')));
      }
      await Promise.all(pending);
    } else await Promise.all(pages.map(p => answer(p, 'a')));
    const monitored = await teacherCall('monitor', { session_id: thirty.id });
    assert.equal(monitored.students.length, 29); assert.ok(monitored.students.every(s => Number(s.answered) === 1));
    report.thirty = { openBrowserClients: 30, students: 29, imageAndAudioDecoded: 29, mediaDecode: '依序啟用分頁直到原生解碼', simultaneousMediaFetches: 29, interceptionDisabledForSubmit: true, submitMode: process.argv.includes('--visible-submit') ? '依序啟用並發出請求，之後集中等待保存' : '29背景頁同時送答', savedAnswers: 29, joinAndMediaMs: joinedMs, concentratedSubmitMs: Date.now() - submitStart,
      backend: '本機 PGlite，非正式 Supabase', browser: '同一 Chrome 實例的29個學生分頁＋1個教師分頁' };
    const full = await teacher.evaluate(async id => {
      const r = await fetch('/__quiz-rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Quiz-Demo-Student': '30' }, body: JSON.stringify({ action: 'join', data: { session_id: id } }) });
      return { status: r.status, body: await r.json() };
    }, thirty.id);
    assert.equal(full.status, 400); assert.equal(full.body.error, 'session_full'); report.thirty.excessAdmissionRejected = true;
    await teacherCall('close', { session_id: thirty.id });
    assert.deepEqual(errors, []); report.pageErrors = errors;
    await fs.writeFile(path.join(out, 'session-browser-qa.json'), JSON.stringify(report, null, 2), 'utf8'); console.log(JSON.stringify(report));
  } catch (error) {
    const diagnostics = await Promise.allSettled(owned.map(p => p.evaluate(() => ({
      url: location.href, visibility: document.visibilityState, status: document.querySelector('#server-quiz [role=status]')?.textContent,
      selected: document.querySelector('#server-quiz input:checked')?.value, buttonDisabled: document.querySelector('#server-submit')?.disabled,
      calls: window.__quizCalls, responses: window.__quizResponses?.map(r => ({ complete: r.complete, answered: Object.keys(r.responses || {}).length })),
    }))));
    const failure = JSON.stringify({ phase, error: error.message, completedChecks: report, diagnostics }, null, 2);
    await fs.writeFile(path.join(out, `session-failure-${Date.now()}.json`), failure, 'utf8');
    await fs.writeFile(path.join(out, 'session-failure.json'), failure, 'utf8'); throw error;
  } finally { clearTimeout(watchdog); for (const p of owned) await p.close().catch(() => {}); await connection.disconnect(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
