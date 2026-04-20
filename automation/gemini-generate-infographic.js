const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

function parseArgs(argv) {
  const home = process.env.USERPROFILE || os.homedir();
  const options = {
    cdpUrl: 'http://127.0.0.1:9222',
    promptFile: '',
    outDir: path.join(home, 'projects', 'tmp'),
    outputName: '',
    screenshotPath: path.resolve(process.cwd(), 'automation', 'output', 'gemini-generate-infographic.png'),
    metaPath: path.resolve(process.cwd(), 'automation', 'output', 'gemini-generate-infographic.json'),
    timeoutMs: 240000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--prompt-file' && argv[i + 1]) {
      options.promptFile = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--out-dir' && argv[i + 1]) {
      options.outDir = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--output-name' && argv[i + 1]) {
      options.outputName = argv[++i];
    } else if (arg === '--cdp-url' && argv[i + 1]) {
      options.cdpUrl = argv[++i];
    } else if (arg === '--timeout-ms' && argv[i + 1]) {
      options.timeoutMs = Number(argv[++i]);
    } else if (arg === '--screenshot' && argv[i + 1]) {
      options.screenshotPath = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--meta' && argv[i + 1]) {
      options.metaPath = path.resolve(process.cwd(), argv[++i]);
    }
  }

  if (!options.promptFile) {
    throw new Error('Missing required --prompt-file <path>. Use a UTF-8 text file to avoid Chinese prompt corruption.');
  }

  return options;
}

function readPrompt(promptFile) {
  const prompt = fs.readFileSync(promptFile, 'utf8').trim();
  if (!prompt) {
    throw new Error(`Prompt file is empty: ${promptFile}`);
  }
  return prompt;
}

async function getGeminiPage(browser) {
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error('No CDP browser context found.');
  }

  const page =
    context.pages().find((p) => p.url().includes('gemini.google.com')) ||
    context.pages()[0];

  if (!page) {
    throw new Error('No Gemini page found in the connected CDP browser.');
  }

  await page.bringToFront();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  return { context, page };
}

async function openNewChat(page) {
  const selectors = [
    () => page.getByRole('link', { name: '新對話' }).first(),
    () => page.getByRole('link', { name: '新的對話' }).first(),
    () => page.getByRole('button', { name: '新對話' }).first(),
    () => page.getByRole('button', { name: '新的對話' }).first(),
    () => page.getByLabel('新對話').first(),
  ];

  for (const getLocator of selectors) {
    const locator = getLocator();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1500);
      return;
    }
  }

  throw new Error('Could not find Gemini new chat control. Open a fresh Gemini conversation before generating images.');
}

async function clickImageMode(page) {
  const selectors = [
    () => page.getByRole('button', { name: '🖼️ 生成圖片' }).first(),
    () => page.getByRole('button', { name: '建立圖像' }).first(),
    () => page.getByRole('button', { name: /生成圖片/ }).first(),
  ];

  for (const getLocator of selectors) {
    const locator = getLocator();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      await page.waitForTimeout(800);
      return;
    }
  }
}

async function fillPrompt(page, prompt) {
  const textboxCandidates = [
    page.locator('[role="textbox"][aria-label="請輸入 Gemini 提示詞"]').first(),
    page.locator('[role="textbox"][aria-label*="Gemini"]').first(),
    page.locator('[role="textbox"]').first(),
  ];

  let editor = null;
  for (const candidate of textboxCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      editor = candidate;
      break;
    }
  }

  if (!editor) {
    throw new Error('Could not find Gemini prompt textbox.');
  }

  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(prompt);
}

async function clickSend(page) {
  const sendButton = page.getByRole('button', { name: '傳送訊息' });
  if (!(await sendButton.isVisible().catch(() => false))) {
    throw new Error('Could not find Gemini send button.');
  }
  await sendButton.click();
}

async function waitForImageReady(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const loadingVisible = await page
      .getByText('正在載入')
      .isVisible()
      .catch(() => false);
    const downloadVisible = await page
      .getByRole('button', { name: '下載原尺寸圖片' })
      .last()
      .isVisible()
      .catch(() => false);

    if (downloadVisible && !loadingVisible) {
      // Give Gemini a short buffer after the UI first reports readiness.
      await page.waitForTimeout(1200);
      return;
    }

    await page.waitForTimeout(2000);
  }

  throw new Error('Timed out waiting for Gemini image download button.');
}

async function downloadGeneratedImage(page, outDir, outputName) {
  fs.mkdirSync(outDir, { recursive: true });

  const downloadButton = page.getByRole('button', { name: '下載原尺寸圖片' }).last();
  await downloadButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    downloadButton.click(),
  ]);

  const suggestedFilename = download.suggestedFilename();
  const finalName = outputName || suggestedFilename;
  const savePath = path.join(outDir, finalName);
  await download.saveAs(savePath);
  return {
    savePath,
    suggestedFilename,
    finalName,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prompt = readPrompt(options.promptFile);

  const browser = await chromium.connectOverCDP(options.cdpUrl);
  try {
    const { page } = await getGeminiPage(browser);

    await openNewChat(page);
    await clickImageMode(page);
    await fillPrompt(page, prompt);
    await clickSend(page);
    await waitForImageReady(page, options.timeoutMs);

    fs.mkdirSync(path.dirname(options.screenshotPath), { recursive: true });
    await page.screenshot({ path: options.screenshotPath, fullPage: true });

    const download = await downloadGeneratedImage(page, options.outDir, options.outputName);

    const meta = {
      promptFile: options.promptFile,
      outDir: options.outDir,
      outputName: download.finalName,
      suggestedFilename: download.suggestedFilename,
      savePath: download.savePath,
      screenshotPath: options.screenshotPath,
      cdpUrl: options.cdpUrl,
      pageUrl: page.url(),
      title: await page.title(),
      generatedAt: new Date().toISOString(),
      notes: [
        'Prompt must be read from a UTF-8 file. Do not inline Chinese prompt text in PowerShell here-strings.',
        'This script only covers Gemini generation and original-image download.',
      ],
    };

    fs.mkdirSync(path.dirname(options.metaPath), { recursive: true });
    fs.writeFileSync(options.metaPath, JSON.stringify(meta, null, 2), 'utf8');

    console.log(JSON.stringify(meta, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
