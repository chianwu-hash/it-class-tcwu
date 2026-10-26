import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuizDb, quizCall, TEACHER, OTHER_TEACHER, studentId } from '../lib/quiz-local-db.mjs';
import { newDocument, content } from '../../shared/quiz-document.mjs';

test('教師本人雲端試答：帳號隔離、後端判分、固定亂序與冪等接續', async () => {
  const db = await createQuizDb();
  const call = (uid, action, data) => quizCall(db, uid, action, data);
  try {
    const document = newDocument(); document.title = '合成個人試答';
    document.blocks[0].questions[0].explanation = content('答後才可見的合成解析');
    const bank_id = crypto.randomUUID();
    await call(TEACHER, 'save', { bank_id, expected_revision: 0, document });
    const v = await call(TEACHER, 'publish', { bank_id, expected_revision: 1 });
    const args = { session_id: crypto.randomUUID(), version_id: v.id, school_year: 115,
      class_codes: [], reveal: 'immediate', shuffle_options: true, access_mode: 'personal' };
    await call(TEACHER, 'open', args);
    assert.equal((await call(TEACHER, 'open', args)).id, args.session_id);
    await assert.rejects(call(TEACHER, 'open', { ...args, access_mode: 'classroom' }), /invalid_session/);
    await assert.rejects(call(OTHER_TEACHER, 'join', args), /session_unavailable/);
    await assert.rejects(call(studentId(1), 'join', args), /session_unavailable/);
    await assert.rejects(quizCall(db, '', 'join', args, 'anon'), /permission denied/);
    assert.equal((await call(OTHER_TEACHER, 'personal_sessions')).sessions.length, 0);
    await assert.rejects(call(studentId(1), 'personal_sessions'), /teacher_required/);
    const joined = await call(TEACHER, 'join', args);
    assert.equal(joined.reviews.length, 0);
    assert.doesNotMatch(JSON.stringify(joined), /合成解析|option_id|explanation/);
    assert.deepEqual((await call(TEACHER, 'resume', args)).document, joined.document);
    const q = document.blocks[0].questions[0];
    const submission = { ...args, question_id: q.id, response: q.answer.option_id, request_id: crypto.randomUUID() };
    const saved = await call(TEACHER, 'submit', submission);
    assert.equal(saved.complete, true); assert.equal(saved.reviews[0].correct, true);
    assert.deepEqual(await call(TEACHER, 'submit', submission), saved);
    assert.deepEqual(await call(TEACHER, 'resume', args), saved);
    await assert.rejects(call(OTHER_TEACHER, 'submit', submission), /session_unavailable/);
    const list = (await call(TEACHER, 'personal_sessions')).sessions;
    assert.equal(list[0].answered, 1); assert.equal(list[0].correct, 1);
    assert.doesNotMatch(JSON.stringify(list), /option_id|合成解析/);
  } finally { await db.close(); }
});
