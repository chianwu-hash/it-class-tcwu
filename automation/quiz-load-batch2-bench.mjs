// Batch 2 release gate: same batch-1 baseline in both arms; history, wrong detail and version reads.
// Runtime: npm install --prefix <ignored-runtime> embedded-postgres@17.6.0-beta.15 pg
// Baseline is an explicit, preserved pre-change supabase/ directory; licensed pools stay local.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID, randomBytes, createHmac, timingSafeEqual,createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { mergeQuizSnapshot } from '../shared/quiz-state.mjs';

const args = process.argv.slice(2), value = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const baseline = value('--baseline-dir');
const model = value('--model', 'actual');
if (!['actual', 'parallel-stress'].includes(model)) throw Error('invalid_model');
if (!baseline) throw Error('--baseline-dir required');
const output = path.resolve(value('--output', 'automation/output/quiz/performance-' + Date.now()));
await fs.mkdir(output, { recursive: true });
const runtime = createRequire(path.resolve(value('--runtime', 'tmp/quiz-bench-runtime/package.json')));
const { default: EmbeddedPostgres } = await import(pathToFileURL(runtime.resolve('embedded-postgres')).href);
const { Pool, Client } = runtime('pg');
const teacher = '00000000-0000-4000-8000-000000000001';
const student = i => `00000000-0000-4000-8001-${String(i).padStart(12, '0')}`;
const fixed = (kind, i) => `${String(kind).padStart(8, '0')}-0000-4000-8000-${String(i).padStart(12, '0')}`;
const password = randomBytes(24).toString('hex'), secret = randomBytes(32), records = [], results = [], checks = [], snapshots = new Map();
const port = Number(value('--pg-port', '55438')), pools = {};
const log = text => fs.appendFile(output + '/postgres.log', String(text) + '\n');
const pg = new EmbeddedPostgres({ databaseDir: output + '/pgdata', user: 'postgres', password, port, persistent: true,
  postgresFlags: ['-h', '127.0.0.1', '-c', 'max_connections=60', '-c', 'shared_buffers=64MB', '-c', 'shared_preload_libraries=pg_stat_statements', '-c', 'pg_stat_statements.track=all', '-c', 'track_io_timing=on'],
  initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: log, onError: log });
const connection = database => ({ host: '127.0.0.1', port, user: 'postgres', password, database });
let admin, server;
async function hostMetrics() {
  const script = "$cpu=Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter \"Name='_Total'\";$disk=Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter \"Name='_Total'\";$mem=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory;[pscustomobject]@{cpu_percent=$cpu.PercentProcessorTime;disk_queue=$disk.AvgDiskQueueLength;disk_bytes_sec=$disk.DiskBytesPersec;available_mb=$mem.AvailableMBytes}|ConvertTo-Json -Compress";
  const { stdout } = await promisify(execFile)('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 20000 });
  return JSON.parse(stdout.trim());
}
const sign = data => { const body = Buffer.from(JSON.stringify(data)).toString('base64url'); return body + '.' + createHmac('sha256', secret).update(body).digest('base64url'); };
function verify(token) {
  const [body, signature = ''] = String(token).split('.');
  const expected = createHmac('sha256', secret).update(body || '').digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw Error('login_required');
  return JSON.parse(Buffer.from(body, 'base64url').toString());
}
async function rpc(db, user, action, data = {}, role = 'authenticated') {
  const started = performance.now(), client = await pools[db].connect(), acquired = performance.now();
  try {
    await client.query('begin');
    await client.query("select set_config('quiz.test_uid',$1,true),set_config('statement_timeout','8000',true),set_config('lock_timeout','8000',true)", [user || '']);
    await client.query(role === 'anon' ? 'set local role anon' : 'set local role authenticated');
    await client.query('select setseed($1)', [Number(data.__seed || 0.42)]);
    const specialized = { ...(db==='optimized'?{library_sessions:'quiz_library_sessions',version_list:'quiz_version_browser',version_get:'quiz_version_browser'}:{}),wrong_detail:'quiz_wrong_questions',media_read:'quiz_media_access',entry_context:'quiz_entry_context',pool_catalog: 'quiz_pool_catalog', compose: 'quiz_compose', wrong_questions: 'quiz_wrong_questions', rewards: 'quiz_rewards' }[action];
    const query = specialized ? `select public.${specialized}(${action === 'pool_catalog' ? '' : action==='media_read'?'$1,$2':'$1'}) result` : 'select public.quiz_action($1,$2) result';
    const payload=Object.fromEntries(Object.entries(data).filter(([k]) => k !== '__seed'));
    const params = specialized ? action === 'pool_catalog' ? [] : action==='media_read'?[data.url,data.attempt_id]:[JSON.stringify(action==='version_list'||action==='version_get'?{...payload,action:action==='version_get'?'get':'list'}:payload)] : [action==='version_list'?'versions':action, JSON.stringify(data)];
    const result = (await client.query(query, params)).rows[0].result;
    await client.query('commit');
    return { result, queue_ms: acquired - started, db_ms: performance.now() - acquired };
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
async function seed(db, source) {
  const c = await pools[db].connect();
  try {
    await c.query(`create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('quiz.test_uid',true),'')::uuid$$;
      create function public.is_teacher() returns boolean language sql as $$select auth.uid()='${teacher}'::uuid$$;
      create table public.student_enrollments(school_year smallint,email text,class_code text,seat_no smallint,display_name text);
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const [id, email] of [[teacher, 'teacher@example.invalid'], ...Array.from({ length: 35 }, (_, i) => [student(i + 1), `student${i + 1}@example.invalid`])])
      await c.query('insert into auth.users values($1,$2,now())', [id, email]);
    await c.query("insert into public.student_enrollments select 115,email,case when email='student35@example.invalid' then '603' else '304' end,row_number()over(),email from auth.users where email like 'student%' and email<>'student34@example.invalid'");
    for (const file of ['quiz.sql','quiz-media.sql', 'quiz-wrong-questions.sql', 'quiz-pool.sql', 'quiz-rewards.sql','quiz-load-batch1.sql']) await c.query(await fs.readFile(path.join(source, file), 'utf8'));
    if(value('--deployed-functions')){
      const definitions=JSON.parse(await fs.readFile(value('--deployed-functions'),'utf8')).functions;
      for(const f of definitions.filter(f=>f.proname.startsWith('quiz_')))await c.query(f.definition);
    }
    if(db==='optimized')await c.query(await fs.readFile('supabase/quiz-load-batch2.sql','utf8'));
    await c.query('create extension pg_stat_statements');
    const math = JSON.parse(await fs.readFile('automation/output/quiz/hanlin-g3-math-pool/pool.json', 'utf8'));
    const other = JSON.parse(await fs.readFile('automation/output/quiz/all-subjects-pool/pool.json', 'utf8'));
    const courses = JSON.parse(await fs.readFile('automation/output/quiz/all-subjects-pool/courses.json', 'utf8'));
    for (const course of courses) await c.query('insert into public.quiz_courses values($1,$2,$3,true) on conflict(id) do nothing', [course.id, course.grade, course.definition]);
    const rows = [...math, ...other].map(r => ({ ...r, unit_ids: r.unit_ids, usable: true }));
    await c.query('insert into public.quiz_question_pool select question_id,source_item_id,group_key,unit_ids,knowledge_code,knowledge_name,difficulty,source_version,publisher_explanation,question,checks,true from jsonb_populate_recordset(null::public.quiz_question_pool,$1)', [JSON.stringify(rows)]);
    for (const course of courses) await c.query('insert into public.quiz_pool_membership select question_id,$1,true from public.quiz_question_pool where question_id=any($2::text[])', [course.id, other.filter(r => r.course_id === course.id).map(r => r.question_id)]);
    const questions = math.filter(r => r.unit_ids.includes(1)).slice(0, 10).map(r => r.question);
    const document = { schema: 1, title: '合成班級測試卷', catalog: { school_year: '115', volume: '3年級上學期', subject: '數學', publisher: '翰林', unit: '第一單元' }, blocks: questions.map((q, i) => ({ id: 'b' + i, material: { text: '', runs: [], media: [] }, questions: [q] })) };
    // Guarantee image questions in the preset; use distinct explanation URLs to test disclosure.
    for(const [i,q] of questions.entries())for(const [part,offset] of [['prompt',1],['explanation',101]])q[part].media=[...(q[part].media||[]),{kind:'image',url:`https://quiz-media.invalid/${teacher}/${String(i+offset).padStart(64,'0')}`,alt:'合成驗權圖'}];
    const mediaUrls=[...new Set([...JSON.stringify(document).matchAll(/https:\/\/quiz-media\.invalid\/[a-f0-9-]+\/[a-f0-9]+/g),...JSON.stringify(rows).matchAll(/https:\/\/quiz-media\.invalid\/[a-f0-9-]+\/[a-f0-9]+/g)].map(m=>m[0]))];
    for(const [i,url] of mediaUrls.entries())await c.query('insert into public.quiz_media_assets values($1,$2,$3,$4,1)',[url,teacher,'fixture-'+i,'image/png']);
    // Real content shape and pool; all users, papers, historical answers and auth tokens are synthetic.
    for (let i = 1; i <= 220; i++) {
      const self = i > 40, owner = self ? student(1 + ((i - 41) % 30)) : teacher;
      await c.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)', [fixed(1, i), owner, document]);
      await c.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)', [fixed(2, i), fixed(1, i), document]);
      await c.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,access_mode,shuffle_questions,shuffle_options) values($1,$2,$3,115,'[\"304\"]','immediate',$4,true,true)", [fixed(3, i), owner, fixed(2, i), self ? 'self' : 'practice']);
      if (self) await c.query("insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution) values($1,$2,$3,'{\"kind\":\"self\",\"count\":10,\"units\":[1]}','{\"actual\":10,\"easy\":2,\"medium\":6,\"hard\":2}')", [fixed(3, i), owner, fixed(4, i)]);
      if(self){
        await c.query('insert into public.quiz_attempts(id,session_id,user_id,question_order,option_orders) values($1,$2,$3,$4,$5)',[fixed(5,i),fixed(3,i),owner,JSON.stringify(questions.map(q=>q.id)),JSON.stringify(Object.fromEntries(questions.map(q=>[q.id,q.options.map(o=>o.id)])))]);
        for(const [n,q] of questions.entries())await c.query('insert into public.quiz_answers(attempt_id,question_id,request_id,response,correct,created_at) values($1,$2,$3,$4,$5,$6)',[fixed(5,i),q.id,fixed(6,i*10+n),JSON.stringify(n<6?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id),n<6,new Date(Date.UTC(2026,9,1,0,i,n)).toISOString()]);
      }
    }
    for(let revision=2;revision<=31;revision++)await c.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,$3,$4)',[fixed(8,revision),fixed(1,1),revision,{...document,title:'歷史版本'+revision}]);
    await c.query('update public.quiz_integrity_settings set enabled=true');
    await c.query('analyze');
    return { pool: rows.length, presets: 40, historicalSelfPapers: 180, questions, document };
  } finally { c.release(); }
}
const quantile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]?.toFixed(3); };
function summarize(list) {
  return { requests: list.length, errors: list.filter(r => r.error).length, bytes: list.reduce((s, r) => s + r.bytes, 0),
    ...Object.fromEntries(['http_ms', 'db_ms', 'queue_ms'].map(key => [key, Object.fromEntries([['p50', .5], ['p95', .95], ['max', 1]].map(([name, p]) => [name, quantile(list.map(r => r[key] || 0), p)]))])) };
}
async function run(db, round, count) {
  let phase = `${round}-${db}`, tokens = [], made = [], states = [], last = [], measured = false;
  const call = async (i, action, data = {}) => {
    const start = performance.now();
    const response = await fetch(origin + '/rpc', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tokens[i] }, body: JSON.stringify({ action, data }) });
    const bytes = await response.text(), result = JSON.parse(bytes);
    if (measured) records.push({ db, round, count, action, http_ms: performance.now() - start, db_ms: Number(response.headers.get('x-db-ms')), queue_ms: Number(response.headers.get('x-queue-ms')), bytes: Buffer.byteLength(bytes), error: result.error || result.warning });
    assert.ok(response.ok && !result.warning, `${phase} ${action}: ${result.error || result.warning}`);
    return result;
  };
  // Warm the *complete HTTP/pool/library/catalog path* before EACH arm. One initial
  // serial DB warmup is not equivalent when alternating two DBs and cold HTTP sockets.
  await Promise.all(Array.from({ length: count }, async (_, i) => {
    tokens[i] = sign({ db, user: student(i + 1) });
    await call(i, 'library_sessions'); await call(i, 'pool_catalog');
  }));
  const host_before = await hostMetrics(); measured = true;
  const walBefore = (await pools[db].query('select pg_current_wal_insert_lsn() lsn')).rows[0].lsn;
  const wall = performance.now();
  await Promise.all(Array.from({ length: count }, async (_, i) => {
    const response = await fetch(origin + '/synthetic-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ db, number: i + 1 }) });
    tokens[i] = (await response.json()).token;
    // Same application qualification/library/catalog calls after an externally verified login.
    const library=await call(i,'library_sessions');
    if(i%2){const catalog=await call(i,'pool_catalog');assert.equal(catalog.available,true);}
    assert.equal(library.role, 'student'); assert.equal(library.grade, 3);
    made[i] = i % 2 ? (await call(i, 'compose', { kind: 'self', course_id: '115-1-hanlin-g3-math', count: 10, units: [1, 2, 3, 4], request_id: fixed(9 + round, i), __seed: .01 * (i + 1) })).session_id : fixed(3, round);
    const entry=await call(i,'entry_context',{session_id:made[i]});assert.equal(entry.grade,3);
    states[i] = await call(i, 'join', { session_id: made[i] });
    const first=states[i].document.questions[0];
    await Promise.all((first.prompt.media||[]).map(m=>call(i,'media_read',{url:m.url,attempt_id:states[i].attempt_id})));
    assert.doesNotMatch(JSON.stringify(states[i]), /"option_id"|"explanation"/);
  }));
  for (let qindex = 0; qindex < 10; qindex++) {
    await Promise.all(states.map(async (state, i) => {
      const q = state.document.questions[qindex], args = { session_id: made[i], question_id: q.id };
      await call(i, 'view_question', args);
      await delay(2100); // Real elapsed time. Do not bypass the server's two-second anti-cheat check.
      const definition = (await pools[db].query('select question from public.quiz_question_pool where question_id=$1', [q.id])).rows[0].question;
      const right = definition.answer.option_id;
      const response = qindex < 6 ? right : q.options.find(o => o.id !== right).id;
      last[i] = { ...args, request_id: fixed(20 + round, i * 10 + qindex), response, compact:true };
      const [next]=await Promise.all([call(i,'submit',last[i]),...(q.prompt.media||[]).map(m=>call(i,'media_read',{url:m.url,attempt_id:state.attempt_id}))]);
      states[i] = mergeQuizSnapshot(state, next);
      assert.equal(Object.keys(states[i].responses).length, qindex + 1);
    }));
  }
  await Promise.all(states.map(async (state, i) => {
    assert.equal(state.complete, true); assert.equal(state.reviews.length, 10); assert.equal(state.reviews.filter(r => r.correct).length, 6);
    // Whole-paper review: all visible prompt/option/explanation URLs, bounded three at a time.
    const urls=[...new Set([...JSON.stringify(state).matchAll(/https:\/\/quiz-media\.invalid\/[a-f0-9-]+\/[a-f0-9]+/g)].map(m=>m[0]))];
    for(let offset=0;offset<urls.length;offset+=3)await Promise.all(urls.slice(offset,offset+3).map(url=>call(i,'media_read',{url,attempt_id:state.attempt_id})));
    const resumed = await call(i, 'resume', { session_id: made[i] });
    assert.deepEqual(resumed.document, state.document); assert.deepEqual(resumed.responses, state.responses); assert.deepEqual(resumed.reviews, state.reviews);
    const repeated = await call(i, 'submit', last[i]); assert.equal(repeated.leaf.earned_now, false);
    const wrong = await call(i, 'wrong_questions'); assert.ok(wrong.total >= 4);
    for(const page of [0,1]){
      const list=await call(i,'wrong_questions',{page});
      if(list.items.length){const item=list.items[0],detail=await call(i,'wrong_detail',{action:'detail',attempt_id:item.attempt_id,question_id:item.question_id});assert.equal(detail.review.correct,false);assert.equal(detail.question.id,item.question_id);}
    }
    const library = await call(i, 'library_sessions'); assert.equal(Number(library.sessions.find(s => s.id === made[i]).answered), 10);
  }));
  const comparable = states.map(s => ({ document: s.document, responses: s.responses, reviews: s.reviews, complete: s.complete }));
  if (snapshots.has(round)) assert.deepEqual(comparable, snapshots.get(round), 'A/B question order, content, names, responses or reviews differ');
  else snapshots.set(round, comparable);
  const wal = (await pools[db].query('select pg_wal_lsn_diff(pg_current_wal_insert_lsn(),$1)::bigint bytes', [walBefore])).rows[0].bytes;
  const wall_ms = +(performance.now() - wall).toFixed(2), host_after = await hostMetrics();
  const summary = { db, round, count, wall_ms, wal_bytes: Number(wal), host_before, host_after, ...summarize(records.filter(r => r.db === db && r.round === round)) };
  results.push(summary);
  await fs.writeFile(output + '/progress.json', JSON.stringify({ completed: results, latest: summary }, null, 2));
  console.log(JSON.stringify(summary));
}
async function concurrencyChecks(db) {
  const sid = fixed(3, 39), uid = student(31), other = student(32), data = { session_id: sid };
  await Promise.all([rpc(db, uid, 'join', data), rpc(db, uid, 'join', data), rpc(db, other, 'join', data)]);
  assert.equal((await pools[db].query('select count(*)::int n from public.quiz_attempts where session_id=$1 and user_id=$2', [sid, uid])).rows[0].n, 1);
  const state = (await rpc(db, uid, 'resume', data)).result, q = state.document.questions[0];
  const held = new Client(connection(db)); await held.connect();
  let release;
  try {
    await held.query('begin'); await held.query("select set_config('quiz.test_uid',$1,true)", [uid]); await held.query('set local role authenticated');
    await held.query("select public.quiz_action('view_question',$1)", [{ ...data, question_id: q.id }]);
    const started = performance.now();
    release = delay(1200).then(() => held.query('commit'));
    const mediaStarted=performance.now();
    const ownMedia=rpc(db,uid,'media_read',{url:q.prompt.media.at(-1).url,attempt_id:state.attempt_id}).then(()=>performance.now()-mediaStarted);
    const otherState = (await rpc(db, other, 'resume', data)).result;
    assert.equal(Object.keys(otherState.responses).length, 0);
    const ms = performance.now() - started;
    if (db === 'optimized') assert.ok(ms < 1000, `other_student_blocked_${ms}`);
    checks.push({ db, check: 'held_student_other_student_resume', ms: +ms.toFixed(2) });
    await release;
    const ownMs=await ownMedia;
    if(db==='optimized')assert.ok(ownMs<1000,`own_media_blocked_${ownMs}`);
    else assert.ok(ownMs<1000,`batch1_media_regressed_${ownMs}`);
    checks.push({db,check:'same_attempt_media_during_held_answer_lock',ms:+ownMs.toFixed(2)});
  } finally { if (release) await release; await held.query('rollback'); await held.end(); }
  const right=(await pools[db].query('select question from public.quiz_question_pool where question_id=$1',[q.id])).rows[0].question.answer.option_id;
  const submit = { ...data, question_id: q.id, request_id: randomUUID(), response: q.options.find(o=>o.id!==right).id, compact: true };
  // Repeated rapid submits cannot save answers or forge a trusted elapsed time.
  const nextq = state.document.questions[1];
  const fastState = (await rpc(db, student(33), 'join', data)).result;
  const fast = (await rpc(db, student(33), 'submit', { ...data, question_id: fastState.document.questions[0].id, response: 'a', request_id: randomUUID(), elapsed_seconds: 9999 })).result;
  assert.equal(fast.warning, 'answer_too_fast');
  await delay(1000);
  await Promise.all([rpc(db, uid, 'submit', submit), rpc(db, uid, 'submit', submit)]);
  assert.equal((await pools[db].query('select count(*)::int n from public.quiz_answers where attempt_id=$1', [state.attempt_id])).rows[0].n, 1);
  assert.equal((await rpc(db, uid, 'resume', data)).result.reviews.length, 1);
  const heldDetail=new Client(connection(db));await heldDetail.connect();let detailRelease;
  try{await heldDetail.query('begin');await heldDetail.query('select id from public.quiz_attempts where id=$1 for update',[state.attempt_id]);const started=performance.now();detailRelease=delay(1200).then(()=>heldDetail.query('commit'));
    await rpc(db,uid,'wrong_detail',{action:'detail',attempt_id:state.attempt_id,question_id:q.id});const ms=performance.now()-started;
    assert.ok(db==='optimized'?ms<1000:ms>=1000,'wrong_detail_lock_parity');checks.push({db,check:'same_attempt_wrong_detail_during_write_lock',ms:+ms.toFixed(2)});
  }finally{if(detailRelease)await detailRelease;await heldDetail.query('rollback');await heldDetail.end();}
  await assert.rejects(rpc(db, teacher, 'join', data), /student_required/);
  await assert.rejects(rpc(db, student(34), 'library_sessions'), /roster_required/);
  await assert.rejects(rpc(db, student(35), 'join', data), /roster_required/);
  await assert.rejects(rpc(db, null, 'library_sessions', {}, 'anon'), /permission denied/);
  await assert.rejects(rpc(db, other, 'submit', { ...data, question_id: nextq.id, request_id: randomUUID(), response: 'a' }), /question_order/);
  if (db === 'optimized') {
    const lock = new Client(connection(db)); await lock.connect();
    try {
      await lock.query('begin'); await lock.query('select pg_advisory_xact_lock_shared(1364542026,hashtext($1))', [sid]);
      const started = performance.now(); await assert.rejects(rpc(db, teacher, 'close', data), /session_busy/);
      const ms = performance.now() - started; assert.ok(ms < 2000); checks.push({ db, check: 'bounded_close', ms: +ms.toFixed(2) });
      assert.equal((await pools[db].query('select status from public.quiz_sessions where id=$1', [sid])).rows[0].status, 'open');
    } finally { await lock.query('rollback'); await lock.end(); }
  }
  await rpc(db, teacher, 'close', data);
  await assert.rejects(rpc(db, other, 'submit', { ...data, question_id: state.document.questions[0].id, request_id: randomUUID(), response: 'a' }), /session_closed/);
  assert.equal((await rpc(db, uid, 'submit', submit)).result.responses[q.id], submit.response);
  const classroom = fixed(3, 40); await pools[db].query("update public.quiz_sessions set access_mode='classroom' where id=$1", [classroom]);
  const joins = await Promise.allSettled(Array.from({ length: 33 }, (_, i) => rpc(db, student(i + 1), 'join', { session_id: classroom })));
  assert.equal(joins.filter(r => r.status === 'fulfilled').length, 29);
  assert.ok(joins.filter(r => r.status === 'rejected').every(r => /session_full/.test(r.reason.message)));
  checks.push({ db, check: 'race_duplicate_answer_admission_close_permissions_integrity', passed: true });
}
let origin;
async function teacherReads(db){
 const rows=await Promise.all(Array.from({length:30},()=>rpc(db,teacher,'version_list',{bank_id:fixed(1,1)})));
 const normalized=rows[0].result.versions.map(v=>({id:v.id,revision:v.revision,title:v.title??v.document.title,total:v.total??v.document.blocks.reduce((n,b)=>n+b.questions.length,0)}));
 assert.equal(normalized.length,31);if(snapshots.has('teacher'))assert.deepEqual(normalized,snapshots.get('teacher'));else snapshots.set('teacher',normalized);
 if(db==='optimized'){assert.equal(rows[0].result.versions[0].document,undefined);const one=(await rpc(db,teacher,'version_get',{bank_id:fixed(1,1),version_id:normalized[0].id})).result;assert.equal(one.document.title,normalized[0].title);}
 const summary={requests:30,bytes:rows.reduce((n,r)=>n+Buffer.byteLength(JSON.stringify(r.result)),0),db_ms:{p95:quantile(rows.map(r=>r.db_ms),.95),max:quantile(rows.map(r=>r.db_ms),1)},queue_ms:{p95:quantile(rows.map(r=>r.queue_ms),.95)}};
 const held=new Client(connection(db));await held.connect();let release;try{await held.query('begin');await held.query('select id from public.quiz_banks where id=$1 for update',[fixed(1,1)]);const started=performance.now();release=delay(1200).then(()=>held.query('commit'));await rpc(db,teacher,'version_list',{bank_id:fixed(1,1)});const ms=performance.now()-started;assert.ok(db==='optimized'?ms<1000:ms>=1000,'version_read_lock');checks.push({db,check:'version_list_during_bank_save_lock',ms:+ms.toFixed(2)});}finally{if(release)await release;await held.query('rollback');await held.end();}
 return summary;
}
try {
  await pg.initialise(); await pg.start();
  admin = new Client(connection('postgres')); await admin.connect();
  await admin.query('create role anon;create role authenticated;create role service_role bypassrls;create extension pg_stat_statements');
  const version = (await admin.query("select version(),current_setting('max_connections') max_connections,current_setting('shared_buffers') shared_buffers")).rows[0];
  const datasets = {};
  for (const db of ['baseline', 'optimized']) {
    await admin.query(`create database ${db}`);
    pools[db] = new Pool({ ...connection(db), max: 8, connectionTimeoutMillis: 10000 });
    datasets[db] = await seed(db, db === 'baseline' ? baseline : 'supabase');
  }
  assert.equal(datasets.baseline.pool, datasets.optimized.pool);
  server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const send = (status, data, metrics = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'x-db-ms': metrics.db_ms || 0, 'x-queue-ms': metrics.queue_ms || 0 }); res.end(JSON.stringify(data)); };
    try {
      const data = JSON.parse(body);
      if (req.url === '/synthetic-login') {
        if (!['baseline', 'optimized'].includes(data.db) || !Number.isInteger(data.number) || data.number < 1 || data.number > 33) throw Error('invalid_request');
        return send(200, { token: sign({ db: data.db, user: student(data.number) }) });
      }
      const claim = verify(req.headers.authorization?.slice(7));
      const call = await rpc(claim.db, claim.user, data.action, data.data); send(200, call.result, call);
    } catch (error) { send(400, { error: error.message }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + server.address().port;
  // Warm both code/data caches outside measurements.
  for (const db of ['baseline', 'optimized']) {
    const clients = await Promise.all(Array.from({ length: 8 }, () => pools[db].connect()));
    try { await Promise.all(clients.map(async (c, i) => { await c.query('begin'); await c.query("select set_config('quiz.test_uid',$1,true)", [student(i + 1)]); await c.query('set local role authenticated');
      for (let n = 0; n < 2; n++) { await c.query("select public.quiz_action('library_sessions','{}')"); await c.query('select public.quiz_pool_catalog()'); } await c.query('commit'); }));
    } finally { clients.forEach(c => c.release()); }
  }
  await admin.query('select pg_stat_statements_reset()');
  const rounds = Number(value('--rounds', '2'));
  for (let round = 1; round <= rounds; round++) for (const db of round % 2 ? ['baseline', 'optimized'] : ['optimized', 'baseline']) await run(db, round, 22);
  for (const db of ['baseline', 'optimized']) await run(db, 7, 30);
  for (const db of ['baseline', 'optimized']) await concurrencyChecks(db);
  const teacherResults={};for(const db of ['baseline','optimized'])teacherResults[db]=await teacherReads(db);
  const statements = (await admin.query('select d.datname,s.calls,s.mean_exec_time,s.max_exec_time,s.total_exec_time,s.shared_blks_hit,s.shared_blks_read,s.shared_blk_read_time,s.query from pg_stat_statements s join pg_database d on d.oid=s.dbid where d.datname in (\'baseline\',\'optimized\') order by s.total_exec_time desc limit 150')).rows;
  await fs.writeFile(output + '/pg-stat-statements.json', JSON.stringify(statements, null, 2));
  for (const db of ['baseline', 'optimized']) {
    const c = await pools[db].connect();
    try { await c.query('begin'); await c.query("select set_config('quiz.test_uid',$1,true)", [student(1)]); await c.query('set local role authenticated');
      const plan = (await c.query('explain(analyze,buffers,format json) select public.quiz_compose($1)', [{ kind: 'self', count: 10, units: [1, 2, 3, 4], request_id: randomUUID() }])).rows;
      await fs.writeFile(output + '/explain-compose-' + db + '.json', JSON.stringify(plan, null, 2));
    } finally { await c.query('rollback'); c.release(); }
  }
  const aggregate = Object.fromEntries(['baseline', 'optimized'].map(db => [db, {
    overall: summarize(records.filter(r => r.db === db)),
    by_action: Object.fromEntries([...new Set(records.map(r => r.action))].map(action => [action, summarize(records.filter(r => r.db === db && r.action === action))])),
  }]));
  const ledgers = {};
  for (const db of ['baseline', 'optimized']) ledgers[db] = (await pools[db].query('select (select count(*)::int from public.quiz_answers) answers,(select count(*)::int from public.quiz_leaf_awards) leaves,(select count(*)::int from public.quiz_question_timing where accepted_seconds<2) invalid_timing')).rows[0];
  assert.deepEqual(ledgers.baseline, ledgers.optimized); assert.equal(ledgers.optimized.invalid_timing, 0);
  const noWorse = (current, before) => current <= before * 1.10 + 3;
  const gate = [];
  for (const round of [...Array.from({ length: rounds }, (_, i) => i + 1), 7]) {
    const before = results.find(r => r.db === 'baseline' && r.round === round), current = results.find(r => r.db === 'optimized' && r.round === round);
    gate.push({ check: 'paired_http_p95_max', round, passed: noWorse(current.http_ms.p95, before.http_ms.p95) && noWorse(current.http_ms.max, before.http_ms.max) });
  }
  for (const action of ['submit','library_sessions','wrong_questions','wrong_detail']) gate.push({ check: 'action_http_p95', action, passed: noWorse(aggregate.optimized.by_action[action].http_ms.p95, aggregate.baseline.by_action[action].http_ms.p95) });
  gate.push({ check: 'target_db_p95', passed:['library_sessions','wrong_questions','wrong_detail'].every(a=>aggregate.optimized.by_action[a].db_ms.p95<aggregate.baseline.by_action[a].db_ms.p95) });
  gate.push({check:'teacher_list_bytes_and_p95',passed:teacherResults.optimized.bytes<teacherResults.baseline.bytes*.2 && teacherResults.optimized.db_ms.p95<teacherResults.baseline.db_ms.p95});
  gate.push({ check: 'compact_payload_unchanged', passed:aggregate.optimized.by_action.submit.bytes===aggregate.baseline.by_action.submit.bytes });
  const performancePassed = gate.every(g => g.passed);
  const report = { at: new Date().toISOString(),sql_sha256:createHash('sha256').update(await fs.readFile('supabase/quiz-load-batch2.sql')).digest('hex'), version, model, pool_limit: 8, warm_connections: 8, warm_http_path_before_each_arm: true, ...Object.fromEntries(Object.entries(datasets.baseline).filter(([k]) => !['questions', 'document'].includes(k))),
    caveats: ['Local real PostgreSQL, synthetic post-OAuth login; does not exercise Google or Supabase Auth', 'Not a reproduction of Nano memory, storage latency, host stalls or classroom WAN', 'Same seeded pool/history; A/B interleaved, warmup excluded; two-second guard enabled'], results, aggregate, teacher:teacherResults,checks, ledgers, gate, correctnessPassed: true, performancePassed, passed: performancePassed };
  await fs.writeFile(output + '/report.json', JSON.stringify(report, null, 2));
  await fs.writeFile(output + '/requests.json', JSON.stringify(records));
  console.log(JSON.stringify({ passed: performancePassed, report: output + '/report.json', aggregate, gate }));
  if (!performancePassed) process.exitCode = 2;
} catch (error) { await fs.writeFile(output + '/failure.json', JSON.stringify({ message: error.message, stack: error.stack, results, checks }, null, 2)); throw error; }
finally { if (server) await new Promise(resolve => server.close(resolve)); for (const pool of Object.values(pools)) await pool.end(); if (admin) await admin.end(); await pg.stop(); }
