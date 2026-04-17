const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_DIR = path.resolve(__dirname, 'output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function parseArgs(argv) {
  const options = {
    cdpUrl: 'http://127.0.0.1:9222',
    out: path.join(OUTPUT_DIR, 'notebooklm-latest-response.txt'),
    screenshot: path.join(OUTPUT_DIR, 'notebooklm-after-ask.png'),
    stableChecks: 3,
    pollMs: 2000,
    timeoutMs: 120000,
    prompt: '',
    promptFile: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cdp-url' && argv[i + 1]) {
      options.cdpUrl = argv[++i];
    } else if (arg === '--out' && argv[i + 1]) {
      options.out = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--screenshot' && argv[i + 1]) {
      options.screenshot = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--stable-checks' && argv[i + 1]) {
      options.stableChecks = Number(argv[++i]);
    } else if (arg === '--poll-ms' && argv[i + 1]) {
      options.pollMs = Number(argv[++i]);
    } else if (arg === '--timeout-ms' && argv[i + 1]) {
      options.timeoutMs = Number(argv[++i]);
    } else if (arg === '--prompt' && argv[i + 1]) {
      options.prompt = argv[++i];
    } else if (arg === '--prompt-file' && argv[i + 1]) {
      options.promptFile = path.resolve(process.cwd(), argv[++i]);
    }
  }

  return options;
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
  });
}

async function resolvePrompt(options) {
  if (options.promptFile) {
    return fs.readFileSync(options.promptFile, 'utf8').trim();
  }
  if (options.prompt) {
    return options.prompt.trim();
  }
  const stdin = (await readStdin()).trim();
  return stdin;
}

async function getNotebookPage(context) {
  const page = context.pages().find((p) => p.url().includes('notebooklm.google.com/notebook/'));
  if (!page) {
    throw new Error('No NotebookLM notebook page found in the connected CDP browser.');
  }
  return page;
}

async function scrollChatToBottom(page) {
  await page.evaluate(() => {
    const panel = document.querySelector('.chat-panel-content');
    if (panel) panel.scrollTop = panel.scrollHeight;
  });
  await page.waitForTimeout(800);
}

async function getPairState(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.chat-panel-content');
    const pairs = panel ? [...panel.querySelectorAll('.chat-message-pair')] : [];
    const pair = pairs.at(-1) || null;
    const messages = pair
      ? [...pair.children]
          .filter((el) => el.tagName === 'CHAT-MESSAGE')
          .map((el) => (el.innerText || '').trim())
      : [];

    return {
      pairCount: pairs.length,
      userText: messages[0] || '',
      assistantText: messages[1] || '',
    };
  });
}

async function submitPrompt(page, prompt) {
  await scrollChatToBottom(page);

  const input = page.locator('textarea[aria-label="查詢方塊"]').last();
  const submitButton = page.locator('.query-box-container button[aria-label="提交"]').last();

  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.click();
  await input.fill(prompt);

  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('.query-box-container button[aria-label="提交"]')];
    const btn = buttons.at(-1);
    return !!btn && !btn.disabled;
  }, null, { timeout: 15000 });

  await submitButton.click();
}

async function waitForLatestAssistantResponse(page, prompt, options, initialState) {
  const promptHead = prompt.replace(/\s+/g, ' ').trim().slice(0, 40);
  const deadline = Date.now() + options.timeoutMs;
  let previous = '';
  let stable = 0;
  let best = '';

  while (Date.now() < deadline) {
    await scrollChatToBottom(page);
    const state = await getPairState(page);

    const isNewPair =
      state.pairCount > initialState.pairCount ||
      (state.userText && state.userText !== initialState.userText);
    const promptMatched = state.userText.replace(/\s+/g, ' ').includes(promptHead);

    if (isNewPair || promptMatched) {
      if (state.assistantText.length > best.length) {
        best = state.assistantText;
      }

      if (state.assistantText && state.assistantText === previous) {
        stable += 1;
      } else {
        previous = state.assistantText;
        stable = 0;
      }

      if (state.assistantText && stable >= options.stableChecks) {
        return state.assistantText;
      }
    }

    await page.waitForTimeout(options.pollMs);
  }

  if (best) return best;
  throw new Error('Could not capture a stable NotebookLM response before timeout.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prompt = await resolvePrompt(options);

  if (!prompt) {
    throw new Error('No prompt provided. Use --prompt, --prompt-file, or pipe text to stdin.');
  }

  const browser = await chromium.connectOverCDP(options.cdpUrl);
  const context = browser.contexts()[0];
  if (!context) throw new Error('No CDP browser context found.');

  const page = await getNotebookPage(context);
  await page.bringToFront();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const initialState = await getPairState(page);
  await submitPrompt(page, prompt);
  const responseText = await waitForLatestAssistantResponse(page, prompt, options, initialState);

  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, responseText, 'utf8');

  if (options.screenshot) {
    fs.mkdirSync(path.dirname(options.screenshot), { recursive: true });
    await page.screenshot({ path: options.screenshot, fullPage: false });
  }

  const meta = {
    url: page.url(),
    title: await page.title(),
    out: options.out,
    screenshot: options.screenshot,
    promptLength: prompt.length,
    responseLength: responseText.length,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'notebooklm-latest-response.json'),
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
