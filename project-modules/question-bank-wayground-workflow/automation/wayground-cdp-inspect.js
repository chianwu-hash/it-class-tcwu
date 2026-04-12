const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  if (!contexts.length) throw new Error('No browser contexts found via CDP.');

  const context = contexts[0];
  const page =
    context.pages().find((p) => p.url().includes('wayground.com')) ||
    context.pages()[0];

  if (!page) throw new Error('No page available in connected browser.');

  await page.goto('https://wayground.com/admin/assessment', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(4000);

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, 'wayground-assessment.png'),
    fullPage: true,
  });

  const buttons = await page.locator('button').evaluateAll((els) =>
    els
      .map((el) => ({
        text: (el.innerText || '').trim(),
        aria: el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || '',
      }))
      .filter((item) => item.text || item.aria || item.title)
  );

  const links = await page.locator('a').evaluateAll((els) =>
    els
      .map((el) => ({
        text: (el.innerText || '').trim(),
        href: el.getAttribute('href') || '',
      }))
      .filter((item) => item.text || item.href)
      .slice(0, 80)
  );

  const inputs = await page.locator('input, textarea, [contenteditable="true"]').evaluateAll((els) =>
    els.map((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type') || '',
      placeholder: el.getAttribute('placeholder') || '',
      aria: el.getAttribute('aria-label') || '',
      text: (el.innerText || '').trim(),
    }))
  );

  const summary = {
    url: page.url(),
    title: await page.title(),
    buttons,
    links,
    inputs,
  };

  fs.writeFileSync(
    path.join(outDir, 'wayground-assessment-dom.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  console.log(`Saved screenshot: ${path.join(outDir, 'wayground-assessment.png')}`);
  console.log(`Saved DOM summary: ${path.join(outDir, 'wayground-assessment-dom.json')}`);
  console.log(`Current URL: ${page.url()}`);
  console.log(`Current title: ${await page.title()}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
