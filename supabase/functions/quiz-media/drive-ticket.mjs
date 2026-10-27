// Only metadata crosses Supabase; the Worker owns the private Drive allowlist.
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
export async function signDriveImage(asset, env) {
  const origin = env('QUIZ_DRIVE_ORIGIN'), secret = env('QUIZ_DRIVE_TICKET_KEY');
  if (origin !== 'https://dingxi-quiz-drive-library.nblm-book-audio.workers.dev'
    || !/^[A-Za-z0-9_-]{43}$/.test(secret || '')) throw new Error('media_unavailable');
  const match = asset.url?.match(/^https:\/\/quiz-media\.invalid\/[0-9a-f-]{36}\/([a-f0-9]{64})$/);
  if (!match || !/^image\/(png|jpeg|webp|gif)$/.test(asset.mime)
    || !Number.isInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 8388608) throw new Error('media_unavailable');
  const payload = encode(new TextEncoder().encode(JSON.stringify({aud:'quiz-drive-media-library', hash:match[1],
    mime:asset.mime, bytes:asset.bytes, role:'material', exp:Math.floor(Date.now()/1000)+300})));
  const raw = Uint8Array.from(atob(secret.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const signature = encode(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))));
  return `${origin}/media/${match[1]}?ticket=${payload}.${signature}`;
}
