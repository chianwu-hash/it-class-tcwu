const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function resolveInputFile(arg) {
  if (!arg) {
    throw new Error('Usage: node automation/wayground-generate-from-bank.js <question-bank.md>');
  }
  const file = path.resolve(process.cwd(), arg);
  if (!fs.existsSync(file)) {
    throw new Error(`Question bank not found: ${file}`);
  }
  return file;
}

function parseArgs(argv) {
  const options = {
    file: null,
    language: 'Chinese, Traditional',
    subject: '世界語言',
    grade: '三年級',
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--language' && argv[i + 1]) {
      options.language = argv[++i];
    } else if (arg === '--subject' && argv[i + 1]) {
      options.subject = argv[++i];
    } else if (arg === '--grade' && argv[i + 1]) {
      options.grade = argv[++i];
    } else {
      positional.push(arg);
    }
  }

  options.file = resolveInputFile(positional[0]);
  return options;
}

async function selectDropdownOption(page, testId, desiredText) {
  const dropdown = page.getByTestId(testId);
  await dropdown.waitFor({ state: 'visible', timeout: 15000 });
  await dropdown.evaluate((el) => el.click());
  await page.waitForTimeout(700);

  const clicked = await page.evaluate(({ desiredText }) => {
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const desired = normalize(desiredText);
    const candidates = [
      ...document.querySelectorAll('[role="option"], [data-testid*="option"], li, div, span, button'),
    ];

    const target = candidates.find((el) => normalize(el.textContent) === desired);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, { desiredText });

  if (!clicked) {
    throw new Error(`Could not select "${desiredText}" from ${testId}`);
  }

  await page.waitForTimeout(700);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputFile = options.file;
  const content = fs.readFileSync(inputFile, 'utf8');

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  if (!context) throw new Error('No browser context found via CDP.');

  const page =
    context.pages().find((p) => p.url().includes('wayground.com')) ||
    context.pages()[0];

  if (!page) throw new Error('No Wayground page found.');

  await page.goto('https://wayground.com/admin/assessment', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForTimeout(4000);

  await page.evaluate(() => {
    const byTestId = document.querySelector('[data-testid="ai_create_topic"]');
    if (byTestId) {
      byTestId.click();
      return;
    }
    const target = [...document.querySelectorAll('div,button,span')].find(
      (el) => (el.textContent || '').trim() === '\u6587\u5b57\u6216\u63d0\u793a'
    );
    if (!target) throw new Error('Could not find "文字或提示" tab.');
    target.click();
  });

  await page.waitForTimeout(1500);

  const textArea = page.getByTestId('short-text-area');
  await textArea.waitFor({ state: 'visible', timeout: 15000 });
  await textArea.fill(content);
  await page.waitForTimeout(500);

  await selectDropdownOption(page, 'language-dropdown', options.language);
  await selectDropdownOption(page, 'subject-dropdown', options.subject);
  await selectDropdownOption(page, 'grade-dropdown', options.grade);

  const language = ((await page.getByTestId('language-dropdown').textContent()) || '').trim();
  const subject = ((await page.getByTestId('subject-dropdown').textContent()) || '').trim();
  const grade = ((await page.getByTestId('grade-dropdown').textContent()) || '').trim();

  const continueButton = page.getByTestId('generate-quiz-button');
  await continueButton.waitFor({ state: 'visible', timeout: 15000 });
  await continueButton.evaluate((el) => el.click());
  await page.waitForFunction(
    () => location.pathname.includes('/admin/quiz/') && location.pathname.endsWith('/edit'),
    null,
    { timeout: 120000 }
  ).catch(async () => {
    await page.waitForTimeout(8000);
  });
  await page.waitForTimeout(2500);

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const result = {
    inputFile,
    language,
    subject,
    grade,
    afterUrl: page.url(),
    title: await page.title(),
  };

  await page.screenshot({
    path: path.join(outDir, 'wayground-generated-from-bank.png'),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(outDir, 'wayground-generated-from-bank.json'),
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
