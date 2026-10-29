// Metadata only: never retain credentials, identities, URLs with queries, or answers.
export const DIAGNOSTICS_RELEASE = '20261029-load-batch3';
const enabled = typeof window !== 'undefined' && typeof document !== 'undefined';
const events = [], queue = [];
let sequence = 0, sending = false, timer, persistTimer;
function persist(){clearTimeout(persistTimer);persistTimer=null;try{sessionStorage.setItem(KEY,JSON.stringify({release:DIAGNOSTICS_RELEASE,tab,events}));}catch{}}
const KEY = 'connection-diagnostics-v1';
let tab = enabled ? crypto.randomUUID() : 'test';
if (enabled) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved?.release === DIAGNOSTICS_RELEASE && /^[a-f0-9-]{36}$/.test(saved.tab) && Array.isArray(saved.events)) {
      tab = saved.tab; events.push(...saved.events.slice(-250));
      sequence = Math.max(0, ...events.map(row => Number(row.seq) || 0));
    }
  } catch {}
}
const atom = value => typeof value === 'string' && /^[a-zA-Z0-9_.:/-]{1,100}$/.test(value) ? value : '';
function record(event) {
  if (!enabled) return;
  try {
    const row = { at: new Date().toISOString(), seq: ++sequence, ...event };
    events.push(row); queue.push(row);
    if (events.length > 300) events.shift();
    if (queue.length > 300) queue.shift();
    persistTimer??=setTimeout(persist,1000);
  } catch { /* Diagnostics must never affect an application operation. */ }
}
export function diagnoseStep(operation) {
  const started = performance.now(), id = ++sequence;
  record({ id, phase: 'start', operation: atom(operation) });
  return (code = 'ok') => record({ id, phase: 'end', operation: atom(operation), code: atom(code), ms: Math.round(performance.now() - started) });
}
export function diagnosticFetch(fetcher = globalThis.fetch) {
  return async (input, init) => {
    if (!enabled) return fetcher(input, init);
    let url;
    try { url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url); } catch { return fetcher(input, init); }
    if (url.origin !== 'https://upxgyusodibaqcrocdzj.supabase.co') return fetcher(input, init);
    const path = url.pathname;
    // Storage object names and signed media paths can contain private identifiers.
    const endpoint = /^\/rest\/v1\/rpc\/[a-z_]+$/.test(path) ? path :
      /^\/auth\/v1\/[a-z]+$/.test(path) ? path : path.startsWith('/functions/v1/') ? '/functions/v1' : '/rest-or-storage';
    let action = '';
    try { if (typeof init?.body === 'string') action = atom(JSON.parse(init.body).p_action || JSON.parse(init.body).action); } catch {}
    const id = ++sequence, started = performance.now();
    record({ id, phase: 'start', endpoint, action });
    try {
      const response = await fetcher(input, init);
      record({ id, phase: 'headers', endpoint, action, status: response.status,
        ms: Math.round(performance.now() - started), request: atom(response.headers?.get('sb-request-id') || response.headers?.get('x-request-id')),
        cf: atom(response.headers?.get('cf-ray')) });
      // Do not clone/read response bodies: quiz documents and answers stay out of telemetry.
      return response;
    } catch (error) {
      record({ id, phase: 'error', endpoint, action, ms: Math.round(performance.now() - started), code: atom(error?.name) || 'network_error' });
      throw error;
    }
  };
}
export function diagnoseResult(code) { record({ phase: 'result', code: atom(code) || 'service_error' }); }
export function exportDiagnostics() {
  return { release: DIAGNOSTICS_RELEASE, tab, page: location.pathname, events: [...events] };
}
export async function flushDiagnostics() {
  if (!enabled || sending || !queue.length || location.hostname !== 'it-class-tcwu.vercel.app') return;
  sending = true;
  const batch = queue.splice(0, 40);
  try {
    const response = await fetch('/api/quiz-diagnostics', { method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000), keepalive: true,
      body: JSON.stringify({ release: DIAGNOSTICS_RELEASE, tab, page: location.pathname, events: batch }) });
    if (!response.ok) throw Error('collector_unavailable');
  } catch { queue.unshift(...batch); queue.splice(300); }
  finally { sending = false; }
}
function addDownload() {
  if (!/\/(quiz(?:-library)?|index)\.html$/.test(location.pathname) && location.pathname !== '/') return;
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = '下載連線診斷'; button.id = 'connection-diagnostics-download';
  button.title = '發生連線問題時，下載診斷檔交給老師。';
  button.style.cssText = 'display:block;margin:16px auto;padding:8px 14px;border:1px solid #64748b;border-radius:8px;background:white;color:#334155;font:14px sans-serif;';
  button.onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportDiagnostics(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `連線診斷-${DIAGNOSTICS_RELEASE}-${tab.slice(0,8)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  document.body.append(button);
}
if (enabled) {
  record({ phase: 'page', code: navigator.onLine ? 'online' : 'offline' });
  window.addEventListener('online', () => record({ phase: 'network', code: 'online' }));
  window.addEventListener('offline', () => record({ phase: 'network', code: 'offline' }));
  document.addEventListener('visibilitychange', () => { record({ phase: 'visibility', code: document.visibilityState }); if (document.hidden) {persist();void flushDiagnostics();} });
  window.addEventListener('pagehide', () => { persist();void flushDiagnostics(); clearInterval(timer); });
  window.addEventListener('pageshow', () => { clearInterval(timer); timer = setInterval(flushDiagnostics, 30000); });
  timer = setInterval(flushDiagnostics, 30000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addDownload, { once: true }); else addDownload();
}
