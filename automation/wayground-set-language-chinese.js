const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  if (!context) throw new Error('No browser context found via CDP.');

  const page =
    context.pages().find((p) => p.url().includes('/admin/quiz/') && p.url().includes('/edit')) ||
    context.pages().find((p) => p.url().includes('wayground.com')) ||
    context.pages()[0];

  if (!page) throw new Error('No Wayground page found.');

  await page.bringToFront();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);

  await page.getByTestId('edit-quiz-settings-button').evaluate((el) => el.click());
  await page.waitForTimeout(1000);

  const languageBox = page.getByTestId('publish-modal-language-input-select-box');
  await languageBox.waitFor({ state: 'visible', timeout: 10000 });
  await languageBox.evaluate((el) => el.click());
  await page.waitForTimeout(1000);

  const chineseOption = page.getByTestId('publish-modal-language-input-select-box-option-32');
  await chineseOption.waitFor({ state: 'visible', timeout: 10000 });
  const optionText = ((await chineseOption.textContent()) || '').trim();
  await chineseOption.evaluate((el) => el.click());
  await page.waitForTimeout(800);

  const saveButton = page.getByTestId('quiz-settings-modal-primary-button');
  await saveButton.waitFor({ state: 'visible', timeout: 10000 });
  await saveButton.evaluate((el) => el.click());
  await page.waitForTimeout(1500);

  // Re-open settings to verify the saved language value.
  await page.getByTestId('edit-quiz-settings-button').evaluate((el) => el.click());
  await page.waitForTimeout(1000);
  const savedLanguage = ((await page.getByTestId('publish-modal-language-input-select-box').textContent()) || '').trim();

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, 'wayground-language-chinese.png'),
    fullPage: true,
  });

  const result = {
    url: page.url(),
    selectedOption: optionText,
    savedLanguage,
  };

  fs.writeFileSync(
    path.join(outDir, 'wayground-language-chinese.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
