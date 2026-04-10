const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_DIR = path.resolve(__dirname, 'output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function parseArgs(argv) {
  const options = {
    out: path.join(OUTPUT_DIR, 'gemini-latest-response.txt'),
    stableChecks: 3,
    pollMs: 2000,
    timeoutMs: 90000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1]) {
      options.out = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--stable-checks' && argv[i + 1]) {
      options.stableChecks = Number(argv[++i]);
    } else if (arg === '--poll-ms' && argv[i + 1]) {
      options.pollMs = Number(argv[++i]);
    } else if (arg === '--timeout-ms' && argv[i + 1]) {
      options.timeoutMs = Number(argv[++i]);
    }
  }

  return options;
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

  return {
    selector: null,
    count: 0,
    text: '',
  };
}

async function captureStableLatestResponse(page, options) {
  const deadline = Date.now() + options.timeoutMs;
  let previousText = '';
  let stableCount = 0;
  let best = { selector: null, count: 0, text: '' };

  while (Date.now() < deadline) {
    const current = await page.evaluate(latestResponseFromDom);
    if (current.text.length > best.text.length) {
      best = current;
    }

    if (current.text && current.text === previousText) {
      stableCount += 1;
    } else {
      stableCount = 0;
      previousText = current.text;
    }

    if (current.text && stableCount >= options.stableChecks) {
      return current;
    }

    await page.waitForTimeout(options.pollMs);
  }

  if (best.text) return best;
  throw new Error('Could not capture a stable Gemini response before timeout.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

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

  const result = await captureStableLatestResponse(page, options);

  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, result.text, 'utf8');

  const meta = {
    url: page.url(),
    title: await page.title(),
    selector: result.selector,
    candidateCount: result.count,
    length: result.text.length,
    out: options.out,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'gemini-latest-response.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );

  console.log(JSON.stringify(meta, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
