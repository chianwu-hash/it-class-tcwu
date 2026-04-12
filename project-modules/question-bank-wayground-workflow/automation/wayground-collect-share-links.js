const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function parseArgs(argv) {
  const options = {
    config: path.join(process.cwd(), 'automation', 'wayground-quizzes.json'),
    out: path.join(process.cwd(), 'automation', 'output', 'wayground-links.json'),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--config' && argv[i + 1]) {
      options.config = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--out' && argv[i + 1]) {
      options.out = path.resolve(process.cwd(), argv[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function loadQuizConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Quiz config not found: ${configPath}\n` +
      'Create one from project-modules/question-bank-wayground-workflow/templates/wayground-quizzes.sample.json'
    );
  }

  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const quizzes = Array.isArray(parsed) ? parsed : parsed.quizzes;
  if (!Array.isArray(quizzes) || quizzes.length === 0) {
    throw new Error('Quiz config must be an array or an object with a non-empty quizzes array.');
  }

  quizzes.forEach((quiz, index) => {
    if (!quiz.id) {
      throw new Error(`Quiz config item ${index + 1} is missing required field: id`);
    }
  });

  return quizzes;
}

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
  const options = parseArgs(process.argv.slice(2));
  const quizzes = loadQuizConfig(options.config);

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

  for (const quiz of quizzes) {
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

  const outDir = path.dirname(options.out);
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = options.out;
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');

  console.log(JSON.stringify({ saved: outFile, quizzes: results.length }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
