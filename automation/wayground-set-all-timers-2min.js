const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_DIR = path.resolve(__dirname, 'output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const TWO_MIN_RE = /\u0032\s*\u5206/;

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  if (!context) throw new Error('No CDP browser context found');
  const page = context.pages().find(p => /wayground\.com\/admin\/quiz\//.test(p.url())) || context.pages()[0];
  if (!page) throw new Error('No Wayground page found');
  await page.bringToFront();
  await page.waitForLoadState('domcontentloaded');

  const bodyText = await page.locator('body').innerText();
  if (bodyText.includes('儲存題目')) {
    await page.locator('button[data-testid="generic-button"]').first().click();
    await page.waitForTimeout(1200);
  }

  const cardCount = await page.locator('[data-testid^="question-details-card-"]').count();
  const updated = [];
  const skipped = [];

  for (let i = 0; i < cardCount; i++) {
    const card = page.locator(`[data-testid="question-details-card-${i}"]`);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);

    const cardText = await card.innerText();
    if (TWO_MIN_RE.test(cardText)) {
      skipped.push(i + 1);
      continue;
    }

    const changed = await card.evaluate((el) => {
      const trigger = el.querySelectorAll('.popover-trigger .hover\\:bg-wds-light-300.rounded-w-admin-lg.py-1.px-2.cursor-pointer')[0];
      if (!trigger) return false;
      trigger.click();
      return true;
    });
    if (!changed) throw new Error(`Could not open timer dropdown for question ${i + 1}`);

    await page.waitForFunction(() => {
      return [...document.querySelectorAll('*')].some(el => (el.innerText || '').trim() === '\u0032 \u5206\u9418');
    }, null, { timeout: 10000 });

    const picked = await page.evaluate(() => {
      const target = '\u0032 \u5206\u9418';
      const elements = [...document.querySelectorAll('*')].filter(el => (el.innerText || '').trim() === target);
      const match = elements.find(el => (el.className || '').includes('p-3 rounded-w-admin-lg')) || elements[0];
      if (!match) return false;
      match.click();
      return true;
    });
    if (!picked) throw new Error(`Could not pick 2 分鐘 for question ${i + 1}`);

    await page.waitForTimeout(500);
    const afterText = await card.innerText();
    if (!TWO_MIN_RE.test(afterText)) {
      throw new Error(`Question ${i + 1} did not update to 2 分鐘`);
    }
    updated.push(i + 1);
  }

  const result = {
    url: page.url(),
    cardCount,
    updated,
    skipped,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'wayground-set-all-timers-2min.json'), JSON.stringify(result, null, 2), 'utf8');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'wayground-set-all-timers-2min.png'), fullPage: true });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
