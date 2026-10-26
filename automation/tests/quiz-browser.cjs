// 透過 D:/ai-browser/run-background.cjs --lease-id <id> 執行；不自行啟動 Chrome。
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const requireRuntime = createRequire('D:/projects/cdp-tools/package.json');
const { connectCdp, safeScreenshot } = require('D:/projects/cdp-tools/packages/cdp-safe-client');

(async () => {
  const targetUrl = process.env.QUIZ_BROWSER_URL || 'http://127.0.0.1:4340/admin-quiz.html?local=1';
  const { browser, page, session, disconnect } = await connectCdp({ cdpUrl: process.env.CDP_URL, targetUrl, puppeteer: requireRuntime('puppeteer-core') });
  const output = path.resolve('automation/output/quiz'); await fs.mkdir(output, { recursive: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => d.accept());
  const report = {};
  let phase = '連線';
  const step = async value => { phase = value; await fs.writeFile(path.join(output, 'phase.txt'), value, 'utf8'); };
  const timeout = setTimeout(() => { console.error(`瀏覽器驗證逾時：${phase}`); browser.disconnect(); process.exitCode = 1; }, 90000);
  const waitStatus = text => page.waitForFunction(t => document.querySelector('#status').textContent.includes(t), { timeout: 20000, polling: 5000 }, text);
  const fill = async (selector, text) => page.$eval(selector, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  try {
    assert.equal((await session.send('Target.getTargetInfo')).targetInfo.targetId, process.argv[2], '必須綁定已取得的精確分頁');
    await step('開啟頁面');
    assert.equal(page.url(), targetUrl); await page.setViewport({ width: 1280, height: 1000 });
    await page.goto(targetUrl, { waitUntil: 'networkidle0' }); await waitStatus('可建立測驗');
    assert.equal(await page.$eval('#identity', e => e.textContent), '本機合成教師');
    // HTTP 本機服務拒絕沒有同源瀏覽器 session 的寫入。
    const denied = await fetch('http://127.0.0.1:4340/__quiz-rpc', { method: 'POST', body: '{}' }); assert.equal(denied.status, 403);
    const { content, newDocument, newQuestion } = await import(pathToFileURL(path.resolve('shared/quiz-document.mjs')));
    const doc = newDocument(); doc.title = `分數與聲音 · 瀏覽器驗證 ${Date.now()}`;
    doc.catalog.subject = '數學'; doc.catalog.unit = '分數';
    doc.blocks[0].questions[0].prompt.text = '計算 $\\frac{1}{2}+\\frac{1}{4}$';
    doc.blocks[0].questions[0].options[0].content.text = '$\\frac{3}{4}$';
    doc.blocks[0].questions[0].explanation.text = '先通分，再將分子相加。';
    const short = newQuestion('short'); short.prompt.text = '寫出聲音傳播需要的介質。'; short.answer.accepted = ['空氣', '水'];
    const second = newQuestion(); second.prompt.text = '公式 $v=\\frac{s}{t}$ 中，v 代表什麼？';
    doc.blocks.push({ id: crypto.randomUUID(), material: content('閱讀材料後完成兩個子題。'), questions: [short, second] });
    const file = path.join(output, 'synthetic-bank.json'); await fs.writeFile(file, JSON.stringify(doc), 'utf8');
    await step('匯入合成題庫');
    await (await page.$('#import-json')).uploadFile(file); await waitStatus('已匯入為新草稿');
    await step('儲存草稿');
    await page.click('#save'); await waitStatus('草稿已儲存');
    const originalTitle = doc.title;
    await step('固定版本'); await page.click('#publish'); await waitStatus('已固定第 1 版');
    await step('教師預覽');
    await page.click('#preview'); await page.waitForSelector('#preview-dialog[open]');
    assert.equal(await page.$$eval('#preview-body .katex .mfrac', e => e.length > 0), true);
    assert.equal(await page.$$eval('#preview-body .answer-preview', e => e.length), 3);
    await safeScreenshot(page, { path: path.join(output, 'desktop-preview.png'), fullPage: false });
    await page.click('#close-preview');
    await step('儲存失敗與重試');
    await fill('#editor-fields > label input', originalTitle + '（修訂）');
    await page.evaluate(() => {
      const actual = window.fetch; window.fetch = (...args) => {
        if (String(args[0]).includes('__quiz-rpc') && JSON.parse(args[1]?.body || '{}').action === 'save') { window.fetch = actual; return Promise.reject(new Error('模擬網路中斷')); }
        return actual(...args);
      };
    });
    await page.click('#save'); await waitStatus('模擬網路中斷');
    assert.equal(await page.$eval('#editor-fields > label input', e => e.value), originalTitle + '（修訂）');
    const malformedFile = path.join(output, 'malformed-bank.json');
    await fs.writeFile(malformedFile, JSON.stringify({ ...doc, catalog: null }), 'utf8');
    await (await page.$('#import-json')).uploadFile(malformedFile); await waitStatus('題庫格式錯誤');
    assert.equal(await page.$eval('#editor-fields > label input', e => e.value), originalTitle + '（修訂）');
    await page.click('#save'); await waitStatus('草稿已儲存');
    assert.match(await page.$eval('#revision', e => e.textContent), /第 2 版/);
    await step('重整與搜尋'); await page.reload({ waitUntil: 'networkidle0' }); await waitStatus('可建立測驗');
    await fill('#search', '瀏覽器驗證'); await page.click('#search-form button');
    await page.waitForFunction(() => !document.querySelector('#workspace').inert, { polling: 5000 });
    const bankButtons = await page.$$('.bank-item');
    const bankButton = (await Promise.all(bankButtons.map(async b => [b, await b.evaluate(e => e.textContent)]))).find(([, t]) => t.includes(originalTitle));
    assert.ok(bankButton); await bankButton[0].click(); await waitStatus('已開啟草稿');
    assert.equal(await page.$eval('#editor-fields > label input', e => e.value), originalTitle + '（修訂）');
    await page.$eval('#history', e => { e.open = true; }); await page.click('#versions button');
    assert.equal(await page.$eval('#preview-title', e => e.textContent), originalTitle + ' · 固定第 1 版');
    await page.click('#close-preview');
    await step('手機版面'); await page.setViewport({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await safeScreenshot(page, { path: path.join(output, 'mobile-editor.png'), fullPage: false });
    report.authoring = { create: true, import: true, malformedImportPreservesInput: true, save: true, previewFraction: true, singleAndShort: true, groups: true, immutableVersion: true, reload: true, networkFailurePreservesInput: true, mobileNoOverflow: true };
    // 匯入專案現存題庫，確認四選一、圖網址與依據能走同一流程。
    await step('Markdown 匯入'); await (await page.$('#import-md')).uploadFile(path.resolve('automation/question-banks/grade6-math-graduation-u6.md'));
    await waitStatus('已匯入為新草稿'); assert.equal(await page.$$('#editor-fields .block').then(x => x.length), 15);
    report.markdown = { questions: 15, imageReferences: await page.$$eval('#editor-fields .media-row', e => e.length) };
    assert.equal(report.markdown.imageReferences, 8);
    await page.click('#save'); await waitStatus('草稿已儲存');
    await page.reload({ waitUntil: 'networkidle0' }); await waitStatus('可建立測驗');
    assert.deepEqual(errors, []); report.pageErrors = errors;
    await fs.writeFile(path.join(output, 'browser-qa.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report));
  } finally {
    clearTimeout(timeout);
    await page.setViewport(null).catch(() => {}); await disconnect();
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
