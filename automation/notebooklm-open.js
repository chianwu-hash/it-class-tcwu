const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const channel = process.argv[2] || 'msedge';
  const browser = await chromium.launch({
    headless: false,
    slowMo: 150,
    channel
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto('https://notebooklm.google.com/', { waitUntil: 'domcontentloaded' });

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, 'notebooklm-home.png'), fullPage: true });

  console.log(`NotebookLM opened with channel: ${channel}`);
  console.log('Browser left open for login/manual inspection. Close it when done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
