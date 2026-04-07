const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const shot = path.join(outDir, 'browser-smoke.png');

  await page.screenshot({ path: shot, fullPage: true });
  console.log('OK');
  console.log(`Screenshot: ${shot}`);

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
