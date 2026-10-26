import { createHandler } from '../../supabase/functions/quiz-media/handler.mjs';
import { quizCall, TEACHER, OTHER_TEACHER, studentId } from './quiz-local-db.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

export const fixturePng = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=', 'base64'));
export function fixtureWav() {
  const b = Buffer.alloc(8044); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(8000, 40); return b;
}
// 僅本機使用的 Auth／Storage 替身。正式 handler 原樣執行，SQL 使用真實 PGlite。
export function createLocalMedia({ db, directory, origin, sourceFetch = null }) {
  const base = 'https://quiz-local-backend.invalid', service = 'local-service-only', secret = randomBytes(32);
  const objects = new Map();
  const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const tokenUid = token => token === 'teacher' ? TEACHER : token === 'other-teacher' ? OTHER_TEACHER : /^student-([1-9]|[12][0-9]|3[01])$/.test(token) ? studentId(Number(token.slice(8))) : null;
  const file = path => { if (!/^[0-9a-f-]{36}\/[0-9a-f]{64}$/.test(path)) throw new Error('invalid_path'); return resolve(directory, path); };
  const envs = { SUPABASE_URL: base, SUPABASE_ANON_KEY: 'local-public', SUPABASE_SERVICE_ROLE_KEY: service,
    QUIZ_ALLOWED_ORIGINS: origin, QUIZ_MEDIA_SOURCE_HOSTS: ['quiz-fixture.example.invalid', process.env.QUIZ_MEDIA_SOURCE_HOSTS].filter(Boolean).join(',') };
  const fetcher = async (input, options = {}) => {
    const url = new URL(input), path = url.pathname;
    if (url.origin !== base) {
      if (url.hostname === 'quiz-fixture.example.invalid') return new Response(path.endsWith('.wav') ? fixtureWav() : fixturePng,
        { headers: { 'Content-Type': path.endsWith('.wav') ? 'audio/wav' : 'image/png' } });
      if (sourceFetch) return sourceFetch(input, options);
      return fetch(input, options);
    }
    const headers = new Headers(options.headers), token = headers.get('authorization')?.slice(7), uid = tokenUid(token || '');
    if (path === '/auth/v1/user') return uid ? json(200, { id: uid, email_confirmed_at: '2026-01-01' }) : json(401, {});
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.split('/').at(-1), data = JSON.parse(options.body);
      try {
        if (name === 'quiz_action' && uid) return json(200, await quizCall(db, uid, data.p_action, data.p_data));
        if (name === 'quiz_media_access' && uid) return json(200, await db.transaction(async tx => {
          await tx.query("select set_config('quiz.test_uid',$1,true)", [uid]); await tx.exec('set local role authenticated');
          return (await tx.query('select public.quiz_media_access($1,$2) result', [data.p_url, data.p_attempt || null])).rows[0].result;
        }));
        if (name === 'quiz_freeze_publish' && token === service) return json(200, await db.transaction(async tx => {
          await tx.exec('set local role service_role');
          return (await tx.query('select public.quiz_freeze_publish($1,$2,$3,$4,$5,$6) result',
            [data.p_uid, data.p_bank, data.p_revision, JSON.stringify(data.p_original), JSON.stringify(data.p_document), JSON.stringify(data.p_assets)])).rows[0].result;
        }));
        return json(403, {});
      } catch (e) { return json(400, { message: e.message }); }
    }
    if (token !== service) return json(403, {});
    const match = path.match(/^\/storage\/v1\/object\/(authenticated\/|sign\/)?quiz-media\/(.+)$/);
    if (!match) return json(404, {});
    const object = match[2], target = file(object);
    if (match[1] === 'sign/') {
      const expires = Date.now() + 60000, payload = `${object}:${expires}`, mac = createHmac('sha256', secret).update(payload).digest('hex');
      return json(200, { signedURL: `/object/sign/quiz-media/${object}?expires=${expires}&mac=${mac}` });
    }
    if (options.method === 'POST') {
      await mkdir(dirname(target), { recursive: true });
      try { await writeFile(target, options.body, { flag: 'wx' }); objects.set(object, headers.get('content-type')); return json(200, {}); }
      catch (e) { if (e.code === 'EEXIST') return json(409, { error: 'Duplicate' }); throw e; }
    }
    try { return new Response(await readFile(target)); } catch { return json(404, {}); }
  };
  const handler = createHandler({ env: key => envs[key], fetcher });
  return {
    objects, fetcher,
    async call(body, token = 'teacher') {
      const r = await handler(new Request(`${origin}/__quiz-media`, { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
      const result = await r.json();
      if (result.url) result.url = result.url.replace(`${base}/storage/v1/object/sign/quiz-media/`, `${origin}/__quiz-file/`);
      return { status: r.status, result };
    },
    async read(url) {
      const path = url.pathname.slice('/__quiz-file/'.length), expires = url.searchParams.get('expires'), mac = url.searchParams.get('mac') || '';
      const expected = createHmac('sha256', secret).update(`${path}:${expires}`).digest('hex');
      if (!/^\d+$/.test(expires || '') || Number(expires) < Date.now() || mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw new Error('media_unavailable');
      const metadata = (await db.query('select mime from public.quiz_media_assets where object_path=$1', [path])).rows[0];
      if (!metadata) throw new Error('media_unavailable');
      return { bytes: await readFile(file(path)), mime: metadata.mime };
    },
  };
}
