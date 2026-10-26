import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQuizDb, quizCall, TEACHER, studentId } from '../lib/quiz-local-db.mjs';
import { createLocalMedia } from '../lib/quiz-local-media.mjs';
import { newDocument } from '../../shared/quiz-document.mjs';
import { createAuthenticatedTransport } from '../../shared/quiz-transport.mjs';
import { createHandler } from '../../supabase/functions/quiz-media/handler.mjs';

test('正式請求介面：SDK 最新權杖、過期／換人拒絕與舊回應隔離', async () => {
  let current = { user: { id: TEACHER }, access_token: 'stale' }, sdk = { ...current, access_token: 'refreshed' }, calls = 0, after;
  const transport = createAuthenticatedTransport({ getSession: () => current, auth: { SUPABASE_URL: 'https://local.invalid', SUPABASE_ANON_KEY: 'public',
    supabase: { auth: { getSession: async () => ({ data: { session: sdk } }) } } },
    fetcher: async (_url, options) => { calls++; assert.equal(options.headers.Authorization, 'Bearer refreshed'); after?.(); return Response.json({ ok: true }); } });
  assert.deepEqual(await transport('/rest/v1/rpc/quiz_action', {}), { ok: true });
  sdk = null; await assert.rejects(transport('/rest/v1/rpc/quiz_action', {}), /登入已失效/); assert.equal(calls, 1);
  sdk = { user: { id: studentId(1) }, access_token: 'other' }; await assert.rejects(transport('/rest/v1/rpc/quiz_action', {}), /身分已變更/); assert.equal(calls, 1);
  sdk = { user: { id: TEACHER }, access_token: 'refreshed' }; after = () => { current = null; };
  await assert.rejects(transport('/rest/v1/rpc/quiz_action', {}), /登入身分已變更/);
  await assert.rejects(transport('/rest/v1/rpc/quiz_action', {}), /請先登入/); assert.equal(calls, 2);
});

test('媒體版本端到端：Auth／Storage 替身＋真實 SQL、不可變位元組、解析權限及原子發布', async () => {
  const db = await createQuizDb(), directory = await mkdtemp(join(tmpdir(), 'quiz-auth-media-'));
  let sourceCalls = 0, sourceValue = 1, redirect = false, mime = 'image/png', sourceHook = null, oversized = false;
  // 明列本測試的合成來源；不呼叫外網。
  const priorHosts = process.env.QUIZ_MEDIA_SOURCE_HOSTS;
  process.env.QUIZ_MEDIA_SOURCE_HOSTS = 'media.example.test';
  const local = createLocalMedia({ db, directory, origin: 'http://127.0.0.1:4340', sourceFetch: async () => {
    await sourceHook?.();
    sourceCalls++; if (redirect) return new Response(null, { status: 302 });
    return new Response(Uint8Array.from([137,80,78,71,13,10,26,10,sourceValue]), { headers: { 'Content-Type': mime, ...(oversized ? { 'Content-Length': '8388609' } : {}) } });
  } });
  if (priorHosts === undefined) delete process.env.QUIZ_MEDIA_SOURCE_HOSTS; else process.env.QUIZ_MEDIA_SOURCE_HOSTS = priorHosts;
  const doc = newDocument(), bank = crypto.randomUUID(), q = doc.blocks[0].questions[0];
  const image = url => ({ kind: 'image', url, alt: '合成圖' });
  q.prompt.media = [image('https://media.example.test/prompt.png')];
  q.explanation.media = [image('https://media.example.test/explanation.png')];
  const call = (id, a, data) => quizCall(db, id, a, data);
  try {
    await call(TEACHER, 'save', { bank_id: bank, expected_revision: 0, document: doc });
    const freeze = { action: 'freeze', data: { bank_id: bank, expected_revision: 1 } };
    assert.equal((await local.call(freeze, 'invalid')).status, 401);
    assert.equal((await local.call(freeze, 'student-1')).result.error, 'teacher_required');
    assert.equal((await local.call(freeze, 'other-teacher')).result.error, 'bank_unavailable');
    const v1 = await local.call(freeze); assert.equal(v1.status, 200, JSON.stringify(v1.result));
    const prompt = v1.result.document.blocks[0].questions[0].prompt.media[0].url;
    // 不同解析檔案在下一版測試，以免相同位元組去重後誤認為保密失敗。
    assert.match(prompt, /^https:\/\/quiz-media.invalid\//);
    const signed = await local.call({ action: 'read', url: prompt }); assert.equal(signed.status, 200);
    const bytes = (await local.read(new URL(signed.result.url))).bytes;
    sourceValue = 2;
    const callsBefore = sourceCalls; assert.equal((await local.call(freeze)).result.id, v1.result.id); assert.equal(sourceCalls, callsBefore);
    assert.deepEqual((await local.read(new URL(signed.result.url))).bytes, bytes);
    const changed = structuredClone(doc); changed.title = '第二版'; changed.blocks[0].questions[0].explanation.media[0].url = 'https://quiz-fixture.example.invalid/secret.wav';
    changed.blocks[0].questions[0].explanation.media[0].kind = 'audio';
    await call(TEACHER, 'save', { bank_id: bank, expected_revision: 1, document: changed });
    const v2 = await local.call({ action: 'freeze', data: { bank_id: bank, expected_revision: 2 } }); assert.equal(v2.status, 200, JSON.stringify(v2.result));
    assert.notEqual(v2.result.document.blocks[0].questions[0].prompt.media[0].url, prompt);
    const secret = v2.result.document.blocks[0].questions[0].explanation.media[0].url;
    const session = { session_id: crypto.randomUUID(), version_id: v2.result.id, school_year: 115, class_codes: ['603'], reveal: 'complete', shuffle_questions: false, shuffle_options: false };
    await call(TEACHER, 'open', session); const joined = await call(studentId(1), 'join', session);
    const read = { action: 'read', url: secret, attempt_id: joined.attempt_id };
    assert.equal((await local.call(read, 'student-1')).result.error, 'media_unavailable');
    assert.equal((await local.call({ ...read, url: joined.document.questions[0].prompt.media[0].url }, 'student-1')).status, 200);
    assert.equal((await local.call(read, 'student-2')).result.error, 'media_unavailable');
    await call(studentId(1), 'submit', { ...session, question_id: q.id, response: 'a', request_id: crypto.randomUUID() });
    const revealed = await local.call(read, 'student-1'); assert.equal(revealed.status, 200);
    assert.equal((await local.read(new URL(revealed.result.url))).mime, 'audio/wav');
    const tampered = new URL(signed.result.url); tampered.searchParams.set('mac', '0'.repeat(64)); await assert.rejects(local.read(tampered), /media_unavailable/);
    const expired = new URL(signed.result.url); expired.searchParams.set('expires', '1'); await assert.rejects(local.read(expired), /media_unavailable/);
    // 服務專用發布不可直接由 authenticated 執行。
    await db.transaction(async tx => { await tx.exec('set local role authenticated'); await assert.rejects(tx.query('select public.quiz_freeze_publish($1,$2,1,$3,$3,$4)', [TEACHER, bank, JSON.stringify(doc), '[]']), /permission denied/); });
    const broken = structuredClone(doc); broken.title = '拒絕重新導向';
    await call(TEACHER, 'save', { bank_id: bank, expected_revision: 2, document: broken }); redirect = true;
    assert.equal((await local.call({ action: 'freeze', data: { bank_id: bank, expected_revision: 3 } })).result.error, 'media_unavailable');
    assert.equal((await call(TEACHER, 'versions', { bank_id: bank })).versions.length, 2);
    redirect = false; mime = 'text/html';
    assert.equal((await local.call({ action: 'freeze', data: { bank_id: bank, expected_revision: 3 } })).result.error, 'media_invalid');
    broken.blocks[0].questions[0].prompt.media[0].url = 'https://127.0.0.1/private';
    await call(TEACHER, 'save', { bank_id: bank, expected_revision: 3, document: broken });
    assert.equal((await local.call({ action: 'freeze', data: { bank_id: bank, expected_revision: 4 } })).result.error, 'media_source_denied');
    const raceBank = crypto.randomUUID(), raceDoc = structuredClone(doc);
    await call(TEACHER, 'save', { bank_id: raceBank, expected_revision: 0, document: raceDoc });
    mime = 'image/png'; oversized = true;
    const raceFreeze = { action: 'freeze', data: { bank_id: raceBank, expected_revision: 1 } };
    assert.equal((await local.call(raceFreeze)).result.error, 'media_invalid');
    oversized = false;
    sourceHook = async () => {
      sourceHook = null;
      await call(TEACHER, 'save', { bank_id: raceBank, expected_revision: 1, document: { ...raceDoc, title: '下載期間修改' } });
    };
    assert.equal((await local.call(raceFreeze)).result.error, 'revision_changed');
    assert.deepEqual((await call(TEACHER, 'versions', { bank_id: raceBank })).versions, []);
  } finally { await db.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Edge CORS：未允許來源拒絕，預檢沒有副作用', async () => {
  let calls = 0;
  const handler = createHandler({ env: key => key === 'QUIZ_ALLOWED_ORIGINS' ? 'https://course.example.test' : '', fetcher: async () => { calls++; throw new Error('unexpected'); } });
  assert.equal((await handler(new Request('https://local.invalid', { method: 'OPTIONS', headers: { Origin: 'https://course.example.test' } }))).status, 204);
  assert.equal((await handler(new Request('https://local.invalid', { method: 'POST', headers: { Origin: 'https://evil.invalid' } }))).status, 403);
  assert.equal(calls, 0);
});
