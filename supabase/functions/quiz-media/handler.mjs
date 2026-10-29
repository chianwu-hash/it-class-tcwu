import { signDriveImage } from './drive-ticket.mjs';
const BUCKET = 'quiz-media', MAX = 8388608, TOTAL = 33554432;
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
const fail = code => { throw new Error(code); };
export const mediaEntries = doc => doc.blocks.flatMap(b => [b.material, ...b.questions.flatMap(q => [q.prompt, q.explanation, ...(q.options || []).map(o => o.content)])]).flatMap(c => c.media);
async function bounded(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel().catch(() => {}); fail('media_invalid'); }
  const reader = response.body?.getReader(); if (!reader) fail('media_invalid');
  let size = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) fail('media_invalid'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  const result = new Uint8Array(size); let offset = 0; for (const c of chunks) { result.set(c, offset); offset += c.length; } return result;
}
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
function mediaType(bytes, kind) {
  const s = new TextDecoder('latin1').decode(bytes.slice(0, 16));
  if (kind === 'image') {
    if (bytes[0] === 137 && s.slice(1, 4) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return 'image/png';
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
    if (/^GIF8[79]a/.test(s)) return 'image/gif';
    if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'image/webp';
  } else if (kind === 'audio') {
    if (s.startsWith('RIFF') && s.slice(8, 12) === 'WAVE') return 'audio/wav';
    if (s.startsWith('OggS')) return 'audio/ogg';
    if (s.startsWith('ID3') || (bytes[0] === 255 && (bytes[1] & 224) === 224)) return 'audio/mpeg';
  }
  fail('media_invalid');
}

// fetcher/env 可注入：本機以假 Auth／Storage＋真實候選 SQL 驗證，沒有正式連線。
export function createHandler({ env, fetcher = fetch }) {
  return async request => {
    const origins = (env('QUIZ_ALLOWED_ORIGINS') || '').split(',').filter(Boolean);
    const origin = request.headers.get('origin');
    const cors = origin && origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS' } : {};
    const send = (status, data) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (origin && !origins.includes(origin)) return send(403, { error: 'origin_denied' });
    if (request.method === 'OPTIONS') return send(204, null);
    if (request.method !== 'POST') return send(405, { error: 'method_not_allowed' });
    try {
      const platformKey = (legacy, dictionary) => env(legacy) || Object.values(JSON.parse(env(dictionary) || '{}'))[0];
      const base = env('SUPABASE_URL'), key = platformKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS'), service = platformKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
      if (!base || !key || !service) fail('service_unavailable');
      const bearer = request.headers.get('authorization');
      if (!/^Bearer \S+$/.test(bearer || '')) return send(401, { error: 'login_required' });
      const call = (url, options = {}) => fetcher(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const userResponse = await call(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: bearer } });
      if (!userResponse.ok) return send(401, { error: 'login_required' });
      const user = await userResponse.json();
      if (!uuid(user.id) || !user.email_confirmed_at) return send(401, { error: 'login_required' });
      const body = JSON.parse(new TextDecoder().decode(await bounded(request, 12000)));
      const rpc = async (name, data, admin = false) => {
        const r = await call(`${base}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: admin ? service : key,
          ...(admin ? (service.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${service}` }) : { Authorization: bearer }), 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const value = await r.json(); if (!r.ok) fail(value.message || 'service_unavailable'); return value;
      };
      const storageHeaders = { apikey: service, ...(service.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${service}` }) };
      if (body.action === 'read') {
        const asset = await rpc('quiz_media_access', { p_url: body.url, p_attempt: body.attempt_id || null });
        if (env('QUIZ_IMAGE_BACKEND') === 'drive' && asset.backend !== 'supabase' && asset.mime?.startsWith('image/')) {
          if (asset.url !== body.url) fail('media_unavailable');
          return send(200, { url: await signDriveImage(asset, env) });
        }
        const signed = await call(`${base}/storage/v1/object/sign/${BUCKET}/${asset.object_path}`, { method: 'POST',
          headers: { ...storageHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }) });
        if (!signed.ok) fail('media_unavailable');
        const { signedURL } = await signed.json();
        if (typeof signedURL !== 'string' || !signedURL.startsWith('/object/sign/quiz-media/')) fail('media_unavailable');
        return send(200, { url: `${base}/storage/v1${signedURL}` });
      }
      if (body.action !== 'freeze' || !uuid(body.data?.bank_id) || !Number.isInteger(body.data?.expected_revision)) fail('invalid_action');
      const data = body.data;
      const bank = await rpc('quiz_action', { p_action: 'get', p_data: { bank_id: data.bank_id } });
      if (bank.revision !== data.expected_revision) fail('revision_changed');
      const versions = await rpc('quiz_action', { p_action: 'versions', p_data: { bank_id: bank.id } });
      const previous = versions.versions.find(v => v.revision === bank.revision);
      if (previous) return send(200, previous); // 回應遺失後重試，不重新下載已改變的來源。
      const document = structuredClone(bank.draft), assets = [], seen = new Map(); let total = 0;
      for (const media of mediaEntries(document)) {
        const sourceKey = `${media.kind}:${media.url}`;
        if (seen.has(sourceKey)) { media.url = seen.get(sourceKey); continue; }
        if (/^https:\/\/quiz-media\.invalid\//.test(media.url)) {
          const asset = await rpc('quiz_media_access', { p_url: media.url });
          if (!asset.mime.startsWith(`${media.kind}/`)) fail('media_invalid');
          assets.push(asset); seen.set(sourceKey, media.url); continue;
        }
        const url = new URL(media.url), hosts = (env('QUIZ_MEDIA_SOURCE_HOSTS') || '').split(',').filter(Boolean);
        // 僅允許明列的公開 HTTPS 主機；預設拒絕、不可用萬用字元、不可重新導向。
        if (url.protocol !== 'https:' || url.port || url.username || url.password || !hosts.includes(url.hostname)
          || url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) fail('media_source_denied');
        const response = await call(url.href);
        if (!response.ok || response.status >= 300) fail('media_unavailable');
        const bytes = await bounded(response, MAX); total += bytes.length;
        if (!bytes.length || total > TOTAL) fail('media_invalid');
        const mime = mediaType(bytes, media.kind);
        const advertised = response.headers.get('content-type')?.split(';')[0];
        if (advertised !== mime && !(mime === 'audio/wav' && advertised === 'audio/x-wav')) fail('media_invalid');
        const hash = await digest(bytes), path = `${user.id}/${hash}`;
        const stored = await call(`${base}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: {
          ...storageHeaders, 'Content-Type': mime, 'x-upsert': 'false' }, body: bytes });
        if (!stored.ok) {
          const detail = await stored.json().catch(() => ({}));
          if (stored.status !== 409 && detail.statusCode !== '409' && detail.error !== 'Duplicate') fail('media_unavailable');
          const existing = await call(`${base}/storage/v1/object/authenticated/${BUCKET}/${path}`, { headers: storageHeaders });
          if (!existing.ok || await digest(await bounded(existing, MAX)) !== hash) fail('media_invalid');
        }
        media.url = `https://quiz-media.invalid/${path}`;
        seen.set(sourceKey, media.url); assets.push({ url: media.url, object_path: path, mime, bytes: bytes.length });
      }
      return send(200, await rpc('quiz_freeze_publish', { p_uid: user.id, p_bank: bank.id, p_revision: bank.revision,
        p_original: bank.draft, p_document: document, p_assets: assets }, true));
    } catch (e) {
      const known = ['media_invalid','media_source_denied','media_unavailable','teacher_required','bank_unavailable','revision_changed','invalid_action','login_required','roster_required'];
      return send(400, { error: known.includes(e.message) ? e.message : 'service_unavailable' });
    }
  };
}
