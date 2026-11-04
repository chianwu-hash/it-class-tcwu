// Reinstall guard for the 2026-10-30 question_order bug.
// Replays the legacy supabase/*.sql quiz stack, then applies the production function snapshot
// (supabase/production-snapshot/functions.sql) and answers 10 questions in order under a forced hash join.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createQuizDb, quizCall, studentId, TEACHER } from '../lib/quiz-local-db.mjs';
import { newDocument, newQuestion } from '../../shared/quiz-document.mjs';
import { splitSnapshot, unorderedLookups } from '../lib/db-snapshot.mjs';

const sql = f => readFile('supabase/' + f, 'utf8');
const LEGACY = ['quiz-wrong-questions.sql', 'quiz-pool.sql', 'quiz-rewards.sql', 'quiz-load-batch1.sql', 'quiz-load-batch2.sql', 'quiz-load-batch3.sql', 'quiz-load-batch4.sql'];
const IDS = ['00062843', '0070a479', '002d7628', '002d9366', '004ca0c9', '00a1', '00b2', '00c3', '00d4', '00e5'].map(s => 'midterm_' + s);
const forceHash = db => db.exec('set enable_nestloop=off;set enable_mergejoin=off;set enable_indexscan=off;set enable_bitmapscan=off;set enable_indexonlyscan=off');

// The production quiz_action is a wrapper (quiz-learning.sql) over quiz_action_before_learning. Only the
// columns it reads on view_question/submit are stubbed here; the rest of the learning stack is out of scope.
const LEARNING_STUBS = `
create table if not exists public.quiz_learning_sessions(session_id uuid, user_id uuid);
create table if not exists public.quiz_learning_topics(id uuid);`;

async function snapshotQuizFunctions() {
  const blocks = splitSnapshot(await readFile('supabase/production-snapshot/functions.sql', 'utf8'));
  return blocks.filter(b => b.signature === 'quiz_action(text,jsonb)' || b.signature === 'quiz_action_before_learning(text,jsonb)');
}

// The bug as it shipped before 2026-10-30: the same lookup without ordinality / ORDER BY.
const unorder = def => def.replaceAll("with ordinality x(value,ord) where", 'x(value) where').replaceAll("x.value#>>'{}') order by ord limit 1", "x.value#>>'{}') limit 1");

async function setup({ applySnapshot, unordered = false }) {
  const db = await createQuizDb(undefined, { batch2: false, batch3: false });
  for (const f of LEGACY) await db.exec(await sql(f));
  if (applySnapshot) {
    await db.exec(LEARNING_STUBS);
    // Legacy replay leaves quiz_action as the pre-learning function; the snapshot restores both layers.
    for (const b of await snapshotQuizFunctions()) {
      const def = unordered ? unorder(b.definition) : b.definition;
      if (unordered && b.signature.startsWith('quiz_action_before_learning')) assert.equal(unorderedLookups(def).length, 2);
      await db.exec(def + ';');
    }
  }
  const d = newDocument();
  d.blocks = IDS.map((id, i) => { const q = newQuestion(); q.id = id; return { id: 'b' + i, material: { text: '', media: [] }, questions: [q] }; });
  const bank_id = crypto.randomUUID();
  await quizCall(db, TEACHER, 'save', { bank_id, expected_revision: 0, document: d });
  const v = await quizCall(db, TEACHER, 'publish', { bank_id, expected_revision: 1 });
  const args = { session_id: crypto.randomUUID() };
  await quizCall(db, TEACHER, 'open', { ...args, version_id: v.id, school_year: 115, class_codes: ['603'], reveal: 'immediate', access_mode: 'practice' });
  await db.query('update public.quiz_integrity_settings set enabled=false');
  return { db, args };
}

const answerOf = async (db, id) => (await db.query("select q->'answer'->>'option_id' o from public.quiz_versions v,jsonb_array_elements(v.document->'blocks') b,jsonb_array_elements(b->'questions') q where q->>'id'=$1 limit 1", [id])).rows[0].o;

test('快照檢查：舊版 quiz.sql（無 ORDER BY）會被偵測，現行檔案與快照都沒有', async () => {
  const old = execFileSync('git', ['show', '947fced:supabase/quiz.sql'], { encoding: 'utf8' });
  assert.equal(unorderedLookups(old).length, 2, 'legacy quiz.sql had two unordered next-question lookups');
  assert.deepEqual(unorderedLookups(await sql('quiz.sql')), []);
  const blocks = await snapshotQuizFunctions();
  assert.equal(blocks.length, 2);
  for (const b of blocks) assert.deepEqual(unorderedLookups(b.definition), [], b.signature);
});

test('對照組：快照拿掉 ORDER BY 後，hash join 下第 1 題就被 question_order 擋下（證明測試能重現）', async () => {
  const { db, args } = await setup({ applySnapshot: true, unordered: true });
  try {
    const j = await quizCall(db, studentId(1), 'join', args);
    await forceHash(db);
    const next = (await db.query("select value#>>'{}' v from jsonb_array_elements((select question_order from public.quiz_attempts where id=$1)) x(value) where not exists(select 1 from public.quiz_answers q where q.attempt_id=$1 and q.question_id=x.value#>>'{}') limit 1", [j.attempt_id])).rows[0].v;
    assert.notEqual(next, IDS[0], 'hash order happens to match; fixture no longer reproduces');
    await assert.rejects(quizCall(db, studentId(1), 'view_question', { ...args, question_id: IDS[0] }), /question_order/);
  } finally { await db.close(); }
});

test('重裝舊檔＋套用正式快照：強制 hash join 下依序作答 10 題全部成功，跳題仍被擋', async () => {
  const { db, args } = await setup({ applySnapshot: true });
  try {
    const j = await quizCall(db, studentId(1), 'join', args);
    await forceHash(db);
    const plan = (await db.query(`explain select value#>>'{}' from jsonb_array_elements((select question_order from public.quiz_attempts where id='${j.attempt_id}')) x(value) where not exists(select 1 from public.quiz_answers q where q.attempt_id='${j.attempt_id}' and q.question_id=x.value#>>'{}') limit 1`)).rows.map(r => r['QUERY PLAN']).join('\n');
    assert.match(plan, /Hash.*Anti/, plan);
    for (const [i, id] of IDS.entries()) {
      await quizCall(db, studentId(1), 'view_question', { ...args, question_id: id });
      if (i + 1 < IDS.length) await assert.rejects(quizCall(db, studentId(1), 'view_question', { ...args, question_id: IDS[i + 1] }), /question_order/);
      const r = await quizCall(db, studentId(1), 'submit', { ...args, question_id: id, response: await answerOf(db, id), request_id: crypto.randomUUID(), compact: true });
      assert.equal(Object.keys(r.responses).length, i + 1);
    }
    assert.equal((await db.query('select count(*)::int n from public.quiz_answers where attempt_id=$1', [j.attempt_id])).rows[0].n, 10);
  } finally { await db.close(); }
});
