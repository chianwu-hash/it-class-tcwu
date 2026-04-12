const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const promptText = process.argv.slice(2).join(' ').trim();

  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto('https://wayground.com/', { waitUntil: 'domcontentloaded' });

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, 'wayground-home.png'), fullPage: true });

  console.log('Wayground opened.');
  if (promptText) {
    console.log('Prompt received:');
    console.log(promptText);
    console.log('Next step: wire selectors for the prompt box and submit flow.');
  } else {
    console.log('No prompt passed yet.');
  }

  console.log('Browser left open for manual inspection. Close it when done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
