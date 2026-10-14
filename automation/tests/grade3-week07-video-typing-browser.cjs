// Run only through D:/ai-browser/run-background.cjs with an acquired lease.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { connectCdp, safeScreenshot } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
const sharedRequire = require('node:module').createRequire('D:/projects/cdp-tools/packages/cdp-safe-client/index.js');
const puppeteer = sharedRequire('puppeteer-core');
const base = 'http://127.0.0.1:3037';
const cdpUrl = process.env.WEEK07_CDP;
const targetId = process.env.WEEK07_TARGET;
if (!cdpUrl) throw Error('Explicit acquired browser and owned target required');
const out = '.chat-mode/exchange/20261013-grade3-week07-plan/qa';
const fixture = `
export const SUPABASE_URL='http://127.0.0.1:3037/fake',SUPABASE_ANON_KEY='synthetic';
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
const delay = ms => new Promise(r => setTimeout(r, ms));
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const connection = await connectCdp({ cdpUrl, targetUrl: base + '/grade3/115-1/week07.html',
        puppeteer: { connect: options => puppeteer.connect({ ...options, protocolTimeout: 30000 }) } });
    const page = await connection.browser.newPage();
    if (!page) throw Error('Owned page not found');
    const waitForFunction = page.waitForFunction.bind(page);
    page.waitForFunction = (fn, options = {}, ...args) => waitForFunction(fn, { polling: 1000, ...options }, ...args);
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
    async function scenario(options = {}, path = '/grade3/115-1/week07.html') {
        console.log('scenario', path, options.fail ? 'failure' : options.user ? 'signed-in' : 'anonymous');
        if (bootstrap) await page.removeScriptToEvaluateOnNewDocument(bootstrap.identifier);
        bootstrap = await page.evaluateOnNewDocument(config => {
            window.fixtureUser = config.user ?? null;
            window.fixtureImportFail = Boolean(config.fail);
            window.fixtureTeacher = Boolean(config.teacher);window.fixtureSaves=[];window.fixtureProgress=config.progress||null;
            window.fixtureVisibility = config.visibility || [];
        }, options);
        await page.goto(base + path, { waitUntil: 'networkidle2' });
        await page.waitForFunction(() => Boolean(window.__navbarAuthController));
        await page.waitForFunction(() => Array.isArray(window.fixtureLoginCalls));
        await page.evaluate(() => document.fonts.ready);
    }
    async function layout(width, screenshot) {
        console.log('layout', width, screenshot || 'check');
        await page.setViewport({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
        assert.equal(await page.evaluate(() => document.fonts.check('900 24px "Noto Sans TC"')), true);
        assert.match(await page.$eval('.hero-icon', e => getComputedStyle(e, '::before').content), /[^"\s]/);
        const targets = await page.$$eval('a.action', nodes => nodes.map(e => e.getBoundingClientRect().height));
        assert.ok(targets.every(h => h >= 44));
        if (screenshot && !process.env.WEEK07_SKIP_SHOTS) { await safeScreenshot(page, { path: `${out}/${screenshot}.png` }); await delay(10000); }
    }
    try {
        await scenario();
        assert.equal(await page.$eval('#login-btn', e => e.classList.contains('hidden')), false);
        for (const [id, url] of [['school-system-link', 'https://esa.ntpc.edu.tw/'], ['verify-platform-link', 'https://pts.ntpc.edu.tw/'], ['parent-platform-link', 'https://pts.ntpc.edu.tw/']]) {
            const v = await page.$eval('#' + id, e => ({ href: e.href, target: e.target, rel: e.rel, inert: Boolean(e.closest('[inert]')), visible: e.getBoundingClientRect().height > 0 }));
            assert.equal(v.href, url); assert.equal(v.target, '_blank'); assert.match(v.rel, /noopener/); assert.match(v.rel, /noreferrer/); assert.equal(v.inert, false); assert.equal(v.visible, true);
        }
        assert.equal(await page.$$eval('#typing-levels-container input,#typing-levels-container textarea', n=>n.length),5);assert.equal(await page.$eval('#typing-levels-container',e=>e.inert),true);assert.equal(await page.$eval('video',e=>e.preload),'none');
        assert.equal(await page.$eval('#verify', e => Boolean(e.querySelector('a[href="https://esa.ntpc.edu.tw/"]'))), false);
        await layout(1280, 'week07-1280');
        await page.$eval('#password', e => e.scrollIntoView());
        await layout(1280, 'week07-password-1280');
        await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo({ top: 0, behavior: 'instant' }); });
        await layout(390, 'week07-390');
        await page.$eval('#google', e => e.scrollIntoView());
        await layout(390, 'week07-platform-390');
        await page.$eval('#login-btn', e => e.click());
        console.log('login calls', JSON.stringify(await page.evaluate(() => fixtureLoginCalls)));
        assert.equal(await page.evaluate(() => fixtureLoginCalls.length), 1);
        assert.equal(await page.evaluate(() => fixtureLoginCalls[0].returnTo), base + '/grade3/115-1/week07.html');
        await page.evaluate(() => { const nav = document.querySelector('body > nav'); nav.outerHTML = nav.outerHTML; window.dispatchEvent(new CustomEvent('course-navbar:rendered')); });
        await page.$eval('#login-btn', e => e.click());
        assert.equal(await page.evaluate(() => fixtureLoginCalls.length), 2);
        await scenario({ user: synthetic });
        await page.waitForFunction(() => document.querySelector('#auth-status').textContent.includes('30101'));
        await page.evaluate(() => { window.dispatchEvent(new CustomEvent('course-navbar:rendered')); });
        await page.waitForFunction(() => document.querySelector('#auth-status').textContent.includes('30101'));
        assert.equal(await page.$eval('#reset-progress-btn', e => e.classList.contains('hidden')), true);
        await page.$eval('#logout-btn', e => e.click());
        assert.equal(await page.evaluate(() => fixtureLogoutCount), 1);
        const before = await page.evaluate(() => fixtureCalls.length);
        await page.evaluate(() => { window.fixtureNonce = 'retained'; fixtureListeners.forEach(fn => fn('TOKEN_REFRESHED', fixtureUser)); });
        await delay(200);
        assert.equal(await page.evaluate(() => fixtureNonce), 'retained');
        assert.equal(await page.evaluate(() => fixtureCalls.length), before);
        assert.ok(await page.evaluate(() => fixtureCalls.includes('get_grade3_progress')));
        await layout(1280);
        await layout(390);
        await scenario({ user: synthetic });
        await page.waitForFunction(()=>typeof window.checkLevel==='function');
        await page.waitForFunction(()=>document.querySelector('#progress-status').textContent.includes('已接回本人身分'));
        assert.equal(await page.$eval('#typing-levels-container',e=>e.inert),false);
        assert.equal(await page.$eval('.target',e=>getComputedStyle(e).userSelect),'none');
        assert.equal(await page.$eval('#input-level1',e=>e.dispatchEvent(new Event('paste',{cancelable:true}))),false);
        // Minimized browser cannot deliver physical keyboard events reliably.
        // Exercise the DOM/input and real shared-module integration, not keyboard delivery.
        await page.$eval('#input-level1',e=>{e.value='tre';e.dispatchEvent(new Event('input',{bubbles:true}));}); await page.evaluate(()=>checkLevel(1));
        assert.match(await page.$eval('#msg-level1',e=>e.textContent),/第 4 個字/);
        await page.$eval('#input-level1',e=>{e.value+='e';e.dispatchEvent(new Event('input',{bubbles:true}));});

        await page.evaluate(()=>{window.fixtureSaveFail=true;return checkLevel(1)});
        assert.equal(await page.$eval('#block-level2',e=>e.classList.contains('hidden')),true);
        await page.evaluate(()=>{window.fixtureSaveFail=false;return checkLevel(1)});
        const first=await page.evaluate(()=>fixtureSaves.at(-1));assert.deepEqual(first,{p_week_code:'07',p_activity_key:'typing_task_5',p_score:1});
        const saved=await page.evaluate(()=>fixtureProgress);await scenario({user:synthetic,progress:saved});
        await page.waitForFunction(()=>document.querySelector('#progress-status').textContent.includes('第 2 關'));
        const answers=['tree246','Tree246!','Hi, I am Tom.',"Hi, I am Tom.\nWhat's your name?"];
        for(let i=2;i<=5;i++){
            // A long wrong-answer message must push the key hint down, not overlap it.
            if(i===3){await page.$eval('#input-level3',e=>{e.value='tree';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.evaluate(()=>checkLevel(3));
                assert.equal(await page.evaluate(()=>{const msg=document.querySelector('#msg-level3'),hint=document.querySelector('#block-level3 .key-help');return msg.textContent.length>20&&msg.scrollHeight<=msg.clientHeight+1&&msg.getBoundingClientRect().bottom<=hint.getBoundingClientRect().top+1;}),true);}
            await page.$eval('#input-level'+i,(e,text)=>{e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));},answers[i-2]);await page.evaluate(n=>checkLevel(n),i);}
        assert.equal(await page.evaluate(()=>fixtureProgress.completed),true);assert.equal(await page.evaluate(()=>fixtureSaves.at(-1).p_score),5);
        const completed=await page.evaluate(()=>fixtureProgress);await scenario({user:synthetic,progress:completed});
        await page.waitForFunction(()=>document.querySelector('#input-level5').readOnly);
        // Key hints for levels 3-5 sit below the answer area once unlocked.
        for (const width of [1280, 390]) { await page.setViewport({ width, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `key hint overflow at ${width}`);
            assert.deepEqual(await page.$$eval('.level', nodes => nodes.map(e => { const hint = e.querySelector('.key-help'); if (!hint) return 0; const box = hint.getBoundingClientRect(); return box.height > 0 && box.right <= innerWidth && Boolean(hint.previousElementSibling?.matches('[id^="msg-level"]') && hint.previousElementSibling.scrollHeight <= hint.previousElementSibling.clientHeight + 1 && !hint.nextElementSibling) ? 1 : -1; })), [0, 0, 1, 1, 1]); }
        await page.$eval('[data-replay="5"]',e=>e.click());assert.equal(await page.$eval('#input-level5',e=>e.readOnly),false);
        assert.equal(await page.evaluate(()=>fixtureSaves.length),0);
        await page.evaluate(()=>{videoTest={};const v=document.querySelector('video');v.play=async()=>{};v.load=()=>{Object.defineProperty(v,'readyState',{value:1,configurable:true});v.dispatchEvent(new Event('loadedmetadata'));};document.querySelector('[data-video-time="169.266667"]').click();});
        assert.ok(Math.abs(await page.$eval('video',e=>e.currentTime)-169.266667)<.1);
        await scenario({ user: synthetic, fail: true });
        await page.waitForFunction(() => document.querySelector('#auth-status').textContent.includes('尚未接回'));
        assert.match(await page.$eval('#course-identity-status', e => e.textContent), /合成身分接回失敗/);
        assert.equal(await page.$eval('#school-system-link', e => e.getBoundingClientRect().height > 0), true);
        await scenario({ user: synthetic, teacher: true });
        assert.equal(await page.$eval('#admin-btn', e => e.classList.contains('hidden')), false);
        const home = '/grade3/115-1/index.html';
        await scenario({}, home);
        assert.equal(await page.$eval('[data-week="07"]', e => e.classList.contains('hidden')), false);
        assert.equal(await page.$eval('[data-week="07"]', e => e.dataset.latestWeek), 'true');
        for (const width of [1280, 390]) { await page.setViewport({ width, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
        await scenario({ visibility: [{ course_id: 'grade3-115-1', week_code: '07', is_visible: false }] }, home);
        await page.waitForFunction(() => document.querySelector('[data-week="07"]').classList.contains('hidden'));
        assert.equal(await page.$('body > nav a[href="week07.html"]'), null);
        assert.equal(await page.$eval('[data-week="06"]', e => e.classList.contains('hidden')), false);
        assert.ok(await page.evaluate(() => fixtureFilters.some(([key, value]) => key === 'course_id' && value === 'grade3-115-1')));
        await scenario({}, home);
        assert.equal(await page.$eval('[data-week="07"]', e => e.classList.contains('hidden')), false);
        assert.ok(await page.$('body > nav a[href="week07.html"]'));
        await scenario({ visibility: [{ course_id: 'grade3-115-1', week_code: '07', is_visible: false }] }, '/grade3/115-1/week06.html');
        // No new work is performed in Week06: inspect the navbar only.
        assert.equal(await page.$('body > nav a[href="week07.html"]'), null);
        assert.deepEqual(errors, []);
        const summary = { status: 'passed', realStudentWrites: 0, widths: [1280, 390], checks: ['public official entrances', 'public video and chapter seek', 'typing locks, precise error, RPC save failure/retry, resume, completion and replay', 'navbar login returnTo and rerender', 'trusted identity and failure', 'logout once and token refresh', 'teacher admin', 'week07 home/navbar visibility', 'fonts/icons/layout'] };
        fs.writeFileSync(`${out}/checks.json`, JSON.stringify(summary, null, 2));
        console.log(JSON.stringify(summary));
        await scenario();
    } finally { page.off('request', intercept); await page.setRequestInterception(false).catch(() => {}); await page.close(); await connection.disconnect(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
