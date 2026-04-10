const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DEFAULT_BANK_DIR = path.resolve(__dirname, 'question-banks');
const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, 'output', 'gemini-reviews');

function parseArgs(argv) {
  const options = {
    banks: [],
    bankDir: DEFAULT_BANK_DIR,
    outDir: DEFAULT_OUTPUT_DIR,
    timeoutMs: 120000,
    pollMs: 2000,
    stableChecks: 3,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--bank' && argv[i + 1]) {
      options.banks.push(argv[++i]);
    } else if (arg === '--bank-dir' && argv[i + 1]) {
      options.bankDir = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--out-dir' && argv[i + 1]) {
      options.outDir = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--timeout-ms' && argv[i + 1]) {
      options.timeoutMs = Number(argv[++i]);
    } else if (arg === '--poll-ms' && argv[i + 1]) {
      options.pollMs = Number(argv[++i]);
    } else if (arg === '--stable-checks' && argv[i + 1]) {
      options.stableChecks = Number(argv[++i]);
    }
  }

  if (!options.banks.length) {
    throw new Error('Usage: node automation/gemini-review-question-banks.js --bank grade6-social-midterm-u1.md');
  }

  return options;
}

function buildPrompt(fileName, bankText) {
  return [
    'You are independently reviewing a Taiwan elementary school question bank.',
    'Respond in Traditional Chinese.',
    'Start your answer with exactly: REVIEW RESULT START',
    'Then use these sections only:',
    '1. definite errors',
    '2. likely issues',
    '3. minor suggestions',
    '4. overall verdict',
    'Cite question numbers whenever possible.',
    'Focus on scope match, answer correctness, repeated concepts, ambiguity, and difficulty balance.',
    'Do not rewrite the whole bank unless needed.',
    '',
    `FILE: ${fileName}`,
    '',
    bankText,
  ].join('\n');
}

function latestResponseFromDom() {
  const selectors = [
    'structured-content-container.model-response-text',
    'structured-content-container',
    'message-content',
    'model-response',
    'response-container .markdown',
  ];

  for (const selector of selectors) {
    const nodes = [...document.querySelectorAll(selector)].filter(
      (el) => (el.innerText || '').trim().length > 50
    );
    if (nodes.length) {
      const node = nodes[nodes.length - 1];
      return {
        selector,
        count: nodes.length,
        text: (node.innerText || '').trim(),
      };
    }
  }

  return { selector: null, count: 0, text: '' };
}

async function captureStableLatestResponse(page, options) {
  const deadline = Date.now() + options.timeoutMs;
  let previousText = '';
  let stableCount = 0;
  let best = { selector: null, count: 0, text: '' };

  while (Date.now() < deadline) {
    const current = await page.evaluate(latestResponseFromDom);
    if (current.text.length > best.text.length) best = current;

    if (current.text && current.text === previousText) {
      stableCount += 1;
    } else {
      stableCount = 0;
      previousText = current.text;
    }

    if (current.text.includes('REVIEW RESULT START') && stableCount >= options.stableChecks) {
      return current;
    }

    await page.waitForTimeout(options.pollMs);
  }

  if (best.text) return best;
  throw new Error('Could not capture a stable Gemini response before timeout.');
}

async function startNewChat(page) {
  const newChat = page.getByRole('button', { name: /\u65b0\u7684\u5c0d\u8a71/ }).first();
  if (await newChat.isVisible().catch(() => false)) {
    await newChat.click({ force: true });
    await page.waitForTimeout(2200);
  }
}

async function ensureThinkingMode(page) {
  const modeButton = page.getByRole('button', { name: /\u958b\u555f\u6a21\u5f0f\u6311\u9078\u5668/ }).first();
  const current = ((await modeButton.innerText().catch(() => '')) || '').trim();
  if (current === '\u601d\u8003\u578b') return current;

  await modeButton.click({ force: true });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const target = [...document.querySelectorAll('button[role="menuitem"], [role="menuitem"]')]
      .find((el) => normalize(el.textContent).includes('\u601d\u8003\u578b'));
    if (!target) throw new Error('Could not find thinking mode item');
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1500);
  return ((await modeButton.innerText().catch(() => '')) || '').trim();
}

async function submitPrompt(page, prompt) {
  const editor = page.locator('[aria-label="\u8acb\u8f38\u5165 Gemini \u63d0\u793a\u8a5e"]').first();
  await editor.waitFor({ state: 'visible', timeout: 15000 });
  await editor.click({ force: true });
  await editor.evaluate((el, value) => {
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  }, prompt);
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /\u50b3\u9001\u8a0a\u606f/ }).first().click({ force: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outDir, { recursive: true });

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  if (!context) throw new Error('No CDP browser context found.');

  const page =
    context.pages().find((p) => p.url().includes('gemini.google.com')) ||
    context.pages()[0];

  if (!page) throw new Error('No Gemini page found.');

  await page.bringToFront();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  const results = [];

  for (const bankName of options.banks) {
    const bankPath = path.resolve(options.bankDir, bankName);
    if (!fs.existsSync(bankPath)) throw new Error(`Question bank not found: ${bankPath}`);

    const bankText = fs.readFileSync(bankPath, 'utf8');

    await startNewChat(page);
    const mode = await ensureThinkingMode(page);
    await submitPrompt(page, buildPrompt(bankName, bankText));
    const response = await captureStableLatestResponse(page, options);

    const outFile = path.join(options.outDir, bankName.replace(/\.md$/i, '.txt'));
    fs.writeFileSync(outFile, response.text, 'utf8');

    results.push({
      bankName,
      mode,
      selector: response.selector,
      responseLength: response.text.length,
      outFile,
      url: page.url(),
    });
  }

  const indexFile = path.join(options.outDir, 'index.json');
  fs.writeFileSync(indexFile, JSON.stringify(results, null, 2), 'utf8');

  console.log(JSON.stringify({ reviewed: results.length, outDir: options.outDir, indexFile }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
