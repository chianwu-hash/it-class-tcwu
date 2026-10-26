// 正式入口／共用 auth.js、navbar-auth.js 原樣執行；Auth SDK 及雲端傳輸由本機替身接住。
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const runtime = createRequire('D:/projects/cdp-tools/package.json');
const { connectCdp } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
const sdk = `const listeners=[];let session=JSON.parse(sessionStorage.getItem('quiz-test-session')||'null');
window.__setQuizTestSession=s=>{session=s;sessionStorage.setItem('quiz-test-session',JSON.stringify(s));listeners.forEach(f=>f(s?'SIGNED_IN':'SIGNED_OUT',s));};
export const createClient=()=>({rpc:async()=>({data:null,error:null}),auth:{
getSession:async()=>({data:{session},error:null}),refreshSession:async()=>({data:{session}}),
setSession:async()=>({data:{session}}),onAuthStateChange:f=>{listeners.push(f);return{data:{subscription:{unsubscribe(){}}}};},
signOut:async()=>{window.__setQuizTestSession(null);return{};}}});`;
(async () => {
  const origin = 'http://127.0.0.1:4340', targetUrl = `${origin}/admin-quiz.html?local=1`;
  const { browser } = await connectCdp({ cdpUrl: process.env.CDP_URL, targetUrl, puppeteer: runtime('puppeteer-core') });
  assert.ok(browser.targets().find(t => t._targetId === process.argv[2]), '指定的既有目標必須存在');
  const pages = [], errors = [], calls = [], out = path.resolve('automation/output/quiz'); await fs.mkdir(out, { recursive: true });
  let phase = '開始';
  const step = async text => { phase = text; await fs.writeFile(path.join(out, 'auth-media-phase.txt'), text); };
  const watchdog = setTimeout(() => { console.error(`本機登入媒體驗證逾時：${phase}`); browser.disconnect(); process.exitCode = 1; }, 120000);
  const uid = n => n === 0 ? '00000000-0000-4000-8000-000000000001' : `00000000-0000-4000-8001-${String(n).padStart(12,'0')}`;
  const session = n => ({ user: { id: uid(n), email: n === 0 ? 'chianwu@gmail.com' : `student${n}@example.invalid` }, access_token: n === 0 ? 'teacher' : `student-${n}` });
  let cookie;
  const local = async (route, body, student) => {
    const response = await fetch(`${origin}${route}`, { method: 'POST', headers: { Origin: origin, Cookie: cookie,
      'Content-Type': 'application/json', ...(student ? { 'X-Quiz-Demo-Student': String(student) } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, result: await response.json() };
  };
  async function makePage(initial) {
    const p = await browser.newPage(); pages.push(p); p.on('pageerror', e => errors.push(e.message));
    await fs.writeFile(path.join(out, 'auth-media-owned-targets.json'), JSON.stringify(pages.map(p => p.target()._targetId)));
    await p.evaluateOnNewDocument(s => { if (!sessionStorage.getItem('quiz-test-session')) sessionStorage.setItem('quiz-test-session', JSON.stringify(s)); }, initial);
    await p.setRequestInterception(true);
    p.on('request', async req => {
      try {
        const url = new URL(req.url());
        if (url.href.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/')) return await req.respond({ contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': origin }, body: sdk });
        if (url.hostname.endsWith('.supabase.co')) {
          if (req.method() === 'OPTIONS') return await req.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type' } });
          assert.ok(['/rest/v1/rpc/quiz_action','/functions/v1/quiz-media'].includes(url.pathname), '禁止非測驗的正式請求');
          const bearer = req.headers().authorization?.slice(7); assert.ok(bearer === 'teacher' || /^student-[12]$/.test(bearer), '只有合成權杖');
          const n = bearer === 'teacher' ? null : Number(bearer.slice(8)), body = JSON.parse(req.postData());
          calls.push({ path: url.pathname, action: body.p_action || body.action, identity: bearer });
          const result = await local(url.pathname.endsWith('quiz_action') ? '/__quiz-rpc' : '/__quiz-media',
            url.pathname.endsWith('quiz_action') ? { action: body.p_action, data: body.p_data } : body, n);
          return await req.respond({ status: result.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': origin }, body: JSON.stringify(result.result) });
        }
        if (url.origin !== origin) return await req.respond({ contentType: req.resourceType() === 'script' ? 'text/javascript' : 'text/css', body: '' });
        if (url.pathname === '/index.html') return await req.respond({ contentType: 'text/html', body: '<script type="module">import {consumePendingRedirect} from "/shared/auth.js";consumePendingRedirect();</script>' });
        await req.continue();
      } catch (e) { errors.push(e.message); await req.abort().catch(() => {}); }
    });
    return p;
  }
  const activate = async p => { const c = await p.target().createCDPSession(); c.grantForegroundOnce('Page.bringToFront', '驗證本機正式入口的媒體解碼與登入操作'); await c.send('Page.bringToFront'); await c.detach(); assert.equal(await p.evaluate(() => document.visibilityState), 'visible'); };
  const wait = (p, fn, ...args) => p.waitForFunction(fn, { timeout: 20000, polling: 'mutation' }, ...args);
  try {
    const teacher = await makePage(session(0));
    await step('教師本機起始');
    await teacher.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    cookie = (await teacher.cookies(origin)).filter(c => c.name === 'quiz_local').map(c => `${c.name}=${c.value}`).join(';'); assert.ok(cookie);
    const { newDocument, newQuestion } = await import('../../shared/quiz-document.mjs');
    const doc = newDocument(); doc.title = `登入與保存本機驗證 ${Date.now()}`;
    doc.blocks[0].questions[0].prompt.media = [{ kind: 'image', url: 'https://quiz-fixture.example.invalid/picture.png', alt: '合成圖片' }];
    doc.blocks[0].questions[0].explanation.media = [{ kind: 'audio', url: 'https://quiz-fixture.example.invalid/explanation.wav', alt: '揭答後音檔' }];
    doc.blocks.push({ id: crypto.randomUUID(), material: { text: '', media: [] }, questions: [newQuestion('short')] });
    const bank = crypto.randomUUID(); assert.equal((await local('/__quiz-rpc', { action: 'save', data: { bank_id: bank, expected_revision: 0, document: doc } })).status, 200);
    await teacher.goto(`${origin}/admin-quiz.html`, { waitUntil: 'domcontentloaded' });
    await activate(teacher); await step('正式教師入口');
    await wait(teacher, () => !document.querySelector('#workspace').hidden && !document.querySelector('#workspace').inert && document.querySelector('#status').textContent.includes('教師題庫已就緒'));
    await teacher.evaluate(title => [...document.querySelectorAll('.bank-item')].find(b => b.textContent.includes(title)).click(), doc.title);
    await step('開啟草稿');
    await wait(teacher, () => !document.querySelector('#workspace').inert && document.querySelector('#status').textContent.includes('已開啟草稿'));
    await teacher.click('#publish'); await wait(teacher, () => document.querySelector('#status').textContent.includes('已固定第 1 版'));
    await step('已固定媒體版本');
    const versions = (await local('/__quiz-rpc', { action: 'versions', data: { bank_id: bank } })).result.versions;
    const config = { session_id: crypto.randomUUID(), version_id: versions[0].id, school_year: 115, class_codes: ['603'], reveal: 'complete', shuffle_questions: false, shuffle_options: false };
    assert.equal((await local('/__quiz-rpc', { action: 'open', data: config })).status, 200);
    const student = await makePage(null), url = `${origin}/grade6/115-1/quiz.html?session=${config.session_id}`;
    await student.goto(url, { waitUntil: 'domcontentloaded' });
    await step('正式學生入口');
    await wait(student, () => document.querySelector('#login-btn') && window.__navbarAuthController && document.querySelector('#auth-status').textContent === '未登入');
    assert.equal(await student.$eval('#server-quiz', e => e.textContent), '');
    assert.equal(calls.filter(c => c.action === 'join').length, 0);
    await student.evaluate(s => sessionStorage.setItem('quiz-test-session', JSON.stringify(s)), session(1));
    await student.evaluate(() => document.querySelector('#login-btn').click());
    await step('集中登入返回');
    await wait(student, () => document.querySelector('#server-submit'));
    assert.equal(await student.evaluate(() => location.href), url);
    await activate(student);
    await step('圖片解碼');
    await wait(student, () => document.querySelector('#server-quiz img')?.src.includes('__quiz-file/'));
    await student.evaluate(async () => { const i = document.querySelector('#server-quiz img'); if (!i.complete) await new Promise((ok, bad) => { i.onload = ok; i.onerror = bad; }); if (!i.naturalWidth) throw new Error('圖片未解碼'); });
    assert.equal(await student.$eval('#server-quiz', e => Boolean(e.querySelector('audio'))), false);
    await student.click('input[type=radio]'); await student.click('#server-submit');
    await step('第一題保存');
    await wait(student, () => document.querySelector('#server-quiz').textContent.includes('答案已保存'));
    assert.equal(await student.$eval('#server-quiz', e => Boolean(e.querySelector('audio'))), false);
    await student.evaluate(() => [...document.querySelectorAll('#server-quiz button')].find(b => b.textContent === '下一題').click());
    await student.type('textarea', '請輸入可接受答案'); await student.click('#server-submit');
    await step('全卷揭答音檔解碼');
    await wait(student, () => [...document.querySelectorAll('#server-quiz button')].some(b => b.textContent === '查看整份作答與解析'));
    assert.equal(await student.$$eval('#server-quiz article.question', es => es.length), 1);
    assert.equal(await student.$eval('#server-quiz h3', e => e.textContent), '第 2 題 / 2 題');
    await student.evaluate(() => [...document.querySelectorAll('#server-quiz button')].find(b => b.textContent === '查看整份作答與解析').click());
    await wait(student, () => document.querySelector('#server-quiz audio')?.src.includes('__quiz-file/'));
    await student.evaluate(async () => { const a = document.querySelector('audio'); await new Promise((ok, bad) => { a.onloadeddata = ok; a.onerror = bad; a.load(); }); });
    assert.equal(await student.$eval('audio', a => a.autoplay), false);
    const readsBeforeRetry = calls.filter(c => c.action === 'read').length;
    await student.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('error')));
    await student.evaluate(() => [...document.querySelectorAll('figure button')].find(b => b.textContent === '重新載入媒體').click());
    await wait(student, () => !document.querySelector('figure [role=alert]'));
    assert.ok(calls.filter(c => c.action === 'read').length > readsBeforeRetry);
    await student.reload({ waitUntil: 'domcontentloaded' }); await wait(student, () => document.querySelector('#server-quiz h3')?.textContent === '第 2 題 / 2 題');
    assert.equal(await student.$$eval('#server-quiz article.question', es => es.length), 1);
    await student.evaluate(s => window.__setQuizTestSession(s), session(2));
    await wait(student, () => document.querySelector('#server-quiz').textContent.includes('已保存 0 / 2 題'));
    assert.equal(await student.$eval('#server-quiz', e => Boolean(e.querySelector('audio'))), false);
    await student.evaluate(() => document.querySelector('#logout-btn').click());
    await wait(student, () => document.querySelector('#auth-status')?.textContent === '未登入' && document.querySelector('#server-quiz')?.textContent === '');
    const report = { formalEntryWithMockAuth: true, sharedAuthAndNavbarUnmodified: true, centralLoginReturnsToSession: true,
      teacherPublishThroughEdgeAdapter: true, privateSavedImageDecoded: true, explanationAudioOnlyAfterReveal: true,
      mediaReloadReauthorizes: true, reloadResumes: true, switchStudentIsolated: true, logoutClears: true, realOAuth: false, productionRequests: 0, errors, calls };
    assert.deepEqual(errors, []); await fs.writeFile(path.join(out, 'auth-media-browser-qa.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } catch (e) { await fs.writeFile(path.join(out, 'auth-media-browser-failure.json'), JSON.stringify({ error: e.stack, errors, calls, pages: await Promise.all(pages.map(async p => ({ url: p.url(), text: await p.evaluate(() => document.body.innerText).catch(() => '') }))) }, null, 2)); throw e; }
  finally { clearTimeout(watchdog); for (const p of pages) await p.close().catch(() => {}); browser.disconnect(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
