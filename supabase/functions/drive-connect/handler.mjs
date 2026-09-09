const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EMAIL = 'th990821@mail.thps.ntpc.edu.tw';
const encoder = new TextEncoder();

class Failure extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
const fail = (status, code) => { throw new Failure(status, code); };
export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export async function digest(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
function random() { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
function validProof(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value); }

export async function encryptToken(token, keyText, associatedData) {
  const raw = Uint8Array.from(atob(keyText), (c) => c.charCodeAt(0));
  if (raw.length !== 32) fail(503, 'configuration_missing');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(associatedData) }, key, encoder.encode(token)
  );
  return { version: 1, iv: base64url(iv), ciphertext: base64url(new Uint8Array(ciphertext)) };
}

export function createHandler({ env, fetcher = fetch }) {
  const required = (name) => env(name) || fail(503, 'configuration_missing');
  function platformKey(legacy, dictionary) {
    if (env(legacy)) return env(legacy);
    const keys = JSON.parse(required(dictionary));
    return keys.default || Object.values(keys)[0] || fail(503, 'configuration_missing');
  }
  async function jsonFetch(url, options, errorCode = 'upstream_unavailable') {
    let response;
    try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(12000) }); }
    catch { fail(502, errorCode); }
    // Never log upstream bodies: they can contain credentials or authorization codes.
    if (!response.ok) fail(502, errorCode);
    if (response.status === 204) return null;
    try { return await response.json(); } catch { fail(502, errorCode); }
  }
  function config() {
    const callback = new URL(required('DRIVE_REDIRECT_URI'));
    if ((callback.protocol !== 'https:' && !(callback.protocol === 'http:' && callback.hostname === 'localhost'))
      || callback.pathname !== '/admin-drive.html' || callback.search || callback.hash) fail(503, 'configuration_missing');
    return {
      callback: callback.href, origin: callback.origin,
      url: required('SUPABASE_URL'), publicKey: platformKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS'),
      serviceKey: platformKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'),
    };
  }
  async function db(c, path, body, method = 'POST') {
    return jsonFetch(`${c.url}/rest/v1/${path}`, {
      method,
      headers: { apikey: c.serviceKey, ...(c.serviceKey.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${c.serviceKey}` }), 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, 'storage_unavailable');
  }
  async function teacher(c, request) {
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer \S+$/.test(authorization)) fail(401, 'login_required');
    const headers = { apikey: c.publicKey, Authorization: authorization };
    let user;
    try { user = await jsonFetch(`${c.url}/auth/v1/user`, { headers }, 'login_required'); }
    catch { fail(401, 'login_required'); }
    if (!user?.id || !user.email_confirmed_at) fail(401, 'login_required');
    const allowed = await jsonFetch(`${c.url}/rest/v1/rpc/is_teacher`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}',
    }, 'teacher_check_failed');
    if (allowed !== true) fail(403, 'teacher_required');
    return user;
  }
  return async (request) => {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' };
    const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    try {
      const c = config();
      if (request.headers.get('Origin') !== c.origin) fail(403, 'origin_not_allowed');
      headers['Access-Control-Allow-Origin'] = c.origin;
      if (request.method === 'OPTIONS') {
        headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type';
        return new Response(null, { status: 204, headers });
      }
      if (request.method !== 'POST') fail(405, 'method_not_allowed');
      const user = await teacher(c, request);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'json_required');
      const raw = await request.text();
      if (encoder.encode(raw).length > 8192) fail(413, 'request_too_large');
      let body;
      try { body = JSON.parse(raw); } catch { fail(400, 'invalid_request'); }
      if (!body || typeof body !== 'object') fail(400, 'invalid_request');

      if (body.action === 'status') {
        const rows = await db(c, `drive_connections?owner_user_id=eq.${encodeURIComponent(user.id)}&select=drive_email,connected_at`, undefined, 'GET');
        return respond({ connected: rows.length > 0, expectedEmail: EMAIL, connection: rows[0] || null });
      }
      if (body.action === 'start') {
        if (!validProof(body.proofChallenge)) fail(400, 'invalid_request');
        const clientId = required('DRIVE_CLIENT_ID');
        required('DRIVE_CLIENT_SECRET');
        // Check encryption configuration before asking the teacher to authorize.
        await encryptToken('configuration-check', required('DRIVE_TOKEN_KEY'), 'configuration-check');
        const state = random();
        await db(c, 'rpc/drive_begin_oauth', {
          p_user_id: user.id, p_state_hash: await digest(state), p_proof_hash: body.proofChallenge,
        });
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        Object.entries({ client_id: clientId, redirect_uri: c.callback, response_type: 'code',
          scope: `openid https://www.googleapis.com/auth/userinfo.email ${DRIVE_SCOPE}`,
          access_type: 'offline', prompt: 'consent select_account', login_hint: EMAIL,
          state, code_challenge: body.proofChallenge, code_challenge_method: 'S256',
        }).forEach(([key, value]) => url.searchParams.set(key, value));
        return respond({ authorizationUrl: url.href, state, expiresIn: 600 });
      }
      if (body.action !== 'complete') fail(400, 'invalid_action');
      if (!validProof(body.state) || !validProof(body.proof) || typeof body.code !== 'string' || !body.code || body.code.length > 4096) fail(400, 'invalid_request');
      const clientId = required('DRIVE_CLIENT_ID');
      const clientSecret = required('DRIVE_CLIENT_SECRET');
      const tokenKey = required('DRIVE_TOKEN_KEY');
      // Atomic DELETE ... RETURNING prevents replay, parallel completion, and cross-user claims.
      const claimed = await db(c, 'rpc/drive_claim_oauth', {
        p_user_id: user.id, p_state_hash: await digest(body.state), p_proof_hash: await digest(body.proof),
      });
      if (claimed !== true) fail(400, 'authorization_expired');
      const token = await jsonFetch(TOKEN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code: body.code,
          client_id: clientId, client_secret: clientSecret, redirect_uri: c.callback, code_verifier: body.proof }),
      }, 'google_authorization_failed');
      if (!token.access_token || !token.refresh_token) fail(400, 'offline_access_required');
      if (!(token.scope || '').split(' ').includes(DRIVE_SCOPE)) fail(400, 'drive_permission_required');
      const identity = await jsonFetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }, 'google_identity_failed');
      if (identity.email_verified !== true || identity.email?.toLowerCase() !== EMAIL || !identity.sub) fail(403, 'wrong_drive_account');
      // Confirm that offline access really works before replacing an existing connection.
      const refreshed = await jsonFetch(TOKEN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token,
          client_id: clientId, client_secret: clientSecret }),
      }, 'offline_access_failed');
      if (!refreshed.access_token) fail(400, 'offline_access_failed');
      const drive = await jsonFetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
        headers: { Authorization: `Bearer ${refreshed.access_token}` },
      }, 'drive_access_failed');
      if (drive.user?.emailAddress?.toLowerCase() !== EMAIL) fail(403, 'wrong_drive_account');
      const ciphertext = await encryptToken(token.refresh_token, tokenKey, `${user.id}:${EMAIL}`);
      await db(c, 'drive_connections?on_conflict=owner_user_id', {
        owner_user_id: user.id, drive_email: EMAIL, google_subject: identity.sub,
        token_envelope: ciphertext, scopes: token.scope.split(' '), connected_at: new Date().toISOString(),
      });
      return respond({ connected: true, expectedEmail: EMAIL });
    } catch (error) {
      return respond({ error: error instanceof Failure ? error.message : 'configuration_or_service_error' }, error instanceof Failure ? error.status : 503);
    }
  };
}
