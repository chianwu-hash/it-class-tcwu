import { initNavbarAuth } from './navbar-auth.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getStoredAccessToken, isTeacher } from './auth.js';

const callback = window.__driveOAuthResult;
delete window.__driveOAuthResult;
const pendingKey = 'drive-oauth-pending-v1';
const connect = document.getElementById('connect-drive');
const refresh = document.getElementById('refresh-drive');
const status = document.getElementById('drive-status');
let session = null;
let busy = false;
let initializedUser = null;
let callbackHandled = false;

const messages = {
  login_required: '網站登入已失效，請重新登入後再連接 Drive。',
  teacher_required: '只有網站教師帳號可以連接收件 Drive。',
  origin_not_allowed: '目前網址尚未設定為授權入口，請使用已設定的正式網址。',
  configuration_missing: '收件後端尚未完成設定，請完成部署與憑證設定。',
  configuration_or_service_error: '收件後端尚未就緒，請稍後再試。',
  storage_unavailable: '連接紀錄暫時無法保存，請檢查後端資料表後重新授權。',
  authorization_expired: '授權已過期、已使用，或不是從這個瀏覽器發起。請重新連接。',
  wrong_drive_account: '授權帳號不符。請重新選擇 th990821@mail.thps.ntpc.edu.tw。',
  offline_access_required: '未取得背景收件授權，請重新連接並同意所需權限。',
  drive_permission_required: '尚未同意作業檔案權限，請重新連接。',
  google_authorization_failed: 'Google 授權未完成或已過期，請重新連接。',
  offline_access_failed: '背景存取驗證失敗，請重新連接。',
  drive_access_failed: '目前無法存取學校 Drive，請確認學校管理設定。',
};
function controls() {
  connect.disabled = refresh.disabled = busy || !isTeacher(session);
}
async function api(body) {
  const userId = session?.user?.id;
  const token = getStoredAccessToken() || session?.access_token;
  if (!isTeacher(session) || !token) throw new Error(messages.teacher_required);
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/drive-connect`, {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch { throw new Error('收件服務無法連線。若正在完成授權，請按「更新連接狀態」確認是否已保存。'); }
  const result = await response.json().catch(() => ({}));
  if (session?.user?.id !== userId) throw new Error('登入帳號已變更，請重新操作。');
  if (!response.ok) throw new Error(messages[result.error] || '收件服務尚未就緒，請確認部署後再試。');
  return result;
}
function b64(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
async function run(task) {
  if (busy) return;
  busy = true; controls();
  try { await task(); } catch (error) { status.textContent = error.message; }
  finally { busy = false; controls(); }
}
async function load() {
  status.textContent = '正在讀取連接紀錄…';
  const data = await api({ action: 'status' });
  status.textContent = data.connected
    ? `已保存 ${data.connection.drive_email} 的授權。最近連接：${new Date(data.connection.connected_at).toLocaleString('zh-TW')}。`
    : '尚未連接學校 Drive。';
}
connect.addEventListener('click', () => run(async () => {
  status.textContent = '準備前往 Google 授權…';
  const proof = b64(crypto.getRandomValues(new Uint8Array(32)));
  const proofChallenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(proof))));
  const result = await api({ action: 'start', proofChallenge });
  const target = new URL(result.authorizationUrl);
  if (target.origin !== 'https://accounts.google.com' || target.pathname !== '/o/oauth2/v2/auth'
    || target.searchParams.get('redirect_uri') !== `${location.origin}/admin-drive.html`) throw new Error('授權網址設定不符，請檢查後端設定。');
  // Temporary browser-bound OAuth proof only. No Google token or student progress is stored here.
  sessionStorage.setItem(pendingKey, JSON.stringify({ proof, state: result.state, userId: session.user.id, expiresAt: Date.now() + 600000 }));
  location.assign(target.href);
}));
refresh.addEventListener('click', () => run(load));

async function complete() {
  let pending;
  try { pending = JSON.parse(sessionStorage.getItem(pendingKey)); } catch { /* Invalid or unavailable browser state. */ }
  sessionStorage.removeItem(pendingKey);
  if (!pending || pending.state !== callback.state || pending.userId !== session.user.id || pending.expiresAt < Date.now()) {
    throw new Error(messages.authorization_expired);
  }
  if (callback.error) throw new Error('你已取消或未完成 Google 授權，可以重新連接。');
  status.textContent = '正在確認學校帳號與背景存取權…';
  await api({ action: 'complete', code: callback.code, state: callback.state, proof: pending.proof });
  status.textContent = '學校 Drive 已連接成功，背景存取已驗證。作業上傳區尚未開放。';
}

initNavbarAuth({ onSessionResolved: (nextSession) => {
  const previous = session?.user?.id;
  session = nextSession;
  controls();
  if (!isTeacher(session)) {
    initializedUser = null;
    status.textContent = session?.user ? messages.teacher_required : '請先登入網站教師帳號（chianwu@gmail.com）。';
    if (previous) sessionStorage.removeItem(pendingKey);
    return;
  }
  if (initializedUser === session.user.id) return;
  initializedUser = session.user.id;
  // Leave the synchronous auth event callback before performing network work.
  setTimeout(() => run(async () => {
    if (callback && !callbackHandled) { callbackHandled = true; await complete(); }
    else await load();
  }), 0);
} });
