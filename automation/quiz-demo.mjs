// 僅建立本機合成示範，固定 loopback 來源，沒有正式 Supabase 入口。
import { writeFile, mkdir } from 'node:fs/promises';
import { content } from '../shared/quiz-document.mjs';
const base = 'http://127.0.0.1:4340';
const r = await fetch(`${base}/admin-quiz.html?local=1`);
const cookie = r.headers.get('set-cookie')?.split(';')[0]; if (!cookie) throw new Error('請先啟動本機題庫服務。');
async function request(action, data = {}) {
  const response = await fetch(`${base}/__quiz-rpc`, { method: 'POST', headers: { cookie, origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
}
const single = (id, text, options, correct, explanation) => ({ id, type: 'single', prompt: content(text),
  options: options.map((text, i) => ({ id: String.fromCharCode(97 + i), content: content(text) })),
  answer: { option_id: correct }, explanation: content(explanation) });
const doc = { schema: 1, title: '示範測驗：分數和生活', catalog: { school_year: '115', subject: '數學', publisher: '', volume: '', unit: '平台操作示範（補充）' }, blocks: [
  { id: 'fraction', material: content(), questions: [single('fraction-add', '計算 $\\frac{1}{2}+\\frac{1}{4}$。', ['$\\frac{3}{4}$', '$\\frac{2}{6}$', '$\\frac{1}{4}$'], 'a', '先把 $\\frac{1}{2}$ 換成 $\\frac{2}{4}$，再加上 $\\frac{1}{4}$，得到 $\\frac{3}{4}$。')] },
  { id: 'paper-group', material: content('小安把兩張各為半張大小的紙拼在一起，正好形成一張完整的紙。請讀完材料，再完成這兩個子題。'), questions: [
    { id: 'paper-short', type: 'short', prompt: content('拼好後共有幾張完整的紙？請填入數字。'), answer: { accepted: ['1', '1張', '一張'] }, explanation: content('兩個半張合起來是一張完整的紙。') },
    single('paper-choice', '把完整的紙分成 4 等份，拿走 1 份後，還剩下幾份？', ['3 份', '2 份', '1 份'], 'a', '原來有 4 份，拿走 1 份，還有 3 份。'),
  ] },
] };
const bankId = crypto.randomUUID(); await request('save', { bank_id: bankId, expected_revision: 0, document: doc });
const version = await request('publish', { bank_id: bankId, expected_revision: 1 });
const links = {};
for (const mode of ['immediate', 'complete']) {
  const s = await request('open', { session_id: crypto.randomUUID(), version_id: version.id, school_year: 115, class_codes: ['603'], reveal: mode, shuffle_questions: false, shuffle_options: true });
  links[mode] = `${base}/grade6/115-1/quiz.html?local=1&session=${s.id}&student=1`;
}
await mkdir('automation/output/quiz', { recursive: true });
await writeFile('automation/output/quiz/demo-links.json', JSON.stringify(links, null, 2), 'utf8');
console.log(JSON.stringify(links));
