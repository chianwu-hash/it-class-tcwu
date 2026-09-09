const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { connectCdp, safeScreenshot } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
const root = path.resolve(__dirname, '../..');
let actor = null;
let calls = [];
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/shared/auth.js') {
    console.log('Serving mocked auth for', actor?.user?.id || 'anonymous');
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(`window.__testAuthSawSearch=location.search;
      export const SUPABASE_URL='http://localhost:3000'; export const SUPABASE_ANON_KEY='test';
      export const getStoredAccessToken=()=> 'test-user';
      export const isTeacher=s=>s?.user?.email==='chianwu@gmail.com';
      export const resolveSession=async()=>(${JSON.stringify(actor)});
      export const beginCentralizedLogin=()=>{}; export const signOutAndReload=()=>{};
      export const supabase={auth:{onAuthStateChange:()=>{}}};`);
  }
  if (pathname === '/functions/v1/drive-connect') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); calls.push(body.action);
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(body.action === 'status' ? { connected: false } : { connected: true }));
  }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(3000, '127.0.0.1', resolve); });
  let c, page;
  let stage = 'connect';
  try {
    c = await connectCdp({ cdpUrl: 'http://127.0.0.1:9232', targetUrl: 'https://console.cloud.google.com/' });
    page = await c.browser.newPage();
    // This test deliberately changes module responses between reloads.
    await page.setCacheEnabled(false);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(10000);
    stage = 'unauthenticated';
    await page.goto('http://localhost:3000/admin-drive.html');
    await page.waitForFunction(() => document.getElementById('auth-status').textContent === '未登入');
    assert.equal(await page.$eval('#connect-drive', e => e.disabled), true);
    assert.deepEqual(calls, []);
    stage = 'student';
    actor = { user: { id: 'student', email: 'student@school.test' } };
    await page.reload();
    await page.waitForFunction(() => document.getElementById('drive-status').textContent.includes('只有網站教師'));
    assert.deepEqual(calls, []);
    stage = 'teacher';
    actor = { user: { id: 'teacher-one', email: 'chianwu@gmail.com' } };
    await page.reload();
    await page.waitForFunction(() => document.getElementById('drive-status').textContent.includes('尚未連接'));
    assert.equal(await page.$eval('#connect-drive', e => e.disabled), false);
    assert.deepEqual(calls, ['status']);
    const state = 'S'.repeat(43), proof = 'P'.repeat(43);
    stage = 'callback';
    await page.evaluate((pending) => sessionStorage.setItem('drive-oauth-pending-v1', JSON.stringify(pending)), {
      userId: 'teacher-one', state, proof, expiresAt: Date.now() + 600000,
    });
    await page.goto(`http://localhost:3000/admin-drive.html?state=${state}&code=fake-test-code`);
    await page.waitForFunction(() => document.getElementById('drive-status').textContent.includes('連接成功'));
    assert.equal(await page.evaluate(() => window.__testAuthSawSearch), '');
    assert.equal(await page.evaluate(() => location.search), '');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('drive-oauth-pending-v1')), null);
    assert.deepEqual(calls, ['status', 'complete']);
    stage = 'replay';
    await page.goto(`http://localhost:3000/admin-drive.html?state=${state}&code=replayed-code`);
    await page.waitForFunction(() => document.getElementById('drive-status').textContent.includes('授權已過期'));
    assert.deepEqual(calls, ['status', 'complete']);
    stage = 'mobile';
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost:3000/admin-drive.html');
    await page.waitForFunction(() => document.getElementById('drive-status').textContent.includes('尚未連接'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await fs.mkdir(path.join(root, 'tmp'), { recursive: true });
    await safeScreenshot(page, { path: path.join(root, 'tmp/drive-connect-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: unauthenticated/student blocked; teacher status; callback scrub/binding; replay blocked; mobile layout; no page errors. Browser uses mocked Auth/API only.');
  } catch (e) {
    const visible = page && await page.evaluate(() => ({ status: document.getElementById('drive-status')?.textContent, auth: document.getElementById('auth-status')?.textContent })).catch(() => ({}));
    throw new Error(`${stage}: ${e.message}; ${JSON.stringify(visible)}`);
  } finally { if (page) await page.close(); if (c) await c.disconnect(); server.closeAllConnections(); server.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; server.close(); });
