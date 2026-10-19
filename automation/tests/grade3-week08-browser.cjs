// Run only through D:/ai-browser/run-background.cjs with an acquired lease.
// Synthetic auth only: /shared/auth.js is replaced by a fixture; no real account or progress is touched.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { connectCdp, safeScreenshot } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
const sharedRequire = require('node:module').createRequire('D:/projects/cdp-tools/packages/cdp-safe-client/index.js');
const puppeteer = sharedRequire('puppeteer-core');
const base = process.env.WEEK08_BASE || 'http://127.0.0.1:8765';
const cdpUrl = process.env.WEEK08_CDP;
if (!cdpUrl) throw Error('Explicit acquired browser CDP URL required');
const out = process.env.WEEK08_OUT || 'tmp/grade3-week08-qa';
const fixture = `
export const SUPABASE_URL='${base}/fake',SUPABASE_ANON_KEY='synthetic';
window.fixtureListeners=[];window.fixtureCalls=[];window.fixtureLoginCalls=[];window.fixtureLogoutCount=0;window.fixtureFilters=[];
export const resolveSession=async()=>window.fixtureUser,getSession=async()=>({session:window.fixtureUser});
export const isTeacher=()=>Boolean(window.fixtureTeacher);
export const getStoredAccessToken=()=> 'synthetic';
export function beginCentralizedLogin(options){window.fixtureLoginCalls.push(options);}
export const signOutAndReload=async()=>{window.fixtureLogoutCount++;};
export const supabase={auth:{onAuthStateChange(fn){window.fixtureListeners.push(fn);return {};},getSession},
rpc(name,args){window.fixtureCalls.push(name);if(name==='get_grade3_progress')return {abortSignal:async()=>({data:window.fixtureProgress?[window.fixtureProgress]:[]})};if(name==='save_grade3_progress')return {abortSignal:async()=>{window.fixtureSaves.push(args);if(window.fixtureSaveFail)return {error:{code:'P0001',message:'合成儲存失敗'}};window.fixtureProgress={current_level:Math.min(args.p_score+1,5),completed:args.p_score===5,score:args.p_score};return {data:null};}};return {abortSignal:async()=>window.fixtureImportFail?{error:{code:'P0001',message:'合成身分接回失敗'}}:{data:[{class_code:'301',seat_no:1,display_name:'合成測試',student_code:'30101',practice_account:'synthetic'}]}};},
from(name){const query={select(){return query;},eq(key,value){window.fixtureFilters.push([key,value]);return query;},then(resolve){return Promise.resolve({data:window.fixtureVisibility||[]}).then(resolve);}};return query;}};
`;
const synthetic = { user: { id: 'synthetic-a', email: 'synthetic@apps.ntpc.edu.tw' }, access_token: 'synthetic' };
const week = '/grade3/115-1/week08.html';
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const connection = await connectCdp({ cdpUrl, targetUrl: base + week,
        puppeteer: { connect: options => puppeteer.connect({ ...options, protocolTimeout: 30000 }) } });
    const page = connection.page; // the lease-owned tab opened by ai-browser-launch
    const waitForFunction = page.waitForFunction.bind(page);
    page.waitForFunction = (fn, options = {}, ...args) => waitForFunction(fn, { polling: 500, timeout: 15000, ...options }, ...args);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setCacheEnabled(false);
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    const intercept = r => (new URL(r.url()).pathname === '/shared/auth.js'
        ? r.respond({ contentType: 'application/javascript', body: fixture })
        : /supabase\.co/.test(r.url()) ? r.abort() : r.continue()).catch(e => console.log('interception ended:', e.message));
    page.on('request', intercept);
    let bootstrap;
    async function scenario(options = {}, path = week) {
        console.log('scenario', path, options.fail ? 'failure' : options.user ? 'signed-in' : 'anonymous');
        if (bootstrap) await page.removeScriptToEvaluateOnNewDocument(bootstrap.identifier);
        bootstrap = await page.evaluateOnNewDocument(config => {
            window.fixtureUser = config.user ?? null;
            window.fixtureImportFail = Boolean(config.fail);
            window.fixtureTeacher = Boolean(config.teacher); window.fixtureSaves = []; window.fixtureProgress = config.progress || null;
            window.fixtureVisibility = config.visibility || [];
        }, options);
        await page.goto(base + path, { waitUntil: 'networkidle2' });
        await page.waitForFunction(() => Boolean(window.__navbarAuthController));
        // Background tabs may defer font loading; do not block forever on fonts.ready.
        await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]).then(() => true));
    }
    async function layout(width, shot) {
        await page.setViewport({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
        assert.equal(await page.evaluate(() => document.fonts.check('900 24px "Noto Sans TC"')), true);
        assert.match(await page.$eval('.hero-icon', e => getComputedStyle(e, '::before').content), /[^"\s]/);
        assert.ok((await page.$$eval('a.action, .warmup-buttons button', n => n.map(e => e.getBoundingClientRect().height))).every(h => h >= 44));
        if (shot && !process.env.WEEK08_SKIP_SHOTS) await safeScreenshot(page, { path: `${out}/${shot}.png` });
    }
    const step = name => console.log('step', name);
    const setValue = (sel, text) => page.$eval(sel, (e, t) => { e.value = t; e.dispatchEvent(new Event('input', { bubbles: true })); }, text);
    try {
        // Anonymous: warm-up usable without login and stores nothing; challenge locked.
        await scenario();
        step('loaded');
        assert.equal(await page.$eval('#login-btn', e => e.classList.contains('hidden')), false);
        assert.equal(await page.$eval('#typing-levels-container', e => e.inert), true);
        assert.equal(await page.$eval('#warmup-input', e => e.disabled || Boolean(e.closest('[inert]'))), false);
        const pts = await page.$eval('#parent-platform-link', e => ({ href: e.href, target: e.target, rel: e.rel }));
        assert.equal(pts.href, 'https://pts.ntpc.edu.tw/'); assert.equal(pts.target, '_blank'); assert.match(pts.rel, /noopener/);
        for (const answer of ['小', '星', '小星星']) { await setValue('#warmup-input', answer); await page.$eval('#warmup-check', e => e.click()); }
        assert.equal(await page.$eval('#warmup-next-set', e => e.disabled), true);
        await setValue('#warmup-input', '心'); await page.$eval('#warmup-check', e => e.click());
        assert.equal(await page.$eval('#warmup-next-set', e => e.disabled), false);
        assert.deepEqual(await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter(k => !/^sb-|supabase/.test(k))), []);
        assert.equal(await page.evaluate(() => (window.fixtureSaves || []).length), 0);
        await layout(1280, 'week08-1280');
        await page.$eval('#warmup', e => e.scrollIntoView());
        await layout(1280, 'week08-warmup-1280');
        await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
        await layout(390, 'week08-390');
        await page.$eval('#login', e => e.scrollIntoView());
        await layout(390, 'week08-login-390');
        await page.$eval('#login-btn', e => e.click());
        assert.equal(await page.evaluate(() => fixtureLoginCalls[0].returnTo), base + week);

        step('anonymous done');
        // Signed in: precise hints, save failure keeps lock, RPC args, resume, completion, replay.
        await scenario({ user: synthetic });
        await page.waitForFunction(() => document.querySelector('#auth-status').textContent.includes('30101'));
        await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('已接回本人身分'));
        assert.equal(await page.$eval('#typing-levels-container', e => e.inert), false);
        assert.equal(await page.$eval('#input-level1', e => e.dispatchEvent(new Event('paste', { cancelable: true }))), false);
        // Zhuyin key guide follows the focused level: 心情 = ㄒㄧㄣ(space) ㄑㄧㄥˊ.
        // Background tabs do not emit focus events for element.focus(); dispatch it explicitly.
        await page.$eval('#input-level1', e => e.dispatchEvent(new FocusEvent('focus')));
        await page.$eval("[data-typing-tool-toggle='keyboard']", e => e.click());
        assert.deepEqual(await page.$$eval('[data-zhuyin-keyboard-guide] .is-target', n => n.map(k => k.dataset.key).sort()),
            ['/', '6', 'f', 'p', 'space', 'u', 'v'].sort());
        await page.$eval("[data-typing-tool-close='keyboard']", e => e.click());
        await setValue('#input-level1', 'xin'); await page.evaluate(() => checkLevel(1));
        assert.match(await page.$eval('#msg-level1', e => e.textContent), /英文字母/);
        await setValue('#input-level1', '心'); await page.evaluate(() => checkLevel(1));
        assert.match(await page.$eval('#msg-level1', e => e.textContent), /還少 1 個字/);
        await setValue('#input-level1', '新情'); await page.evaluate(() => checkLevel(1));
        assert.match(await page.$eval('#msg-level1', e => e.textContent), /第 1 個字/);
        await setValue('#input-level1', '心情');
        await page.evaluate(() => { window.fixtureSaveFail = true; return checkLevel(1); });
        assert.equal(await page.$eval('#block-level2', e => e.classList.contains('hidden')), true);
        await page.evaluate(() => { window.fixtureSaveFail = false; return checkLevel(1); });
        assert.deepEqual(await page.evaluate(() => fixtureSaves.at(-1)), { p_week_code: '08', p_activity_key: 'typing_task_5', p_score: 1 });
        const saved = await page.evaluate(() => fixtureProgress);
        await scenario({ user: synthetic, progress: saved });
        await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('第 2 關'));
        const answers = ['心的小船', '心是一葉舟', '小船上要什麼呢？', '一起去看美麗新世界！'];
        for (let i = 2; i <= 5; i++) { await setValue('#input-level' + i, answers[i - 2]); await page.evaluate(n => checkLevel(n), i); }
        assert.equal(await page.evaluate(() => fixtureProgress.completed), true);
        assert.equal(await page.evaluate(() => fixtureSaves.at(-1).p_score), 5);
        const completed = await page.evaluate(() => fixtureProgress);
        await scenario({ user: synthetic, progress: completed });
        await page.waitForFunction(() => document.querySelector('#input-level5').readOnly);
        await page.$eval('[data-replay="5"]', e => e.click());
        assert.equal(await page.$eval('#input-level5', e => e.readOnly), false);
        assert.equal(await page.evaluate(() => fixtureSaves.length), 0);
        await layout(1280); await layout(390);

        step('signed-in done');
        await scenario({ user: synthetic, fail: true });
        await page.waitForFunction(() => document.querySelector('#auth-status').textContent.includes('尚未接回'));
        assert.equal(await page.$eval('#typing-levels-container', e => e.inert), true);
        assert.equal(await page.$eval('#warmup-input', e => e.disabled), false);

        // Home card + week visibility sync.
        const home = '/grade3/115-1/index.html';
        await scenario({}, home);
        assert.equal(await page.$eval('[data-week="08"]', e => e.dataset.latestWeek), 'true');
        assert.equal(await page.$eval('[data-week="07"]', e => e.dataset.latestWeek), undefined);
        await scenario({ visibility: [{ course_id: 'grade3-115-1', week_code: '08', is_visible: false }] }, home);
        await page.waitForFunction(() => document.querySelector('[data-week="08"]').classList.contains('hidden'));
        assert.equal(await page.$('body > nav a[href="week08.html"]'), null);
        assert.equal(await page.$eval('[data-week="07"]', e => e.classList.contains('hidden')), false);
        await scenario({}, home);
        assert.ok(await page.$('body > nav a[href="week08.html"]'));
        assert.deepEqual(errors, []);
        const summary = { status: 'passed', realStudentWrites: 0, widths: [1280, 390], checks: ['anonymous warm-up without storage', 'challenge lock', 'official link', 'login returnTo', 'precise Chinese hints', 'save failure keeps lock', 'RPC week 08 args', 'resume, completion, replay', 'identity failure keeps warm-up', 'home/navbar visibility'] };
        fs.writeFileSync(`${out}/checks.json`, JSON.stringify(summary, null, 2));
        console.log(JSON.stringify(summary));
    } finally { page.off('request', intercept); await page.setRequestInterception(false).catch(() => {}); await page.close(); await connection.disconnect(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
