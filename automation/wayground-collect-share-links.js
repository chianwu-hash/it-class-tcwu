const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const QUIZZES = [
  {
    id: '69d4ebc67140ece99878b577',
    title: '三年級國語期中題庫（一～三課）',
    subject: '國語',
    range: '第一課～第三課',
    count: 30,
  },
  {
    id: '69d50a8fb6631d1ebdfdb782',
    title: '三年級國語期中題庫（四～六課）',
    subject: '國語',
    range: '第四課～第六課',
    count: 30,
  },
  {
    id: '69d50b6d42678d6c2a75b247',
    title: '三年級社會 CH1 題庫',
    subject: '社會',
    range: 'CH1',
    count: 20,
  },
  {
    id: '69d50bf135b8fe286581b11a',
    title: '三年級社會 CH2 題庫',
    subject: '社會',
    range: 'CH2',
    count: 20,
  },
  {
    id: '69d50c561677b34ccfc54d1e',
    title: '三年級社會 CH3 題庫',
    subject: '社會',
    range: 'CH3',
    count: 20,
  },
];

async function closeShareModal(page) {
  const closeCandidates = [
    page.getByTestId('generic-button').first(),
    page.locator('button[aria-label="Close"]').first(),
    page.locator('button:has-text("關閉")').first(),
  ];

  for (const locator of closeCandidates) {
    try {
      if (await locator.isVisible({ timeout: 500 })) {
        await locator.click();
        await page.waitForTimeout(400);
        return;
      }
    } catch {}
  }

  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch {}
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  if (!context) throw new Error('No CDP browser context found.');

  let page = context.pages().find((p) =>
    p.url().includes('wayground.com/admin/my-library/createdByMe')
  );
  if (!page) page = await context.newPage();

  await page.goto('https://wayground.com/admin/my-library/createdByMe', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForTimeout(2500);

  const results = [];

  for (const quiz of QUIZZES) {
    const shareButton = page
      .locator(`[data-testid="quiz-card-${quiz.id}-share-button"]`)
      .first();
    await shareButton.waitFor({ state: 'visible', timeout: 15000 });
    await shareButton.click();
    await page.waitForTimeout(600);

    const teacherShare = page.getByTestId('share-with-a-teacher');
    await teacherShare.waitFor({ state: 'visible', timeout: 10000 });
    await teacherShare.click();
    await page.waitForTimeout(1000);

    const copyButton = page.getByTestId('share-modal-v2-copy-link-button');
    await copyButton.waitFor({ state: 'visible', timeout: 10000 });
    await copyButton.click();
    await page.waitForTimeout(500);

    const link = await page.evaluate(async () => navigator.clipboard.readText());
    results.push({ ...quiz, link });

    await closeShareModal(page);
    await page.waitForTimeout(500);
  }

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, 'grade3-wayground-links.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');

  console.log(JSON.stringify({ saved: outFile, quizzes: results.length }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
