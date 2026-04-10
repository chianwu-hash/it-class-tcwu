const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function resolveInputFile(arg) {
  if (!arg) {
    throw new Error('Usage: node automation/wayground-import-from-bank.js <question-bank.md>');
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
    subject: 'Mathematics',
    lang: 'Chinese',
    grade: '6',
    publish: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--subject' && argv[i + 1]) {
      options.subject = argv[++i];
    } else if (arg === '--lang' && argv[i + 1]) {
      options.lang = argv[++i];
    } else if (arg === '--grade' && argv[i + 1]) {
      options.grade = argv[++i];
    } else if (arg === '--publish') {
      options.publish = true;
    } else {
      positional.push(arg);
    }
  }

  options.file = resolveInputFile(positional[0]);
  return options;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlify(lines) {
  const text = lines
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join('<br>');
  return `<p>${text}</p>`;
}

function parseQuestionBank(markdown) {
  const lines = markdown.split(/\r?\n/);
  const title = (lines.find((line) => /^#\s+/.test(line)) || '').replace(/^#\s+/, '').trim();
  const questions = [];
  let current = null;
  let currentOptionKey = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    const qMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (qMatch) {
      if (current) questions.push(current);
      current = {
        number: Number(qMatch[1]),
        stemLines: [qMatch[2].trim()],
        options: {},
        answer: null,
      };
      currentOptionKey = null;
      continue;
    }

    if (!current) continue;
    if (/^##\s+/.test(trimmed)) continue;
    if (/^[A-D]\.\s*/.test(trimmed)) {
      const optionMatch = trimmed.match(/^([A-D])\.\s*(.*)$/);
      currentOptionKey = optionMatch[1];
      current.options[currentOptionKey] = [optionMatch[2].trim()];
      continue;
    }

    const answerMatch = trimmed.match(/^答案[:：]\s*([A-D])$/);
    if (answerMatch) {
      current.answer = answerMatch[1];
      currentOptionKey = null;
      continue;
    }

    if (currentOptionKey) {
      current.options[currentOptionKey].push(trimmed);
    } else {
      current.stemLines.push(trimmed);
    }
  }

  if (current) questions.push(current);

  for (const question of questions) {
    const optionKeys = ['A', 'B', 'C', 'D'];
    if (!question.answer) {
      throw new Error(`Missing answer for question ${question.number}`);
    }
    for (const key of optionKeys) {
      if (!question.options[key] || !question.options[key].length) {
        throw new Error(`Missing option ${key} for question ${question.number}`);
      }
    }
  }

  return { title, questions };
}

function buildQuestionPayload(parsedQuestions) {
  return parsedQuestions.map((question) => {
    const optionKeys = ['A', 'B', 'C', 'D'];
    const answerIndex = optionKeys.indexOf(question.answer);
    return {
      type: 'MCQ',
      time: 120000,
      structure: {
        settings: {
          hasCorrectAnswer: true,
          fibDataType: 'string',
          canSubmitCustomResponse: false,
          doesOptionHaveMultipleTargets: false,
        },
        hasMath: false,
        query: {
          type: 'text',
          hasMath: false,
          math: { latex: [], template: null },
          answerTime: -1,
          text: htmlify(question.stemLines),
          media: [],
        },
        options: optionKeys.map((key) => ({
          type: 'text',
          hasMath: false,
          math: { latex: [], template: null },
          answerTime: 0,
          text: htmlify(question.options[key]),
          media: [],
        })),
        explain: {
          type: 'text',
          text: '',
          media: [],
          hasMath: false,
          math: { template: null, latex: [] },
          answerTime: 0,
        },
        hints: [],
        kind: 'MCQ',
        theme: {
          fontFamily: 'Quicksand',
          titleFontFamily: 'Quicksand',
          fontColor: { text: '#5D2057' },
          background: { color: '#FFFFFF', image: '', video: '' },
          shape: { largeShapeColor: '#E9E0F3', smallShapeColor: '#9A4292' },
        },
        marks: { correct: 1, incorrect: 0 },
        answer: answerIndex,
      },
      standards: [],
      topics: [],
      isSuperParent: false,
      standardIds: [],
    };
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const markdown = fs.readFileSync(options.file, 'utf8');
  const bank = parseQuestionBank(markdown);
  const questions = buildQuestionPayload(bank.questions);
  const grade = String(options.grade);

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  if (!context) throw new Error('No browser context found via CDP.');

  const page =
    context.pages().find((p) => p.url().includes('wayground.com')) ||
    context.pages()[0];

  if (!page) throw new Error('No Wayground page found.');

  await page.goto('https://wayground.com/admin/assessment', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(async ({ title, lang, subject, grade, questions, shouldPublish }) => {
    const createResponse = await fetch('/quiz/create-with-questions', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'use-quiz-service-be': 'true',
      },
      body: JSON.stringify({
        name: title,
        visibility: true,
        shouldPublish,
        type: 'quiz',
        lang,
        subjects: [subject],
        grade: [grade, grade],
        questions,
      }),
    });

    const createPayload = await createResponse.json();
    if (!createResponse.ok || !createPayload.success) {
      return {
        ok: false,
        step: 'create',
        status: createResponse.status,
        payload: createPayload,
      };
    }

    const quizId = createPayload.data.quiz._id;
    const draftId = createPayload.data.quiz.draftVersion;

    const verifyResponse = await fetch(`/quiz/${quizId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'use-quiz-service-be': 'true',
      },
    });
    const verifyPayload = await verifyResponse.json();
    if (!verifyResponse.ok || !verifyPayload.success) {
      return {
        ok: false,
        step: 'verify',
        status: verifyResponse.status,
        payload: verifyPayload,
        quizId,
        draftId,
      };
    }

    return {
      ok: true,
      quizId,
      draftId,
      questionCount: verifyPayload.data.draft.questions.length,
      quizTitle: verifyPayload.data.draft.name,
      draftLang: verifyPayload.data.draft.lang,
      subjects: verifyPayload.data.draft.subjects,
      editUrl: `/admin/quiz/${quizId}/edit`,
    };
  }, {
    title: bank.title,
    lang: options.lang,
    subject: options.subject,
    grade,
    questions,
    shouldPublish: false,
  });

  if (!result.ok) {
    throw new Error(`Wayground import failed at ${result.step}: ${JSON.stringify(result.payload)}`);
  }

  await page.goto(`https://wayground.com${result.editUrl}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(1500);

  const outDir = path.join(process.cwd(), 'automation', 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const output = {
    inputFile: options.file,
    title: bank.title,
    subject: options.subject,
    lang: options.lang,
    grade,
    questionCount: result.questionCount,
    quizId: result.quizId,
    draftId: result.draftId,
    editUrl: `https://wayground.com${result.editUrl}`,
    shareUrl: `https://wayground.com/admin/quiz/${result.quizId}?source=quiz_share`,
  };

  fs.writeFileSync(
    path.join(outDir, 'wayground-imported-from-bank.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );

  await page.screenshot({
    path: path.join(outDir, 'wayground-imported-from-bank.png'),
    fullPage: true,
  });

  console.log(JSON.stringify(output, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
