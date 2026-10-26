import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalMedia } from '../lib/quiz-local-media.mjs';
import { createQuizDb, quizCall, TEACHER, OTHER_TEACHER, studentId } from '../lib/quiz-local-db.mjs';
import { content, newDocument, newQuestion, importQuestionBank, validateDocument } from '../../shared/quiz-document.mjs';

function fixture() {
  const d = newDocument(); d.title = '分數與音檔測試';
  const q1 = d.blocks[0].questions[0]; q1.prompt = content('計算 $\\frac{1}{2}+\\frac{1}{2}$');
  q1.explanation = content('單題秘密解析');
  const q2 = newQuestion('short'); q2.answer.accepted = ['原始答案', '另一答案']; q2.explanation = content('題組秘密解析');
  const q3 = newQuestion(); q3.explanation = content('第三題秘密解析');
  d.blocks.push({ id: 'group', material: content('共用材料', [{ kind: 'audio', url: 'https://quiz-fixture.example.invalid/audio-v1.wav', alt: '自行播放音檔' }]), questions: [q2, q3] });
  d.blocks.push({ id: 'last', material: content(), questions: [newQuestion()] });
  return d;
}
const bankId = () => crypto.randomUUID();

test('Markdown 匯入保留題目、圖片與依據，失敗不回傳部分題庫', async () => {
  // 合成資料讓乾淨 checkout 可獨立執行，不依賴教師私人題庫或圖片。
  const md = '# 合成題庫匯入測試\n\n' + Array.from({ length: 15 }, (_, i) =>
    `${i + 1}. 合成測試題\n${i === 1 ? '圖片：https://quiz-fixture.example.invalid/diagram.png\n' : ''}A. 一\nB. 二\nC. 三\nD. 四\n答案：B\n解析：合成解析\n`
  ).join('\n');
  const d = importQuestionBank(md); assert.equal(d.blocks.length, 15);
  assert.equal(d.blocks[1].questions[0].prompt.media[0].kind, 'image');
  assert.match(d.blocks[0].questions[0].explanation.text, /合成解析/);
  assert.throws(() => importQuestionBank(md.replace('答案：B', '答案：Z')), /第 1 題/);
  assert.equal(validateDocument(d), d);
  assert.throws(() => validateDocument({ ...d, catalog: null }), /格式錯誤/);
});

test('真實 SQL：教師備課權限、版本、揭答隔離、亂序與重試', async () => {
  const db = await createQuizDb();
  const directory = await mkdtemp(join(tmpdir(), 'quiz-media-'));
  const media = createLocalMedia({ db, directory, origin: 'http://127.0.0.1:4340' });
  const call = (id, a, d) => quizCall(db, id, a, d);
  try {
    await db.exec(await readFile(new URL('../../supabase/quiz.sql', import.meta.url), 'utf8'));
    await assert.rejects(quizCall(db, '', 'list', {}, 'anon'), /permission denied/);
    await assert.rejects(call(studentId(1), 'list'), /teacher_required/);
    await assert.rejects(call(studentId(1), 'sessions'), /teacher_required/);
    for (const table of ['quiz_banks', 'quiz_versions', 'quiz_sessions', 'quiz_attempts', 'quiz_answers']) {
      await db.transaction(async tx => { await tx.exec('set local role authenticated'); await assert.rejects(tx.exec(`select * from public.${table}`), /permission denied/); });
    }
    const id = bankId(), d = fixture();
    await db.query('insert into auth.users values($1,$2,now())', ['00000000-0000-4000-9000-000000000001', 'unlisted@example.invalid']);
    const save = { bank_id: id, expected_revision: 0, document: d };
    const first = await call(TEACHER, 'save', save); assert.equal(first.revision, 1);
    assert.equal((await call(TEACHER, 'save', save)).revision, 1);
    await assert.rejects(call(OTHER_TEACHER, 'get', { bank_id: id }), /bank_unavailable/);
    const versions = { bank_id: id, expected_revision: 1 };
    await assert.rejects(call(TEACHER, 'publish', versions), /media_freeze_required/);
    const frozen = await media.call({ action: 'freeze', data: versions }); assert.equal(frozen.status, 200, JSON.stringify(frozen.result));
    const v1 = frozen.result;
    assert.equal((await call(TEACHER, 'publish', versions)).id, v1.id);
    const changed = structuredClone(d); changed.title = '新題目'; changed.blocks[0].questions[0].answer.option_id = 'b';
    assert.equal((await call(TEACHER, 'save', { ...save, expected_revision: 1, document: changed })).revision, 2);
    await assert.rejects(call(TEACHER, 'publish', versions), /revision_changed/);
    await assert.rejects(call(TEACHER, 'save', { ...save, document: { ...d, title: '過時頁面' } }), /revision_changed/);
    assert.equal((await call(TEACHER, 'versions', { bank_id: id })).versions[0].document.title, d.title);
    assert.equal((await call(TEACHER, 'list', { search: '共用材料' })).banks.length, 1);
    assert.equal((await call(OTHER_TEACHER, 'list')).banks.length, 0);
    const poisoned = structuredClone(d); poisoned.blocks[0].questions[0].prompt.answer = '秘密';
    await assert.rejects(call(TEACHER, 'save', { ...save, bank_id: bankId(), document: poisoned }), /invalid_question/);
    const invalid = structuredClone(d); invalid.blocks[0].questions[0].options[0].id = 'b';
    await assert.rejects(call(TEACHER, 'save', { ...save, bank_id: bankId(), document: invalid }), /invalid_options/);

    for (const reveal of ['immediate', 'complete']) {
      const session = { session_id: bankId(), version_id: v1.id, class_codes: ['603'], school_year: 115,
        reveal, shuffle_questions: true, shuffle_options: true };
      await call(TEACHER, 'open', session); await call(TEACHER, 'open', session);
      assert.ok((await call(TEACHER, 'sessions')).sessions.some(s => s.id === session.session_id));
      assert.equal((await call(OTHER_TEACHER, 'sessions')).sessions.length, 0);
      await assert.rejects(call(TEACHER, 'open', { ...session, reveal: reveal === 'immediate' ? 'complete' : 'immediate' }), /session_conflict/);
      await assert.rejects(call(OTHER_TEACHER, 'open', { ...session, session_id: bankId() }), /version_unavailable/);
      await assert.rejects(call('00000000-0000-4000-9000-000000000001', 'join', session), /roster_required/);
      await assert.rejects(call(OTHER_TEACHER, 'monitor', session), /session_unavailable/);
      await assert.rejects(call(TEACHER, 'join', session), /student_required/);
      const joined = await call(studentId(1), 'join', session);
      const qs = joined.document.questions;
      await assert.rejects(call(studentId(1), 'submit', { ...session, question_id: qs[1].id, response: '原始答案', request_id: bankId() }), /question_order/);
      assert.deepEqual(qs.slice(1, 3).map(q => q.id), d.blocks[1].questions.map(q => q.id));
      assert.deepEqual((await call(studentId(1), 'resume', session)).document, joined.document);
      assert.equal(joined.reviews.length, 0);
      assert.doesNotMatch(JSON.stringify(joined), /秘密解析|accepted|option_id|explanation|correct/);
      const definitions = new Map(d.blocks.flatMap(b => b.questions).map(q => [q.id, q]));
      let lastSubmit;
      for (const [i, q] of qs.entries()) {
        const source = definitions.get(q.id);
        const response = source.type === 'single' ? source.answer.option_id : '  原始答案  ';
        const submit = { ...session, question_id: q.id, response, request_id: bankId(), user_id: studentId(2) };
        const result = await call(studentId(1), 'submit', submit);
        assert.deepEqual(await call(studentId(1), 'submit', submit), result);
        await assert.rejects(call(studentId(1), 'submit', { ...submit, response: '被改過的答案' }), /submission_conflict/);
        if (i === 1) assert.equal(result.reviews.some(r => r.question_id === q.id), false);
        if (reveal === 'complete' && i < qs.length - 1) assert.equal(result.reviews.length, 0);
        lastSubmit = submit;
      }
      const resumed = await call(studentId(1), 'resume', session);
      assert.equal(resumed.complete, true); assert.equal(resumed.reviews.length, 4);
      assert.equal(resumed.responses[d.blocks[1].questions[0].id], '  原始答案  ');
      assert.ok(resumed.reviews.every(r => r.correct)); // 評分仍用 v1；不受草稿改答案污染。
      const other = await call(studentId(2), 'join', session); assert.deepEqual(other.responses, {}); assert.deepEqual(other.reviews, []);
      const monitor = await call(TEACHER, 'monitor', session); assert.equal(Number(monitor.students[0].answered), 4);
      await call(TEACHER, 'close', session);
      assert.equal((await call(studentId(1), 'submit', lastSubmit)).complete, true);
      await assert.rejects(call(studentId(2), 'submit', { ...lastSubmit, question_id: other.document.questions[0].id, request_id: bankId() }), /session_closed/);
      await assert.rejects(call(studentId(3), 'join', session), /attempt_unavailable/);
    }
  } finally { await db.close(); await rm(directory, { recursive: true, force: true }); }
});

test('含教師30席：29位合成學生加入與集中送答，超額拒絕', async () => {
  const db = await createQuizDb();
  try {
    const id = bankId(), d = newDocument();
    await quizCall(db, TEACHER, 'save', { bank_id: id, expected_revision: 0, document: d });
    const v = await quizCall(db, TEACHER, 'publish', { bank_id: id, expected_revision: 1 });
    const s = { session_id: bankId(), version_id: v.id, class_codes: ['603'], school_year: 115, reveal: 'complete' };
    await quizCall(db, TEACHER, 'open', s);
    const joined = await Promise.all(Array.from({ length: 29 }, (_, i) => quizCall(db, studentId(i + 1), 'join', s)));
    await assert.rejects(quizCall(db, studentId(30), 'join', s), /session_full/);
    await Promise.all(joined.map((a, i) => quizCall(db, studentId(i + 1), 'submit', {
      ...s, question_id: a.document.questions[0].id, response: 'a', request_id: bankId(),
    })));
    const roster = await quizCall(db, TEACHER, 'monitor', s);
    assert.equal(roster.students.length, 29); assert.ok(roster.students.every(a => Number(a.answered) === 1));
  } finally { await db.close(); }
});
