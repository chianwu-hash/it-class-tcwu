// Classroom monitor for the quiz module. Read-only: Supabase Management Logs API + infra-monitoring,
// called from inside an already logged-in Supabase Dashboard tab (token never leaves the page).
// Never queries the database, so it adds no load during class.
// Run through the AI work browser lease guard:
//   node D:/ai-browser/run-background.cjs --lease-id <LeaseId> <this file> --start <ISO> --end <ISO> --out <dir> [--interval 180]
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2), value = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const start = new Date(value('--start')), end = new Date(value('--end')), out = path.resolve(value('--out'));
const interval = Number(value('--interval', '180')) * 1000, ref = value('--ref', 'upxgyusodibaqcrocdzj');
if (isNaN(start) || isNaN(end) || end <= start) throw Error('invalid --start/--end');
await fs.mkdir(out, { recursive: true });
const cdp = process.env.CDP_URL || process.env.AI_WORK_BROWSER_CDP_URL;
const log = (...a) => { const line = new Date().toLocaleTimeString('zh-TW', { hour12: false }) + ' ' + a.join(' '); console.log(line); return fs.appendFile(out + '/monitor.log', line + '\n'); };

async function pageTarget() {
  const list = await (await fetch(cdp + '/json/list')).json();
  const t = list.find(p => p.type === 'page' && p.url.startsWith('https://supabase.com/dashboard/project/' + ref));
  if (!t) throw Error('no Supabase dashboard tab for project ' + ref + ' in this browser');
  return t;
}
async function evaluate(expression) {
  const t = await pageTarget(), ws = new WebSocket(t.webSocketDebuggerUrl.replace('localhost', '127.0.0.1'));
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const res = await new Promise(r => { ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === 1) r(m); }; ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true, timeout: 90000 } })); });
  ws.close();
  if (res.result?.exceptionDetails) throw Error(res.result.exceptionDetails.exception?.description || 'page exception');
  return JSON.parse(res.result.result.value);
}
// In-page collector: per-minute API traffic, errors by source, host metrics for [from, to].
const collector = (from, to) => `(async () => {
  const ref = ${JSON.stringify(ref)}, from = ${JSON.stringify(from)}, to = ${JSON.stringify(to)};
  const token = JSON.parse(localStorage.getItem('supabase.dashboard.auth.token') || '{}').access_token;
  if (!token) return JSON.stringify({ error: 'dashboard_not_logged_in' });
  const H = { headers: { Authorization: 'Bearer ' + token } };
  const logs = async sql => { const r = await fetch('https://api.supabase.com/v1/projects/' + ref + '/analytics/endpoints/logs?sql=' + encodeURIComponent(sql) + '&iso_timestamp_start=' + from + '&iso_timestamp_end=' + to, H);
    const j = await r.json().catch(() => null); return r.ok ? (j?.result ?? j) : { status: r.status }; };
  const m = "formatDateTime(toTimeZone(timestamp,'Asia/Taipei'),'%H:%i')", st = "log_attributes['response.status_code']", ot = "toFloat64OrZero(log_attributes['response.origin_time'])";
  const out = {};
  out.api = await logs("SELECT " + m + " m, count() n, countIf(" + st + ">='500') e5, countIf(" + st + "='429') e429, round(quantile(0.5)(" + ot + ")) p50, round(quantile(0.95)(" + ot + ")) p95, round(max(" + ot + ")) mx, uniqExactIf(log_attributes['request.sb.jwt.authorization.payload.subject'], log_attributes['request.path'] LIKE '/rest/v1/rpc/quiz%') students FROM logs WHERE source='edge_logs' GROUP BY m ORDER BY m");
  out.slow_paths = await logs("SELECT replaceRegexpOne(log_attributes['request.path'], '^(/[a-z]+/v1/[^/?]+(/[^/?]+)?).*', '\\\\\\\\1') p, count() n, countIf(" + st + ">='500') e5, round(quantile(0.95)(" + ot + ")) p95, round(max(" + ot + ")) mx FROM logs WHERE source='edge_logs' GROUP BY p ORDER BY mx DESC LIMIT 8");
  out.pg_errors = await logs("SELECT " + m + " m, log_attributes['parsed.error_severity'] sev, log_attributes['parsed.sql_state_code'] code, log_attributes['parsed.user_name'] u, substring(event_message,1,120) msg FROM logs WHERE source='postgres_logs' AND log_attributes['parsed.error_severity'] IN ('ERROR','FATAL','PANIC') AND log_attributes['parsed.application_name']<>'mgmt-api' ORDER BY timestamp LIMIT 40");
  out.pgrst = await logs("SELECT countIf(event_message LIKE '%PGRST003%' OR event_message LIKE '%connection pool%') pool_timeouts, countIf(event_message LIKE '%statement timeout%') stmt_timeouts, countIf(event_message LIKE '%Thread killed%') thread_kills FROM logs WHERE source='postgrest_logs'");
  out.auth = await logs("SELECT countIf(log_attributes['level']='error') errors, countIf(toInt32OrZero(log_attributes['status'])>=500) e5, countIf(event_message LIKE '%5432%' OR event_message LIKE '%failed to connect%') db_connect_fail, countIf(log_attributes['path'] LIKE '%callback%') callbacks FROM logs WHERE source='auth_logs'");
  out.host = {};
  for (const a of ['avg_cpu_usage','max_cpu_usage','cpu_usage_busy_iowait','ram_usage_used','ram_usage_total','swap_usage','ram_usage_swap']) {
    const r = await fetch('https://api.supabase.com/platform/projects/' + ref + '/infra-monitoring?attribute=' + a + '&startDate=' + from + '&endDate=' + to + '&interval=1m', H);
    const j = await r.json().catch(() => null); out.host[a] = r.ok ? (j?.data || []).map(x => [new Date(x.period_start).toLocaleTimeString('zh-TW',{hour12:false,timeZone:'Asia/Taipei'}).slice(0,5), +x[a]]) : { status: r.status };
  }
  return JSON.stringify(out);
})()`;
const iso = d => d.toISOString().replace(/\.\d+Z$/, 'Z');
async function collect(from, to) {
  try { return await evaluate(collector(iso(from), iso(to))); }
  catch (e) { await log('collect failed:', e.message); return { error: e.message }; }
}
function alerts(s) {
  const a = [];
  for (const r of Array.isArray(s.api) ? s.api : []) { if (+r.e5 > 0) a.push(`${r.m} API 5xx=${r.e5}`); if (+r.p95 > 2000) a.push(`${r.m} API p95=${r.p95}ms`); }
  const p = Array.isArray(s.pgrst) ? s.pgrst[0] : null; if (p && (+p.pool_timeouts || +p.stmt_timeouts)) a.push(`PostgREST pool=${p.pool_timeouts} stmt=${p.stmt_timeouts}`);
  const au = Array.isArray(s.auth) ? s.auth[0] : null; if (au && (+au.db_connect_fail || +au.e5)) a.push(`Auth 5xx=${au.e5} db_connect_fail=${au.db_connect_fail}`);
  if (Array.isArray(s.pg_errors) && s.pg_errors.length) a.push(`Postgres errors=${s.pg_errors.length}`);
  const swap = s.host?.ram_usage_swap; if (Array.isArray(swap) && swap.some(x => x[1] > 50e6)) a.push(`swap max=${Math.round(Math.max(...swap.map(x => x[1])) / 1e6)}MB`);
  const cpu = s.host?.avg_cpu_usage; if (Array.isArray(cpu) && cpu.some(x => x[1] > 85)) a.push(`CPU max=${Math.round(Math.max(...cpu.map(x => x[1])))}%`);
  return a;
}
await log(`monitor ${iso(start)} → ${iso(end)} every ${interval / 1000}s`);
while (Date.now() < start.getTime()) await new Promise(r => setTimeout(r, Math.min(30000, start.getTime() - Date.now())));
let tick = 0;
while (Date.now() < end.getTime() + 60000) {
  const to = new Date(), from = new Date(Math.max(start.getTime(), to.getTime() - 6 * 60000));
  const s = await collect(from, to); tick++;
  await fs.appendFile(out + '/samples.jsonl', JSON.stringify({ at: to.toISOString(), ...s }) + '\n');
  const a = s.error ? ['collect error: ' + s.error] : alerts(s);
  const last = Array.isArray(s.api) ? s.api.at(-1) : null;
  await log(`#${tick}`, last ? `${last.m} req=${last.n} students=${last.students} p95=${last.p95}ms` : 'no api rows', a.length ? '⚠ ' + a.join(' | ') : 'OK');
  if (Date.now() >= end.getTime() + 60000) break;
  await new Promise(r => setTimeout(r, interval));
}
// Final full-window pull (logs may lag a minute or two).
await new Promise(r => setTimeout(r, 90000));
const full = await collect(new Date(start.getTime() - 5 * 60000), new Date(end.getTime() + 5 * 60000));
await fs.writeFile(out + '/report.json', JSON.stringify({ window: [iso(start), iso(end)], alerts: full.error ? [full.error] : alerts(full), ...full }, null, 1));
await log('final report written:', out + '/report.json', full.error ? 'ERROR ' + full.error : `alerts=${alerts(full).length}`);
