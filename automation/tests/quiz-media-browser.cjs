const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const requireRuntime = createRequire('D:/projects/cdp-tools/package.json');
const { connectCdp } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async () => {
  const targetUrl = 'http://127.0.0.1:4340/admin-quiz.html?local=1';
  const { browser, page, session, disconnect } = await connectCdp({ cdpUrl: process.env.CDP_URL, targetUrl, puppeteer: requireRuntime('puppeteer-core') });
  let mediaRequests = 0;
  const wav = Buffer.alloc(44 + 8000); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(8000, 40);
  page.on('dialog', d => d.accept());
  try {
    assert.equal((await session.send('Target.getTargetInfo')).targetInfo.targetId, process.argv[2]);
    // 本測試需驗證圖片／音檔請求，僅此區段啟用 Network interception。
    await page.setRequestInterception(true);
    page.on('request', async req => {
      if (req.url().startsWith('https://quiz-media.example.invalid/')) {
        mediaRequests++;
        await req.respond(req.url().endsWith('.wav') ? { contentType: 'audio/wav', body: wav } : {
          contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#d8e9fa"/><circle cx="120" cy="60" r="40" fill="#7865bd"/></svg>',
        });
      } else await req.continue();
    });
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('可建立測驗'), { polling: 5000, timeout: 20000 });
    const { newDocument, content } = await import(pathToFileURL(path.resolve('shared/quiz-document.mjs')));
    const doc = newDocument(); doc.title = '合成媒體驗證（僅測試）';
    doc.blocks[0].material = content('請自行播放音檔', [
      { kind: 'image', url: 'https://quiz-media.example.invalid/image.svg', alt: '合成圓形圖片' },
      { kind: 'audio', url: 'https://quiz-media.example.invalid/audio.wav', alt: '半秒合成靜音' },
    ]);
    const file = path.resolve('automation/output/quiz/media-bank.json'); await fs.writeFile(file, JSON.stringify(doc), 'utf8');
    await (await page.$('#import-json')).uploadFile(file);
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已匯入為新草稿'), { polling: 5000, timeout: 20000 });
    assert.equal(mediaRequests, 0, '匯入與驗證不載入媒體');
    await page.click('#preview');
    await page.waitForFunction(() => document.querySelector('#preview-body img')?.naturalWidth === 240, { polling: 5000, timeout: 20000 });
    const audio = await page.$eval('#preview-body audio', a => ({ controls: a.controls, autoplay: a.autoplay, preload: a.preload }));
    assert.deepEqual(audio, { controls: true, autoplay: false, preload: 'none' });
    await page.$eval('#preview-body audio', a => a.load());
    await page.waitForFunction(() => document.querySelector('#preview-body audio').readyState >= 2, { polling: 5000, timeout: 20000 });
    assert.equal(await page.$eval('#preview-body audio', a => a.duration), 0.5);
    await page.click('#close-preview'); assert.equal(await page.$eval('#preview-body audio', a => a.paused), true);
    // 不儲存合成媒體網址，不留下依賴 request interception 的題庫。
    await page.click('#new-bank');
    await fs.writeFile('automation/output/quiz/media-qa.json', JSON.stringify({ imageDecoded: true, audioDecodedSeconds: 0.5, controls: true, autoplay: false, preload: 'none', pausedOnClose: true, noMediaRequestDuringValidation: true, mediaRequests, realHeadphonesTested: false }, null, 2), 'utf8');
    console.log('圖片／音檔解碼、手動播放控制、關閉暫停與驗證階段不取媒體：通過。');
  } finally { await page.setRequestInterception(false).catch(() => {}); await disconnect(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
