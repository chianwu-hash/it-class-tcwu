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
    grade: '大學',
    count: null,
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
    } else if (arg === '--count' && argv[i + 1]) {
      options.count = argv[++i];
    } else {
      positional.push(arg);
    }
  }

  options.file = resolveInputFile(positional[0]);
  return options;
}

async function selectDropdownOption(page, dropdownTestId, optionText) {
  const dropdown = page.getByTestId(dropdownTestId);
  await dropdown.waitFor({ state: 'visible', timeout: 15000 });
  await dropdown.evaluate((el) => el.click());
  await page.waitForTimeout(700);

  const clicked = await page.evaluate(({ optionText }) => {
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const desired = normalize(optionText);
    const candidates = [
      ...document.querySelectorAll('[role="option"], [data-testid*="option"], li, div, span, button'),
    ];
    const target = candidates.find((el) => normalize(el.textContent) === desired);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, { optionText });

  if (!clicked) {
    throw new Error(`Could not select "${optionText}" from ${dropdownTestId}`);
  }

  await page.waitForTimeout(700);
}

async function selectQuestionCount(page, count) {
  if (!count) return;

  const clicked = await page.evaluate(({ count }) => {
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const desired = normalize(String(count));
    const buttons = [...document.querySelectorAll('button, div, span')];
    const target = buttons.find((el) => {
      const text = normalize(el.textContent);
      const rect = el.getBoundingClientRect();
      return text === desired && rect.width > 0 && rect.height > 0;
    });
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, { count });

  if (!clicked) {
    throw new Error(`Could not select question count "${count}"`);
  }

  await page.waitForTimeout(700);
}

async function clickAiFlowEntry(page) {
  await page.evaluate(() => {
    const aiCard = document.querySelector('[data-testid="main-section-educational_materials"]');
    if (!aiCard) throw new Error('Could not find AI generate card.');
    aiCard.click();
  });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const byTestId = document.querySelector('[data-testid="ai_create_topic"]');
    if (byTestId) {
      byTestId.click();
      return;
    }

    const target = [...document.querySelectorAll('div,button,span')].find(
      (el) => (el.textContent || '').trim() === '文字或提示'
    );
    if (!target) throw new Error('Could not find "文字或提示" tab.');
    target.click();
  });
  await page.waitForTimeout(1500);
}

async function clickPrimaryGenerateButton(page) {
  const button = page.getByTestId('generate-quiz-button');
  await button.waitFor({ state: 'visible', timeout: 15000 });
  await button.evaluate((el) => el.click());
}

async function isVisible(page, testId) {
  return page.getByTestId(testId).isVisible().catch(() => false);
}

async function waitForQuizPage(page) {
  await page.waitForFunction(
    () => location.pathname.includes('/admin/quiz/'),
    null,
    { timeout: 180000 }
  );
  await page.waitForTimeout(2500);
}

async function advanceAfterFirstGenerate(page) {
  const deadline = Date.now() + 180000;

  while (Date.now() < deadline) {
    if (page.url().includes('/admin/quiz/')) {
      await page.waitForTimeout(2500);
      return;
    }

    if (await isVisible(page, 'subtopics-container')) {
      await clickPrimaryGenerateButton(page);
      await page.waitForTimeout(2500);
      continue;
    }

    if (await isVisible(page, 'use-quiz-button')) {
      await page.getByTestId('use-quiz-button').click();
      await waitForQuizPage(page);
      return;
    }

    await page.waitForTimeout(2500);
  }

  throw new Error('Timed out waiting for Wayground to reach a quiz page.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const content = fs.readFileSync(options.file, 'utf8');

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

  await clickAiFlowEntry(page);

  const textArea = page.getByTestId('short-text-area');
  await textArea.waitFor({ state: 'visible', timeout: 15000 });
  await textArea.fill(content);
  await page.waitForTimeout(500);

  await selectDropdownOption(page, 'language-dropdown', options.language);
  await selectDropdownOption(page, 'subject-dropdown', options.subject);
  await selectDropdownOption(page, 'grade-dropdown', options.grade);
  await selectQuestionCount(page, options.count);

  const language = ((await page.getByTestId('language-dropdown').textContent()) || '').trim();
  const subject = ((await page.getByTestId('subject-dropdown').textContent()) || '').trim();
  const grade = ((await page.getByTestId('grade-dropdown').textContent()) || '').trim();

  await clickPrimaryGenerateButton(page);
  await advanceAfterFirstGenerate(page);

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const result = {
    inputFile: options.file,
    language,
    subject,
    grade,
    count: options.count,
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
