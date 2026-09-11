const EMAIL = 'th990821@mail.thps.ntpc.edu.tw';
export const CHUNK_SIZE = 4 * 1024 * 1024;
const enc = new TextEncoder();
const allowed = new Set('mp4 webm mov pdf png jpg jpeg webp gif doc docx ppt pptx xls xlsx odt odp ods sb3 txt zip'.split(' '));
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
class Failure extends Error { constructor(code, status = 400) { super(code); this.status = status; } }
const fail = (code, status) => { throw new Failure(code, status); };
export function validateFile(name, size, max = 104857600) {
  if (typeof name !== 'string' || !name.trim() || name.length > 160 || /[\x00-\x1f\x7f/\\]/.test(name)
    || !allowed.has(name.split('.').pop().toLowerCase())) fail('file_type');
  if (!Number.isInteger(size) || size < 1 || size > max) fail('file_size');
}
export async function decryptToken(envelope, keyText, aad) {
  const decode = s => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  if (envelope?.version !== 1) fail('drive_required', 503);
  const key = await crypto.subtle.importKey('raw', decode(keyText), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv), additionalData: enc.encode(aad) }, key, decode(envelope.ciphertext)));
}
export function resumeOffset(response, total) {
  const range = response.headers.get('Range');
  if (!range) return 0;
  if (!/^bytes=0-\d+$/.test(range)) fail('drive_unavailable', 502);
  const offset = Number(range.split('-')[1]) + 1;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > total) fail('drive_unavailable', 502);
  return offset;
}
async function boundedBody(request) {
  if (Number(request.headers.get('Content-Length')) > CHUNK_SIZE + 16384) fail('file_size', 413);
  const reader = request.body?.getReader(); if (!reader) fail('invalid_request');
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > CHUNK_SIZE + 16384) { await reader.cancel(); fail('file_size', 413); }
    chunks.push(value);
  }
  return new Blob(chunks);
}
export function createHandler({ env, fetcher = fetch }) {
  const required = n => env(n) || fail('configuration_missing', 503);
  const platformKey = (old, dict) => env(old) || (() => { const k = JSON.parse(required(dict)); return k.default || Object.values(k)[0]; })();
  async function request(url, options = {}) {
    try { return await fetcher(url, { ...options, signal: AbortSignal.timeout(45000), redirect: 'manual' }); }
    catch { fail('service_unavailable', 502); }
  }
  async function json(url, options, code = 'service_unavailable') {
    const r = await request(url, options);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const safe = new Set(['login_required','teacher_required','roster_required','drive_required','assignment_unavailable','invalid_state','invalid_review','version_changed','upload_conflict','upload_limit','upload_unavailable','upload_expired','file_size']);
      fail(safe.has(data.message) ? data.message : code, code === 'login_required' ? 401 : 400);
    }
    return data;
  }
  return async req => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    const respond = (data, status = 200) => new Response(JSON.stringify(data), { headers, status });
    try {
      const origins = new Set([new URL(required('DRIVE_REDIRECT_URI')).origin, 'http://127.0.0.1:8126']);
      const origin = req.headers.get('Origin');
      if (!origins.has(origin)) fail('origin_not_allowed', 403);
      headers['Access-Control-Allow-Origin'] = origin;
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type' } });
      if (req.method !== 'POST') fail('invalid_request', 405);
      const url = required('SUPABASE_URL');
      const pub = platformKey('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS');
      const service = platformKey('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS');
      const authorization = req.headers.get('Authorization') || '';
      if (!/^Bearer \S+$/.test(authorization)) fail('login_required', 401);
      const userHeaders = { apikey: pub, Authorization: authorization, 'Content-Type': 'application/json' };
      const serviceHeaders = { apikey: service, ...(service.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${service}` }), 'Content-Type': 'application/json' };
      const user = await json(`${url}/auth/v1/user`, { headers: userHeaders }, 'login_required');
      if (!uuid(user.id) || !user.email_confirmed_at) fail('login_required', 401);
      const rpc = (action, data) => json(`${url}/rest/v1/rpc/homework_action`, { method: 'POST', headers: userHeaders, body: JSON.stringify({ p_action: action, p_data: data }) });
      const db = (path, body, method = 'POST') => json(`${url}/rest/v1/${path}`, {
        method, headers: { ...serviceHeaders, Prefer: 'return=representation' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }, 'storage_unavailable');
      const raw = await boundedBody(req);
      let body, chunk;
      if (req.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
        const form = await new Response(raw, { headers: { 'Content-Type': req.headers.get('Content-Type') } }).formData();
        body = { action: 'chunk', assignment_id: form.get('assignment_id'), id: form.get('id'), offset: Number(form.get('offset')) }; chunk = form.get('chunk');
      } else {
        if (!req.headers.get('Content-Type')?.startsWith('application/json') || raw.size > 8192) fail('invalid_request');
        try { body = JSON.parse(await raw.text()); } catch { fail('invalid_request'); }
      }
      if (!body || !uuid(body.assignment_id) || !['open','prepare','chunk','resume','preview'].includes(body.action)) fail('invalid_request');
      if (body.action === 'preview' && !uuid(body.upload_id)) fail('invalid_request');
      const assignment = body.action === 'preview'
        ? await json(`${url}/rest/v1/rpc/homework_review`, { method:'POST', headers:userHeaders, body:JSON.stringify({p_action:'media_context',p_data:{assignment_id:body.assignment_id,upload_id:body.upload_id}}) })
        : await rpc(body.action === 'open' ? 'context' : 'upload_context', { assignment_id: body.assignment_id });
      let access;
      async function token() {
        if (access) return access;
        const rows = await db(`drive_connections?owner_user_id=eq.${assignment.owner_user_id}&select=token_envelope,drive_email`, undefined, 'GET');
        if (!rows[0] || rows[0].drive_email !== EMAIL) fail('drive_required', 503);
        const refresh = await decryptToken(rows[0].token_envelope, required('DRIVE_TOKEN_KEY'), `${assignment.owner_user_id}:${EMAIL}`);
        const data = await json('https://oauth2.googleapis.com/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: required('DRIVE_CLIENT_ID'), client_secret: required('DRIVE_CLIENT_SECRET') }),
        }, 'drive_required');
        if (!data.access_token) fail('drive_required', 503);
        access = data.access_token; return access;
      }
      const drive = async (path, options = {}) => request(`https://www.googleapis.com/${path}`, {
        ...options, headers: { Authorization: `Bearer ${await token()}`, ...options.headers },
      });
      if (body.action === 'preview') {
        if (body.size !== undefined && body.size !== 'thumbnail') fail('invalid_request');
        if (body.size === 'thumbnail') {
          // Resolve the short-lived thumbnail only after media_context authorization.
          const meta = await drive(`drive/v3/files/${encodeURIComponent(assignment.drive_file_id)}?fields=thumbnailLink`);
          if (!meta.ok) fail('drive_unavailable', 502);
          let link = (await meta.json()).thumbnailLink;
          if (!link) fail('thumbnail_pending', 404);
          let response;
          for (let redirects = 0; redirects <= 3; redirects++) {
            const target = new URL(link);
            if (target.protocol !== 'https:' || target.username || target.password || target.port ||
                !(target.hostname === 'googleusercontent.com' || target.hostname.endsWith('.googleusercontent.com'))) fail('preview_unavailable');
            response = await request(target.href, { headers: { Authorization: `Bearer ${await token()}` } });
            if (![301,302,303,307,308].includes(response.status)) break;
            link = new URL(response.headers.get('Location') || '', target).href;
          }
          if (!response.ok) fail('thumbnail_pending', 404);
          const mime = response.headers.get('Content-Type')?.split(';')[0];
          if (!['image/png','image/jpeg','image/webp','image/gif'].includes(mime)) fail('preview_unavailable');
          // Bound thumbnail downloads; never fall back to downloading the original.
          const reader = response.body.getReader(), chunks = []; let bytes = 0;
          for (;;) { const {done,value} = await reader.read(); if (done) break; bytes += value.length;
            if (bytes > 2*1024*1024) { await reader.cancel(); fail('preview_unavailable'); } chunks.push(value); }
          return new Response(new Blob(chunks), {headers:{...headers,'Content-Type':mime,'X-Content-Type-Options':'nosniff'}});
        }
        const mime = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'}[assignment.file_name?.split('.').pop().toLowerCase()];
        if (!mime || assignment.file_size > 30*1024*1024) fail('preview_unavailable', 400);
        const r = await drive(`drive/v3/files/${encodeURIComponent(assignment.drive_file_id)}?alt=media`);
        if (!r.ok) fail('drive_unavailable',502);
        return new Response(r.body,{headers:{...headers,'Content-Type':mime,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Cache-Control':'no-store'}});
      }
      const newId = async () => {
        const r = await drive('drive/v3/files/generateIds?count=1&space=drive&type=files');
        if (!r.ok) fail('drive_unavailable', 502);
        const d = await r.json(); if (!/^[A-Za-z0-9_-]+$/.test(d.ids?.[0] || '')) fail('drive_unavailable', 502);
        return d.ids[0];
      };
      if (body.action === 'open') {
        let folder = assignment.drive_folder_id;
        if (!folder) {
          folder = await newId();
          const rows = await db(`homework_assignments?id=eq.${assignment.id}&drive_folder_id=is.null`, { drive_folder_id: folder }, 'PATCH');
          if (!rows.length) folder = (await rpc('context', { assignment_id: assignment.id })).drive_folder_id;
        }
        const r = await drive('drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: folder, name: `115上六年級_第${assignment.week_code}週_${assignment.title}`, mimeType: 'application/vnd.google-apps.folder', appProperties: { homeworkAssignment: assignment.id } }) });
        if (!r.ok && r.status !== 409) fail('drive_unavailable', 502);
        const check = await drive(`drive/v3/files/${folder}?fields=id,trashed,mimeType,appProperties`);
        const data = check.ok ? await check.json() : null;
        if (!data || data.trashed || data.mimeType !== 'application/vnd.google-apps.folder' || data.appProperties?.homeworkAssignment !== assignment.id) fail('drive_unavailable', 502);
        return respond(await rpc('set_state', { assignment_id: assignment.id, state: 'open' }));
      }
      if (!uuid(body.id)) fail('invalid_request');
      let u;
      if (body.action === 'prepare') {
        validateFile(body.file_name, body.file_size, assignment.max_file_bytes);
        if (!/^[a-f0-9]{64}$/.test(body.sha256 || '')) fail('invalid_request');
        u = await db('rpc/homework_reserve', { p_user: user.id, p_assignment: assignment.id, p_id: body.id,
          p_drive_id: await newId(), p_name: body.file_name, p_size: body.file_size, p_sha256: body.sha256 });
      } else {
        const rows = await db(`homework_uploads?id=eq.${body.id}&user_id=eq.${user.id}&assignment_id=eq.${assignment.id}`, undefined, 'GET');
        u = rows[0]; if (!u) fail('upload_unavailable', 403);
      }
      if (u.submitted_at) return respond({ done: true, offset: u.file_size });
      if (new Date(u.expires_at).getTime() <= Date.now()) fail('upload_expired');
      async function finish() {
        const checked = await drive(`drive/v3/files/${u.drive_file_id}?fields=id,size,trashed,parents,appProperties,sha256Checksum`);
        const data = checked.ok ? await checked.json() : null;
        if (!data || data.trashed || Number(data.size) !== u.file_size || !data.parents?.includes(assignment.drive_folder_id)
          || data.appProperties?.homeworkUpload !== u.id || data.sha256Checksum !== u.sha256) fail('drive_verify_failed', 502);
        await db('rpc/homework_finalize', { p_user: user.id, p_id: u.id });
        return respond({ done: true, offset: u.file_size });
      }
      if (!u.resume_uri) {
        const mime = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' }[u.file_name.split('.').pop().toLowerCase()] || 'application/octet-stream';
        const r = await drive('upload/drive/v3/files?uploadType=resumable&fields=id', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(u.file_size) },
          body: JSON.stringify({ id: u.drive_file_id, name: `${user.id.slice(0,8)}_${u.file_name}`, parents: [assignment.drive_folder_id], mimeType: mime, appProperties: { homeworkUpload: u.id } }),
        });
        if (r.status === 409) return await finish();
        if (!r.ok) fail('drive_unavailable', 502);
        const uri = r.headers.get('Location');
        if (!uri || new URL(uri).origin !== 'https://www.googleapis.com' || !new URL(uri).pathname.startsWith('/upload/drive/')) fail('drive_unavailable', 502);
        const rows = await db(`homework_uploads?id=eq.${u.id}&resume_uri=is.null`, { resume_uri: uri }, 'PATCH');
        u = rows[0] || (await db(`homework_uploads?id=eq.${u.id}`, undefined, 'GET'))[0];
      }
      // Treat the stored session URI as a secret scoped to this upload. It never
      // leaves the function, and is checked again to prevent arbitrary redirects.
      const uri = new URL(u.resume_uri);
      if (uri.origin !== 'https://www.googleapis.com' || !uri.pathname.startsWith('/upload/drive/')) fail('drive_unavailable', 502);
      const put = (range, payload = undefined) => request(uri.href, { method: 'PUT', headers: { 'Content-Range': range, 'Content-Type': 'application/octet-stream' }, body: payload });
      const status = await put(`bytes */${u.file_size}`);
      if (status.ok) return await finish();
      if (status.status !== 308) {
        // A lost final response may be followed by an expired session: check file
        // before allowing the user to start a new attempt.
        if (status.status === 404 || status.status === 410) return await finish();
        fail('drive_unavailable', 502);
      }
      const offset = resumeOffset(status, u.file_size);
      if (body.action !== 'chunk') return respond({ done: false, offset });
      if (!chunk || typeof chunk.arrayBuffer !== 'function' || !Number.isInteger(body.offset)) fail('invalid_request');
      // If the previous request succeeded but its response was lost, tell the
      // client the authoritative offset instead of sending the same bytes twice.
      if (body.offset !== offset) return respond({ done: false, offset });
      const end = Math.min(offset + CHUNK_SIZE, u.file_size);
      if (chunk.size !== end - offset || chunk.size <= 0) fail('invalid_chunk');
      const uploaded = await put(`bytes ${offset}-${end-1}/${u.file_size}`, chunk);
      if (uploaded.ok) return await finish();
      if (uploaded.status !== 308) fail('drive_unavailable', 502);
      return respond({ done: false, offset: resumeOffset(uploaded, u.file_size) });
    } catch (error) {
      return respond({ error: error instanceof Failure ? error.message : 'service_unavailable' }, error instanceof Failure ? error.status : 503);
    }
  };
}
