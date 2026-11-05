import { signDriveImage } from '../quiz-media/drive-ticket.mjs';

const MAX = 20_000_000;
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
async function bounded(response, max) {
  if (Number(response.headers.get('content-length')) > max) {
    await response.body?.cancel(); throw Error('MEDIA_UNAVAILABLE');
  }
  const reader = response.body?.getReader(); if (!reader) throw Error('MEDIA_UNAVAILABLE');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > max) throw Error('MEDIA_UNAVAILABLE'); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

// Read-only. The caller-scoped RPC authorizes room membership AND revealed media.
// A room alias is not a file digest. Integrity uses the registered source digest.
export function createHandler({ env, fetcher = fetch }) {
  return async req => {
    const origin = req.headers.get('origin') || '';
    const allowed = origin === 'https://it-class-tcwu.vercel.app'
      || /^https:\/\/it-class-tcwu-[a-z0-9]+-chianwu-4755s-projects\.vercel\.app$/.test(origin);
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Origin',
      ...(allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
    const send = (status, data) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !allowed) return send(403, { error: 'MEDIA_DENIED' });
    if (req.method === 'OPTIONS') return send(allowed ? 200 : 403, {});
    if (req.method !== 'POST') return send(405, { error: 'METHOD_NOT_ALLOWED' });
    const bearer = req.headers.get('authorization');
    if (!/^Bearer \S+$/.test(bearer || '')) return send(401, { error: 'LOGIN_REQUIRED' });
    try {
      const platformKey = (legacy, dictionary) => env(legacy) || Object.values(JSON.parse(env(dictionary) || '{}'))[0];
      const base = env('SUPABASE_URL'), key = platformKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
      const service = platformKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
      if (!base || !key || !service) throw Error('MEDIA_UNAVAILABLE');
      const call = (url, options = {}) => fetcher(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const user = await call(base + '/auth/v1/user', { headers: { apikey: key, Authorization: bearer } });
      if (!user.ok) return send(401, { error: 'LOGIN_REQUIRED' });
      const text = new TextDecoder().decode(await bounded(req, 1000)), body = JSON.parse(text);
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(body.roomId || '') || !/^[0-9a-f]{64}$/.test(body.hash || '')) return send(400, { error: 'INVALID_REQUEST' });
      const authorization = await call(base + '/rest/v1/rpc/quiz_partner_pilot_media_descriptor', {
        method: 'POST', headers: { apikey: key, Authorization: bearer, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_room: body.roomId, p_hash: body.hash }) });
      if (!authorization.ok) return send(403, { error: 'MEDIA_DENIED' });
      const media = await authorization.json();
      if (typeof media.path !== 'string' || !media.path || media.path.includes('..')
        || !/^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg))$/.test(media.mime)
        || !Number.isInteger(media.bytes) || media.bytes < 1 || media.bytes > MAX
        || !/^[a-f0-9]{64}$/.test(media.sha256 || '')) return send(403, { error: 'MEDIA_DENIED' });
      let object;
      // Match the existing quiz-media contract: past exams stay in Storage;
      // native images follow the configured image backend, audio stays in Storage.
      if (media.backend === 'auto' && env('QUIZ_IMAGE_BACKEND') === 'drive' && media.mime.startsWith('image/')) {
        if (env('QUIZ_IMAGE_BACKEND') !== 'drive' || media.url?.split('/').at(-1) !== media.sha256) throw Error('MEDIA_UNAVAILABLE');
        const url = await signDriveImage({ url: media.url, mime: media.mime, bytes: media.bytes }, env);
        // Never send a Supabase service credential to the image Worker.
        object = await call(url);
      } else if (media.backend === 'supabase' || media.backend === 'auto') {
        object = await call(base + '/storage/v1/object/authenticated/quiz-media/' + media.path.split('/').map(encodeURIComponent).join('/'), {
          headers: { apikey: service, ...(service.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + service }) } });
      } else return send(403, { error: 'MEDIA_DENIED' });
      if (!object.ok) return send(404, { error: 'MEDIA_UNAVAILABLE' });
      const bytes = await bounded(object, Math.min(media.bytes, MAX));
      if (bytes.length !== media.bytes || hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))) !== media.sha256) return send(502, { error: 'MEDIA_UNAVAILABLE' });
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return send(200, { mime: media.mime, base64: btoa(binary) });
    } catch { return send(503, { error: 'MEDIA_UNAVAILABLE' }); }
  };
}
