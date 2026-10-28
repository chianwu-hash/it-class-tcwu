import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createQuizDb, quizCall, studentId, TEACHER } from '../lib/quiz-local-db.mjs';
import { newDocument, newQuestion, content } from '../../shared/quiz-document.mjs';

// Set QUIZ_BASELINE_SQL to the preserved, pre-change quiz.sql for this release audit.
test('發行前以實際舊函式逐題比對新函式的作答、解析、題組揭答與舊前端相容', { skip: !process.env.QUIZ_BASELINE_SQL }, async () => {
  const db = await createQuizDb();
  try {
    const source = await readFile(process.env.QUIZ_BASELINE_SQL, 'utf8');
    const start = source.indexOf('create or replace function public.quiz_action('), end = source.indexOf('revoke all on function public.quiz_valid_runs', start);
    assert.ok(start >= 0 && end > start);
    await db.exec(source.slice(start, end).replace('public.quiz_action(', 'public.quiz_action_baseline('));
    const old = (uid, action, data) => db.transaction(async tx => {
      await tx.query("select set_config('quiz.test_uid',$1,true)", [uid]); await tx.exec('set local role authenticated');
      return (await tx.query('select public.quiz_action_baseline($1,$2) result', [action, JSON.stringify(data)])).rows[0].result;
    });
    for (const reveal of ['immediate', 'complete']) {
      const document = newDocument(), bank_id = crypto.randomUUID();
      document.blocks[0].questions[0].explanation = content('第一題逐步解析');
      const short = newQuestion('short'); short.answer.accepted = ['原始答案']; short.explanation = content('題組解析');
      document.blocks.push({ id: 'group', material: content('共用閱讀材料'), questions: [short, newQuestion()] });
      document.blocks.push({ id: 'last', material: content(), questions: [newQuestion()] });
      await quizCall(db, TEACHER, 'save', { bank_id, expected_revision: 0, document });
      const version = await quizCall(db, TEACHER, 'publish', { bank_id, expected_revision: 1 });
      const session_id = crypto.randomUUID(), args = { session_id };
      await quizCall(db, TEACHER, 'open', { session_id, version_id: version.id, school_year: 115, class_codes: ['603'], reveal, access_mode: 'practice', shuffle_questions: true, shuffle_options: true });
      const joined = await quizCall(db, studentId(1), 'join', args);
      assert.deepEqual(await old(studentId(1), 'resume', args), joined);
      for (const q of joined.document.questions) {
        const data = { ...args, question_id: q.id, response: q.type === 'short' ? '  原始答案  ' : 'b', request_id: crypto.randomUUID() };
        const next = await quizCall(db, studentId(1), 'submit', data);
        assert.deepEqual(await old(studentId(1), 'submit', data), next);
        assert.deepEqual(await old(studentId(1), 'resume', args), await quizCall(db, studentId(1), 'resume', args));
        const compact = await quizCall(db, studentId(1), 'submit', { ...data, compact: true });
        const { document: ignored, ...expected } = next;
        assert.deepEqual(compact, { ...expected, compact: true });
      }
    }
  } finally { await db.close(); }
});

test('組卷歷次作答統計快照與舊候選排序完全相同：三難度、重複與舊題號、錯題延伸', { skip: !process.env.QUIZ_BASELINE_SQL }, async () => {
  const db = await createQuizDb();
  try {
    for (const file of ['quiz-wrong-questions.sql', 'quiz-pool.sql']) await db.exec(await readFile('supabase/' + file, 'utf8'));
    await db.query("update public.student_enrollments set class_code='301' where email='student1@example.invalid'");
    const source = await readFile(join(dirname(process.env.QUIZ_BASELINE_SQL), 'quiz-pool.sql'), 'utf8');
    const start = source.indexOf('create or replace function public.quiz_compose('), end = source.indexOf('revoke all on function public.quiz_compose(', start);
    assert.ok(start >= 0 && end > start);
    await db.exec(source.slice(start, end).replace('public.quiz_compose(', 'public.quiz_compose_baseline('));
    const questions = [];
    for (let i = 0; i < 90; i++) {
      const q = newQuestion(); q.id = 'profile_' + i; q.prompt = content('合成排序題 ' + i); q.explanation = content('核對選項與題意'); questions.push(q);
      await db.query('insert into public.quiz_question_pool values($1,$1,$1,$2,$3,$3,$4,$5,true,$6,$7,true)', [q.id, JSON.stringify([1 + i % 2]), 'same-point', [-3, 0, 3][i % 3], 'fixture-v1', JSON.stringify(q), '{}']);
    }
    const compare = async data => {
      const values = [];
      for (const name of ['quiz_compose_baseline', 'quiz_compose']) {
        try {
          await db.transaction(async tx => {
            await tx.query("select set_config('quiz.test_uid',$1,true)", [studentId(1)]); await tx.exec('set local role authenticated');
            const result = (await tx.query(`select public.${name}($1) result`, [JSON.stringify(data)])).rows[0].result;
            await tx.exec('reset role');
            const document = (await tx.query('select v.document from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.id=$1', [result.session_id])).rows[0].document;
            values.push({ document, distribution: result.distribution });
            throw Error('rollback_comparison');
          });
        } catch (error) { if (error.message !== 'rollback_comparison') throw error; }
      }
      assert.deepEqual(values[0], values[1]); // Includes ordered blocks/questions, not just a set.
    };
    for (const difficulty of ['easy', 'medium', 'hard']) await compare({ kind: 'self', difficulty, count: 20, units: [1, 2], request_id: crypto.randomUUID() });
    let reviewed;
    for (let i = 0; i < 3; i++) {
      const document = newDocument(), bank_id = crypto.randomUUID(); document.catalog.volume = '3年級上學期'; document.catalog.subject = '數學';
      document.blocks[0].questions = [structuredClone(questions[2])];
      if (i === 2) document.blocks[0].questions[0].id = 'legacy_profile_2';
      await quizCall(db, TEACHER, 'save', { bank_id, expected_revision: 0, document });
      const version = await quizCall(db, TEACHER, 'publish', { bank_id, expected_revision: 1 }), session_id = crypto.randomUUID();
      await quizCall(db, TEACHER, 'open', { session_id, version_id: version.id, school_year: 115, class_codes: ['301'], reveal: 'immediate', access_mode: 'practice' });
      const state = await quizCall(db, studentId(1), 'join', { session_id });
      await quizCall(db, studentId(1), 'submit', { session_id, question_id: state.document.questions[0].id, response: 'b', request_id: crypto.randomUUID() });
      if (!i) reviewed = state;
    }
    for (const difficulty of ['easy', 'medium', 'hard']) await compare({ kind: 'self', difficulty, count: 20, units: [1, 2], request_id: crypto.randomUUID() });
    await compare({ kind: 'extension', count: 3, attempt_id: reviewed.attempt_id, question_id: questions[2].id, request_id: crypto.randomUUID() });
  } finally { await db.close(); }
});
