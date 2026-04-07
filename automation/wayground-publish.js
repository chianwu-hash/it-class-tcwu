const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_DIR = path.resolve(__dirname, 'output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  if (!contexts.length) throw new Error('No CDP browser context found');
  const context = contexts[0];
  const pages = context.pages();
  const page = pages.find(p => /wayground\.com\/admin\/quiz\//.test(p.url())) || pages[0];
  if (!page) throw new Error('No Wayground page found');
  await page.bringToFront();
  await page.waitForLoadState('domcontentloaded');

  const publishButton = page.locator('[data-testid="publish-quiz-button"]').first();
  await publishButton.waitFor({ state: 'visible', timeout: 15000 });
  await publishButton.evaluate(el => el.click());

  await page.waitForFunction(() => !location.pathname.endsWith('/edit'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  const result = {
    url: page.url(),
    title: await page.title(),
    bodyPreview: (await page.locator('body').innerText()).slice(0, 400)
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'wayground-publish.json'), JSON.stringify(result, null, 2), 'utf8');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'wayground-publish.png'), fullPage: true });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
