import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { newDocument } from '../../shared/quiz-document.mjs';
const base = 'http://127.0.0.1:4340';
const response = await fetch(`${base}/admin-quiz.html?local=1`);
const cookie = response.headers.get('set-cookie').split(';')[0];
const latencies = [];
async function request(action, data = {}, student) {
  const start = performance.now();
  const r = await fetch(`${base}/__quiz-rpc`, { method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { cookie, origin: base, 'Content-Type': 'application/json', ...(student ? { 'X-Quiz-Demo-Student': String(student) } : {}) }, body: JSON.stringify({ action, data }) });
  const result = await r.json(); latencies.push({ action, student, ms: Math.round(performance.now() - start), status: r.status });
  assert.equal(r.status, 200, JSON.stringify(result)); return result;
}
const d = newDocument(); d.title = 'HTTP 29位學生集中送答合成測試';
const bankId = crypto.randomUUID(); await request('save', { bank_id: bankId, expected_revision: 0, document: d });
const v = await request('publish', { bank_id: bankId, expected_revision: 1 });
const s = await request('open', { session_id: crypto.randomUUID(), version_id: v.id, school_year: 115, class_codes: ['603'], reveal: 'complete' });
try {
  const joined = await Promise.all(Array.from({ length: 29 }, (_, i) => request('join', { session_id: s.id }, i + 1)));
  await Promise.all(joined.map((a, i) => request('submit', { session_id: s.id, question_id: a.document.questions[0].id, response: 'a', request_id: crypto.randomUUID() }, i + 1)));
  const roster = await request('monitor', { session_id: s.id }); assert.equal(roster.students.filter(s => Number(s.answered) === 1).length, 29);
  const report = { saved: 29, maxSubmitMs: Math.max(...latencies.filter(x => x.action === 'submit').map(x => x.ms)), latencies };
  await mkdir('automation/output/quiz', { recursive: true }); await writeFile('automation/output/quiz/http-load-qa.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ saved: report.saved, maxSubmitMs: report.maxSubmitMs }));
} finally { await request('close', { session_id: s.id }); }
