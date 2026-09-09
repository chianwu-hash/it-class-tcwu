import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, base64url, digest, encryptToken } from '../../supabase/functions/drive-connect/handler.mjs';

const origin = 'https://it-class-tcwu.vercel.app';
const school = 'th990821@mail.thps.ntpc.edu.tw';
const scope = 'https://www.googleapis.com/auth/drive.file';
const proof = base64url(new Uint8Array(32).fill(9));
const key = Buffer.alloc(32, 5).toString('base64');
function fixture(overrides = {}) {
  const config = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test-public',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service', DRIVE_REDIRECT_URI: `${origin}/admin-drive.html`,
    DRIVE_CLIENT_ID: 'test-client', DRIVE_CLIENT_SECRET: 'test-secret', DRIVE_TOKEN_KEY: key, ...overrides.env };
  const state = { pending: null, connection: null, calls: [], user: 'teacher-one', ...overrides };
  const fetcher = async (url, options = {}) => {
    state.calls.push({ url, options });
    const reply = (value, status = 200) => new Response(JSON.stringify(value), { status });
    if (url.endsWith('/auth/v1/user')) return reply({ id: state.user, email_confirmed_at: '2026-01-01' }, state.invalidJwt ? 401 : 200);
    if (url.endsWith('/rpc/is_teacher')) return reply(!state.student);
    if (url.includes('/rest/v1/')) {
      assert.equal(options.headers.apikey, config.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_test');
      if (options.headers.apikey.startsWith('sb_secret_')) assert.equal(options.headers.Authorization, undefined);
      const data = options.body && JSON.parse(options.body);
      if (url.endsWith('/rpc/drive_begin_oauth')) { state.pending = data; return reply(null); }
      if (url.endsWith('/rpc/drive_claim_oauth')) {
        const ok = !state.expired && state.pending && Object.keys(data).every(k => state.pending[k] === data[k]);
        if (ok) state.pending = null;
        return reply(!!ok);
      }
      if (options.method === 'GET') return reply(state.connection ? [{ drive_email: school, connected_at: '2026-09-09' }] : []);
      if (state.storageFailure) return reply({ message: 'secret-upstream-detail' }, 500);
      state.connection = data; return reply([data]);
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      if (options.body.get('grant_type') === 'refresh_token') {
        assert.equal(options.body.get('refresh_token'), 'secret-refresh');
        return reply({ access_token: 'refreshed-access' }, state.refreshFailure ? 400 : 200);
      }
      assert.equal(options.body.get('code_verifier'), proof);
      assert.equal(options.body.get('redirect_uri'), `${origin}/admin-drive.html`);
      return reply({ access_token: 'secret-access', refresh_token: state.noRefresh ? undefined : 'secret-refresh', scope: state.noScope ? 'openid' : `openid ${scope}` });
    }
    if (url.includes('openidconnect.googleapis.com')) return reply({ email: state.wrongAccount ? 'other@gmail.com' : school, email_verified: !state.unverified, sub: 'school-subject' });
    if (url.includes('/drive/v3/about')) return reply({ user: { emailAddress: state.wrongDrive ? 'other@gmail.com' : school } });
    throw new Error(`Unexpected URL ${url}`);
  };
  const handler = createHandler({ env: name => config[name], fetcher });
  const request = (body, options = {}) => handler(new Request('https://example.supabase.co/functions/v1/drive-connect', {
    method: 'POST', headers: { Origin: origin, Authorization: 'Bearer test-user', 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body), ...options,
  }));
  async function start() {
    const response = await request({ action: 'start', proofChallenge: await digest(proof) });
    assert.equal(response.status, 200); return response.json();
  }
  async function complete(started) { return request({ action: 'complete', state: started.state, proof, code: 'one-time-code' }); }
  return { state, handler, request, start, complete };
}

test('rejects unapproved origins before making any upstream call', async () => {
  const f = fixture(); const result = await f.request({ action: 'status' }, { headers: { Origin: 'https://evil.example' } });
  assert.equal(result.status, 403); assert.equal(f.state.calls.length, 0);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
});
test('preflight allowed, GET rejected; neither touches credentials', async () => {
  const f = fixture();
  assert.equal((await f.handler(new Request('https://example.test', { method: 'OPTIONS', headers: { Origin: origin } }))).status, 204);
  assert.equal((await f.handler(new Request('https://example.test', { headers: { Origin: origin } }))).status, 405);
  assert.equal(f.state.calls.length, 0);
});
for (const [label, options, status] of [['invalid session', { invalidJwt: true }, 401], ['student', { student: true }, 403]]) {
  test(`rejects ${label} before service-role access`, async () => {
    const f = fixture(options); assert.equal((await f.request({ action: 'status' })).status, status);
    assert.equal(f.state.calls.some(c => c.url.includes('/drive_connections')), false);
  });
}
test('start binds user, hash, PKCE, fixed account and fixed callback; hides client secret', async () => {
  const f = fixture(); const started = await f.start(); const url = new URL(started.authorizationUrl);
  assert.equal(url.searchParams.get('code_challenge'), await digest(proof));
  assert.equal(url.searchParams.get('login_hint'), school);
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('redirect_uri'), `${origin}/admin-drive.html`);
  assert.equal(f.state.pending.p_user_id, 'teacher-one');
  assert.equal(f.state.pending.p_state_hash, await digest(started.state));
  assert.ok(!JSON.stringify(started).includes('test-secret'));
});
test('missing encryption key prevents issuing OAuth authorization', async () => {
  const f = fixture({ env: { DRIVE_TOKEN_KEY: '' } });
  assert.equal((await f.request({ action: 'start', proofChallenge: await digest(proof) })).status, 503);
  assert.equal(f.state.pending, null);
});
for (const which of ['state', 'proof', 'user', 'expiry']) {
  test(`rejects mismatched ${which} without exchanging code`, async () => {
    const f = fixture(); const started = await f.start();
    if (which === 'user') f.state.user = 'other-teacher';
    if (which === 'expiry') f.state.expired = true;
    const r = await f.request({ action: 'complete', code: 'code', state: which === 'state' ? base64url(new Uint8Array(32)) : started.state,
      proof: which === 'proof' ? base64url(new Uint8Array(32)) : proof });
    assert.equal(r.status, 400);
    assert.equal(f.state.calls.some(c => c.url === 'https://oauth2.googleapis.com/token'), false);
  });
}
test('successful completion verifies offline Drive access and persists only encrypted refresh token', async () => {
  const f = fixture(); const started = await f.start(); const response = await f.complete(started);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { connected: true, expectedEmail: school });
  assert.equal(f.state.connection.drive_email, school);
  assert.ok(!JSON.stringify(f.state.connection).includes('secret-refresh'));
  const envelope = f.state.connection.token_envelope;
  const aes = await crypto.subtle.importKey('raw', Buffer.from(key, 'base64'), 'AES-GCM', false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(envelope.iv, 'base64url'), additionalData: new TextEncoder().encode(`teacher-one:${school}`) }, aes, Buffer.from(envelope.ciphertext, 'base64url'));
  assert.equal(new TextDecoder().decode(clear), 'secret-refresh');
  assert.equal((await f.complete(started)).status, 400);
});
for (const flag of ['wrongAccount', 'unverified', 'wrongDrive', 'noRefresh', 'noScope', 'refreshFailure', 'storageFailure']) {
  test(`${flag} never reports success or overwrites the existing connection`, async () => {
    const existing = { marker: 'previous-good-connection' }; const f = fixture({ [flag]: true, connection: existing });
    const started = await f.start(); const response = await f.complete(started);
    assert.ok(response.status >= 400); assert.equal(f.state.connection, existing);
    const body = await response.text(); assert.ok(!body.includes('secret-')); assert.ok(!body.includes('test-secret'));
  });
}
test('parallel completion only exchanges the authorization code once', async () => {
  const f = fixture(); const started = await f.start();
  const results = await Promise.all([f.complete(started), f.complete(started)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
});
test('status exposes metadata only', async () => {
  const f = fixture({ connection: { token_envelope: 'private' } });
  const response = await f.request({ action: 'status' }); const result = await response.text();
  assert.ok(!result.includes('private')); assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('supports current platform key dictionaries without treating secret key as a JWT', async () => {
  const f = fixture({ env: { SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_test' }),
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }) } });
  assert.equal((await f.request({ action: 'status' })).status, 200);
});
test('encryption is randomized and binds ciphertext to its owner', async () => {
  const a = await encryptToken('private', key, 'owner-one'); const b = await encryptToken('private', key, 'owner-one');
  assert.notEqual(a.iv, b.iv); assert.notEqual(a.ciphertext, b.ciphertext);
  const aes = await crypto.subtle.importKey('raw', Buffer.from(key, 'base64'), 'AES-GCM', false, ['decrypt']);
  await assert.rejects(crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(a.iv, 'base64url'), additionalData: new TextEncoder().encode('owner-two') }, aes, Buffer.from(a.ciphertext, 'base64url')));
});
