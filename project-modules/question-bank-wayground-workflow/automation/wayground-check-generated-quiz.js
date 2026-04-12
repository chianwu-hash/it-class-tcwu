const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function parseQuestionBank(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^\d+\.\s+(.+)$/))
    .filter(Boolean)
    .map((match) => normalizeText(match[1]));
}

function buildMarkdownReport(summary) {
  const lines = [];
  lines.push(`# Wayground 生成檢查`);
  lines.push('');
  lines.push(`- 測驗標題：${summary.quizTitle || '未取得'}`);
  lines.push(`- 頁面網址：${summary.url}`);
  lines.push(`- Wayground 顯示題數：${summary.displayedQuestionCount ?? '未取得'}`);
  lines.push(`- 實際抓到題卡數：${summary.generatedQuestions.length}`);
  if (summary.expectedCount != null) {
    lines.push(`- 原始題庫題數：${summary.expectedCount}`);
  }
  lines.push('');

  if (summary.duplicates.length) {
    lines.push(`## 疑似重複題`);
    lines.push('');
    for (const dup of summary.duplicates) {
      lines.push(`- 題號 ${dup.firstIndex + 1} 與 ${dup.secondIndex + 1} 重複：${dup.stem}`);
    }
    lines.push('');
  }

  if (summary.mismatches.length) {
    lines.push(`## 與原始題庫不一致`);
    lines.push('');
    for (const item of summary.mismatches) {
      lines.push(`- 第 ${item.index + 1} 題`);
      lines.push(`  - 原始：${item.expected}`);
      lines.push(`  - 生成：${item.actual}`);
    }
    lines.push('');
  }

  if (summary.extras.length) {
    lines.push(`## 超出原始題數的題目`);
    lines.push('');
    for (const extra of summary.extras) {
      lines.push(`- 第 ${extra.index + 1} 題：${extra.stem}`);
    }
    lines.push('');
  }

  lines.push(`## 題目清單`);
  lines.push('');
  for (const q of summary.generatedQuestions) {
    lines.push(`${q.index + 1}. ${q.stem}`);
  }
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const bankPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const expectedQuestions = bankPath
    ? parseQuestionBank(fs.readFileSync(bankPath, 'utf8'))
    : [];

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  if (!context) throw new Error('No browser context found via CDP.');

  const page =
    context.pages().find((p) => p.url().includes('/admin/quiz/') && p.url().includes('/edit')) ||
    context.pages().find((p) => p.url().includes('wayground.com')) ||
    context.pages()[0];

  if (!page) throw new Error('No Wayground page found.');

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const summary = await page.evaluate(() => {
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const cards = [...document.querySelectorAll('[data-testid^="question-details-card-"]')];
    const generatedQuestions = cards.map((card, index) => {
      const raw = normalize(card.innerText || card.textContent || '');
      let stem = raw;
      if (raw.includes('編輯')) {
        stem = raw.split('編輯').slice(1).join('編輯');
      }
      stem = stem.replace(/^[0-9]+\s*/, '');
      stem = stem.replace(/^MULTIPLE CHOICE\s*•\s*[0-9]+\s*秒\s*•\s*[0-9]+\s*分\s*/, '');
      return {
        index,
        raw,
        stem: normalize(stem).slice(0, 240),
      };
    });

    const displayedQuestionCountText =
      document.querySelector('[data-testid="header-main-row"]')?.textContent || '';
    const countMatch = displayedQuestionCountText.match(/(\d+)\s*個問題/);
    const quizTitle =
      document.querySelector('[data-testid="edit-name-button"]')?.textContent?.trim() || '';

    return {
      url: location.href,
      quizTitle,
      displayedQuestionCount: countMatch ? Number(countMatch[1]) : null,
      generatedQuestions,
    };
  });

  const seen = new Map();
  summary.duplicates = [];
  for (const q of summary.generatedQuestions) {
    if (seen.has(q.stem)) {
      summary.duplicates.push({
        stem: q.stem,
        firstIndex: seen.get(q.stem),
        secondIndex: q.index,
      });
    } else {
      seen.set(q.stem, q.index);
    }
  }

  summary.expectedCount = expectedQuestions.length || null;
  summary.mismatches = [];
  summary.extras = [];

  if (expectedQuestions.length) {
    const minLen = Math.min(expectedQuestions.length, summary.generatedQuestions.length);
    for (let i = 0; i < minLen; i += 1) {
      const expected = expectedQuestions[i];
      const actual = summary.generatedQuestions[i].stem;
      if (!actual.includes(expected.slice(0, Math.min(expected.length, 12)))) {
        summary.mismatches.push({ index: i, expected, actual });
      }
    }
    if (summary.generatedQuestions.length > expectedQuestions.length) {
      summary.extras = summary.generatedQuestions.slice(expectedQuestions.length);
    }
  }

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });

  await page.screenshot({
    path: path.join(outDir, 'wayground-generated-check.png'),
    fullPage: true,
  });

  fs.writeFileSync(
    path.join(outDir, 'wayground-generated-check.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  fs.writeFileSync(
    path.join(outDir, 'wayground-generated-check.md'),
    buildMarkdownReport(summary),
    'utf8'
  );

  console.log(JSON.stringify({
    url: summary.url,
    quizTitle: summary.quizTitle,
    displayedQuestionCount: summary.displayedQuestionCount,
    generatedCount: summary.generatedQuestions.length,
    expectedCount: summary.expectedCount,
    duplicateCount: summary.duplicates.length,
    mismatchCount: summary.mismatches.length,
    extraCount: summary.extras.length,
  }, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
