const assert = require('node:assert/strict');
const path = require('node:path');
const { connectCdp, safeScreenshot } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
const url = 'http://localhost:3000/prototypes/typing-foundation/level1/?v=20261001-keyboard';

(async () => {
  const c = await connectCdp({ cdpUrl: 'http://127.0.0.1:9232', targetUrl: url });
  const page = c.page;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const text = selector => page.$eval(selector, e => e.textContent);
  const visible = selector => page.$eval(selector, e => !e.hidden);
  async function finishStage() {
    for (let i = 0; i < 5 && await visible('#exercise'); i++) {
      const remaining = await page.$$eval('#prompt span:not(.typed)', es => es.map(e => e.textContent === '␣' ? ' ' : e.textContent).join(''));
      await page.keyboard.type(remaining);
    }
    assert.equal(await visible('#result'), true);
  }
  try {
    await page.bringToFront();
    await page.setViewport({ width: 1365, height: 980 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#steps li');
    assert.match(await text('#policy-note'), /95%＋8 WPM/);
    await page.select('#grade', '6');
    assert.match(await text('#policy-note'), /95%＋12 WPM/);
    await page.click('#starter');
    assert.match(await text('#policy-note'), /95%＋8 WPM/);
    await page.click('#starter');
    await safeScreenshot(page, { path: path.join(__dirname, 'preview-desktop.png'), fullPage: true });
    await page.click('#start');
    assert.equal(await page.$$('#prompt span').then(es => es.length), 19, 'new-key exercise has 19 keystrokes');
    await safeScreenshot(page, { path: path.join(__dirname, 'preview-exercise.png'), fullPage: true });
    console.log('Browser exercise started.');
    const initial = await text('#prompt');
    const initialKey = (await text('#target')).toLowerCase();
    await page.keyboard.press('F');
    assert.equal(await text('#accuracy'), '0%', 'incorrect case is a scored mistake');
    await page.keyboard.press('Backspace');
    assert.equal(await text('#accuracy'), '0%');
    await page.keyboard.type('x');
    assert.equal((await text('#target')).toLowerCase(), initialKey, 'wrong key must not advance');
    assert.equal(await text('#streak'), '0');
    await page.keyboard.down(initialKey);
    await page.keyboard.down(initialKey);
    await page.keyboard.up(initialKey);
    assert.equal(await page.$$eval('#prompt .typed', es => es.length), 1, 'held repeat must not advance');
    const beforePause = await text('#count');
    await page.keyboard.press('Escape');
    assert.equal(await visible('#paused'), true);
    await page.keyboard.type('fff');
    assert.equal(await text('#count'), beforePause);
    await page.click('#resume');
    await page.keyboard.type('xxxxxxxx');
    await finishStage();
    assert.match(await text('#result-title'), /再試/);
    assert.equal(await page.$eval('.growth', e => e.classList.contains('earned')), false);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'continue', 'hidden retry is skipped');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'typing-area');
    console.log('Failed-attempt retry checked.');
    assert.notEqual(await text('#prompt'), initial, 'retry changes the exercise');
    assert.equal(await text('#accuracy'), '—');
    const pastePrevented = await page.$eval('#typing-area', el => !el.dispatchEvent(new Event('paste', { cancelable:true, bubbles:true })));
    assert.equal(pastePrevented, true);
    // Successful optional retry must generate a new exercise too.
    const beforeOptionalRetry = await text('#prompt');
    await finishStage();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'continue', 'result auto-focuses next');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'retry');
    assert.equal(await page.$eval('#retry', e => getComputedStyle(e).outlineStyle), 'solid');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'continue');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'retry');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'continue');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'retry');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'typing-area');
    assert.equal(await text('#accuracy'), '—', 'confirmation Space is not counted as a typing key');
    assert.notEqual(await text('#prompt'), beforeOptionalRetry);
    const beforeFullReplay = await text('#prompt');
    for (let stage = 0; stage < 6; stage++) {
      const expectedLength = stage === 5 ? 39 : 19;
      assert.equal(await page.$$('#prompt span').then(es => es.length), expectedLength);
      if (stage === 5) {
        assert.equal(await visible('#target-line'), false);
        assert.equal(await page.$$('#keyboard .is-target').then(es => es.length), 0);
        assert.match(await text('#attempt-rule'), /12 WPM/);
      }
      await finishStage();
      console.log(`Stage ${stage + 1} completed.`);
      assert.doesNotMatch(await text('#result-title'), /再試一次/);
      if (stage < 5) {
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'typing-area');
      }
    }
    assert.match(await text('#result-title'), /第一次達標/);
    assert.equal(await page.$eval('.growth', e => e.classList.contains('earned')), false);
    await page.click('#continue');
    await page.keyboard.press('Escape');
    assert.match(await text('#pause-note'), /不列入速度確認/);
    await page.click('#resume');
    await finishStage();
    assert.match(await text('#result-stats'), /連續達標 0\/2/);
    assert.match(await text('#result-text'), /曾暫停/);
    assert.equal(await page.$eval('.growth', e => e.classList.contains('earned')), false);
    for (let confirmation = 1; confirmation <= 2; confirmation++) {
      await page.click('#continue');
      await finishStage();
      assert.match(await text('#result-stats'), new RegExp(`連續達標 ${confirmation}/2`));
      assert.equal(await page.$eval('.growth', e => e.classList.contains('earned')), confirmation === 2);
    }
    assert.match(await text('#result-title'), /第\s*1\s*關過關/);
    assert.equal(await page.$eval('.growth', e => e.classList.contains('earned')), true);
    await safeScreenshot(page, { path:path.join(__dirname,'preview-complete.png'), fullPage:true });
    await page.click('[data-stage="0"]');
    assert.match(await text('#stage-label'), /食指定位.*重練/);
    assert.notEqual(await text('#prompt'), beforeFullReplay, 'whole-level replay generates new questions');
    assert.equal(await page.$$('#reward-leaf').then(es => es.length), 1);
    await page.reload({ waitUntil:'networkidle0' });
    assert.equal(await visible('#intro'), true);
    assert.equal(await page.$eval('.growth', e => e.classList.contains('earned')), false);
    await page.setViewport({width:390,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile fits viewport');
    await safeScreenshot(page, {path:path.join(__dirname,'preview-mobile.png'),fullPage:true});
    await page.setViewport({width:1365,height:980});
    await page.click('#start');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'long exercise fits viewport');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement.id), 'typing-area', 'Tab moves focus');
    await page.reload({ waitUntil:'networkidle0' });
    await page.bringToFront();
    assert.deepEqual(errors, []);
    console.log('PASS: six stages, failure/retry, wrong keys, uppercase, Backspace, held repeat, pause/resume, paste, Tab, reward, reload, mobile, no page errors.');
  } finally { await page.setViewport(null); c.disconnect(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
