import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performanceMigration } from '../quiz-all-subjects/deploy-performance.mjs';
import { createQuizDb, quizCall, studentId } from '../lib/quiz-local-db.mjs';

test('效能上線只替換函式，既有資料與計時不變，身分捷徑保持私有', async () => {
  const files = Object.fromEntries(await Promise.all([['core', 'quiz.sql'], ['pool', 'quiz-pool.sql'], ['wrong', 'quiz-wrong-questions.sql'], ['rewards', 'quiz-rewards.sql']].map(async ([key, file]) => [key, await readFile('supabase/' + file, 'utf8')])));
  const migration = performanceMigration(files);
  assert.match(migration, /performance_changed_timing/);
  assert.match(migration, /naming_changed_protected_data/);
  const db = await createQuizDb();
  try {
    for (const file of ['wrong', 'pool', 'rewards']) await db.exec(files[file]);
    await db.exec('create table public.student_progress(user_id uuid,progress jsonb)');
    const before = await quizCall(db, studentId(1), 'library_sessions');
    await db.exec(migration);
    assert.deepEqual(await quizCall(db, studentId(1), 'library_sessions'), before);
    await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.query('select public.quiz_student_identity()'); }), /permission denied/);
    assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('quiz_student_identity','quiz_action','quiz_pool_catalog','quiz_wrong_questions','quiz_rewards','quiz_delete_paper','quiz_compose')")).rows[0].n, 7);
  } finally { await db.close(); }
});
