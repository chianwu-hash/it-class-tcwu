import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuizDb, quizCall, studentId, TEACHER } from '../lib/quiz-local-db.mjs';
import { newDocument, newQuestion, content } from '../../shared/quiz-document.mjs';
import { mergeQuizSnapshot } from '../../shared/quiz-state.mjs';

test('精簡回應只省略固定題目，揭答與重送相同，舊頁面仍取得完整資料', async () => {
  const db = await createQuizDb();
  try {
    for (const reveal of ['immediate', 'complete']) {
      const document = newDocument(), bank_id = crypto.randomUUID();
      document.blocks[0].questions[0].explanation = content('單題解析');
      document.blocks.push({ id: 'group', material: content('共同材料'), questions: [newQuestion(), newQuestion()] });
      await quizCall(db, TEACHER, 'save', { bank_id, expected_revision: 0, document });
      const version = await quizCall(db, TEACHER, 'publish', { bank_id, expected_revision: 1 });
      const session_id = crypto.randomUUID();
      await quizCall(db, TEACHER, 'open', { session_id, version_id: version.id, school_year: 115, class_codes: ['603'], reveal, access_mode: 'practice' });
      let state = await quizCall(db, studentId(1), 'join', { session_id });
      const original = state.document;
      for (const [i, question] of original.questions.entries()) {
        const data = { session_id, question_id: question.id, response: 'a', request_id: crypto.randomUUID() };
        const compact = await quizCall(db, studentId(1), 'submit', { ...data, compact: true });
        assert.equal(compact.document, undefined);
        const full = await quizCall(db, studentId(1), 'submit', data);
        state = mergeQuizSnapshot(state, compact);
        const { compact: omitted, ...merged } = state;
        assert.deepEqual(merged, full);
        assert.deepEqual(state.document, original);
        if ((reveal === 'complete' && i < 2) || i === 1) assert.equal(state.reviews.some(r => r.question_id === question.id), false);
      }
      assert.equal(state.complete, true);
      assert.equal(state.reviews.length, 3);
    }
  } finally { await db.close(); }
});

test('前端拒絕跨帳號／場次／版本的精簡快照，舊完整回應直接相容', () => {
  const previous = { attempt_id: 'a', session_id: 's', version_id: 'v', document: { title: '已確認版本' } };
  const next = { ...previous, document: undefined, compact: true, responses: { q: 'b' } };
  assert.equal(mergeQuizSnapshot(previous, next).document, previous.document);
  for (const key of ['attempt_id', 'session_id', 'version_id']) assert.throws(() => mergeQuizSnapshot(previous, { ...next, [key]: 'other' }), { code: 'quiz_snapshot_mismatch' });
  assert.throws(() => mergeQuizSnapshot(null, next), { code: 'quiz_snapshot_mismatch' });
  const full = { document: { title: '完整回應' } };
  assert.equal(mergeQuizSnapshot(previous, full), full);
});
