// Per-statement profile of the student self-compose classroom flow on real PostgreSQL 17.
// Runtime: --runtime <dir>/package.json with embedded-postgres@17.6.0-beta.15 and pg.
// Pool data: --pool-dir with hanlin-g3-math-pool/pool.json and all-subjects-pool/{pool,courses}.json (licensed, local only).
// All users, papers, answers and tokens are synthetic. Not a reproduction of Nano memory/host stalls.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2), value = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const sqlDir = path.resolve(value('--sql-dir', 'supabase')), poolDir = path.resolve(value('--pool-dir'));
const output = path.resolve(value('--output', 'automation/output/quiz/profile-' + Date.now()));
const students = Number(value('--students', '30')), count = Number(value('--count', '10')), poolSize = Number(value('--pool-size', '8'));
const extra = (value('--extra-sql', '') || '').split(',').filter(Boolean);
await fs.mkdir(output, { recursive: true });
const runtime = createRequire(path.resolve(value('--runtime')));
const { default: EmbeddedPostgres } = await import(pathToFileURL(runtime.resolve('embedded-postgres')).href);
const { Pool } = runtime('pg');
const teacher = '00000000-0000-4000-8000-000000000001', student = i => `00000000-0000-4000-8001-${String(i).padStart(12, '0')}`;
const fixed = (kind, i) => `${String(kind).padStart(8, '0')}-0000-4000-8000-${String(i).padStart(12, '0')}`;
const password = randomBytes(24).toString('hex'), port = Number(value('--pg-port', '55451'));
const pg = new EmbeddedPostgres({ databaseDir: output + '/pgdata', user: 'postgres', password, port, persistent: false,
  postgresFlags: ['-h', '127.0.0.1', '-c', 'max_connections=60', '-c', 'shared_buffers=64MB', '-c', 'shared_preload_libraries=pg_stat_statements',
    '-c', 'pg_stat_statements.track=all', '-c', 'track_functions=all', '-c', 'track_io_timing=on'],
  initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
await pg.initialise(); await pg.start();
const pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', max: poolSize });
const records = [];
async function rpc(user, fn, params) {
  const t0 = performance.now(), c = await pool.connect(), t1 = performance.now();
  try {
    await c.query('begin');
    await c.query("select set_config('quiz.test_uid',$1,true),set_config('statement_timeout','8000',true)", [user]);
    await c.query('set local role authenticated');
    const r = (await c.query(`select public.${fn}(${params.map((_, i) => '$' + (i + 1)).join(',')}) result`, params)).rows[0].result;
    await c.query('commit');
    records.push({ fn: fn === 'quiz_action' ? 'quiz_action:' + params[0] : fn, queue: t1 - t0, db: performance.now() - t1, bytes: JSON.stringify(r).length });
    return r;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
const act = (u, a, d) => rpc(u, 'quiz_action', [a, JSON.stringify(d)]);
try {
  const c = await pool.connect();
  try {
    await c.query(`create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('quiz.test_uid',true),'')::uuid$$;
      create function public.is_teacher() returns boolean language sql as $$select auth.uid()='${teacher}'::uuid$$;
      create table public.student_enrollments(school_year smallint,email text,class_code text,seat_no smallint,display_name text,primary key(school_year,email));
      create role anon;create role authenticated;create role service_role;
      grant usage on schema public,auth to anon,authenticated,service_role;create extension pg_stat_statements;`);
    for (const [id, email] of [[teacher, 'teacher@example.invalid'], ...Array.from({ length: students }, (_, i) => [student(i + 1), `student${i + 1}@example.invalid`])])
      await c.query('insert into auth.users values($1,$2,now())', [id, email]);
    await c.query("insert into public.student_enrollments select 115,email,'304',row_number()over(order by email),'合成'||row_number()over(order by email) from auth.users where email like 'student%'");
    for (const f of ['quiz.sql', 'quiz-media.sql', 'quiz-wrong-questions.sql', 'quiz-pool.sql', 'quiz-rewards.sql', 'quiz-load-batch1.sql', 'quiz-load-batch2.sql', 'quiz-load-batch3.sql', 'quiz-load-batch4.sql', ...extra])
      await c.query(await fs.readFile(path.join(sqlDir, f), 'utf8'));
    const math = JSON.parse(await fs.readFile(path.join(poolDir, 'hanlin-g3-math-pool/pool.json'), 'utf8'));
    const other = JSON.parse(await fs.readFile(path.join(poolDir, 'all-subjects-pool/pool.json'), 'utf8'));
    const courses = JSON.parse(await fs.readFile(path.join(poolDir, 'all-subjects-pool/courses.json'), 'utf8'));
    for (const course of courses) await c.query('insert into public.quiz_courses values($1,$2,$3,true) on conflict(id) do nothing', [course.id, course.grade, course.definition]);
    const rows = [...math, ...other].map(r => ({ ...r, usable: true }));
    await c.query('insert into public.quiz_question_pool select question_id,source_item_id,group_key,unit_ids,knowledge_code,knowledge_name,difficulty,source_version,publisher_explanation,question,checks,true from jsonb_populate_recordset(null::public.quiz_question_pool,$1)', [JSON.stringify(rows)]);
    for (const course of courses) await c.query('insert into public.quiz_pool_membership select question_id,$1,true from public.quiz_question_pool where question_id=any($2::text[])', [course.id, other.filter(r => r.course_id === course.id).map(r => r.question_id)]);
    // A teacher practice paper with 20 real questions and images, like a prepared unit paper.
    const qs = math.filter(r => r.unit_ids.includes(1)).slice(0, 20).map(r => r.question);
    for (const [i, q] of qs.entries()) q.prompt.media = [...(q.prompt.media || []), { kind: 'image', url: `https://quiz-media.invalid/${teacher}/${String(i + 1).padStart(64, '0')}`, alt: '合成圖' }];
    const doc = { schema: 1, title: '合成老師卷', catalog: { school_year: '115', volume: '3年級上學期', subject: '數學', publisher: '翰林', unit: '第一單元' }, blocks: qs.map((q, i) => ({ id: 'b' + i, material: { text: '', runs: [], media: [] }, questions: [q] })) };
    const urls = [...new Set([...JSON.stringify([doc, rows]).matchAll(/https:\/\/quiz-media\.invalid\/[a-f0-9-]+\/[a-f0-9]+/g)].map(m => m[0]))];
    for (const [i, url] of urls.entries()) await c.query('insert into public.quiz_media_assets values($1,$2,$3,$4,1) on conflict do nothing', [url, teacher, 'fixture-' + i, 'image/png']);
    await c.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)', [fixed(1, 1), teacher, doc]);
    await c.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)', [fixed(2, 1), fixed(1, 1), doc]);
    await c.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,access_mode,shuffle_questions,shuffle_options) values($1,$2,$3,115,'[\"304\"]','immediate','practice',true,true)", [fixed(3, 1), teacher, fixed(2, 1)]);
    await c.query('update public.quiz_integrity_settings set enabled=true');
    await c.query('analyze'); await c.query('select pg_stat_statements_reset()'); await c.query('select pg_stat_reset()');
  } finally { c.release(); }
  const answerOf = async qid => (await pool.query('select question from public.quiz_question_pool where question_id=$1', [qid])).rows[0]?.question;
  async function play(u, sid, n) {
    await rpc(u, 'quiz_entry_context', [JSON.stringify({ session_id: sid })]);
    const joined = await act(u, 'join', { session_id: sid });
    const order = (await pool.query('select question_order,option_orders from public.quiz_attempts where id=$1', [joined.attempt_id])).rows[0];
    const docRow = (await pool.query('select v.document from public.quiz_versions v join public.quiz_sessions s on s.version_id=v.id where s.id=$1', [sid])).rows[0].document;
    const byId = Object.fromEntries(docRow.blocks.flatMap(b => b.questions).map(q => [q.id, q]));
    for (const qid of order.question_order.slice(0, n)) {
      await act(u, 'view_question', { session_id: sid, question_id: qid });
      const img = byId[qid].prompt.media?.find(m => m.url.startsWith('https://quiz-media.invalid/'));
      if (img) await rpc(u, 'quiz_media_access', [img.url, joined.attempt_id]);
      await delay(2100 + Math.random() * 400);
      const q = byId[qid], right = q.answer?.option_id;
      const response = q.type === 'single' ? (Math.random() < .7 ? right : q.options.find(o => o.id !== right).id) : (q.answer?.accepted?.[0] || '1');
      await act(u, 'submit', { session_id: sid, question_id: qid, response, request_id: crypto.randomUUID(), compact: true });
    }
  }
  const started = performance.now();
  await Promise.all(Array.from({ length: students }, async (_, k) => {
    const u = student(k + 1);
    await delay(Math.random() * 3000);
    await rpc(u, 'quiz_library_sessions', ['{}']);
    await rpc(u, 'quiz_pool_catalog', []);
    const composed = await rpc(u, 'quiz_compose', [JSON.stringify({ kind: 'self', course_id: '115-1-hanlin-g3-math', count, units: [1, 2, 3], difficulty: 'medium', request_id: crypto.randomUUID() })]);
    await play(u, composed.session_id, count);
    await rpc(u, 'quiz_library_sessions', ['{}']);
    await play(u, fixed(3, 1), 5);
  }));
  const wall = performance.now() - started;
  // Per-backend memory after one connection has run the whole student flow (pool max=1 replay).
  const mem = async () => { const m = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', max: 1 }); const cl = await m.connect();
    const total = async () => Number((await cl.query('select sum(total_bytes) b from pg_backend_memory_contexts')).rows[0].b);
    const top = async () => (await cl.query("select name, ident, sum(total_bytes)::bigint b from pg_backend_memory_contexts group by 1,2 order by 3 desc limit 12")).rows;
    const fresh = await total(); const u = student(1), sid = fixed(3, 1);
    const call = async (fn, ps) => { await cl.query('begin'); await cl.query("select set_config('quiz.test_uid',$1,true)", [u]); await cl.query('set local role authenticated');
      try { await cl.query(`select public.${fn}(${ps.map((_, i) => '$' + (i + 1)).join(',')})`, ps); } catch {} await cl.query('rollback'); };
    const steps = {};
    for (const [label, fn, ps] of [['library', 'quiz_library_sessions', ['{}']], ['catalog', 'quiz_pool_catalog', []], ['entry', 'quiz_entry_context', [JSON.stringify({ session_id: sid })]],
      ['join', 'quiz_action', ['join', JSON.stringify({ session_id: sid })]], ['view', 'quiz_action', ['view_question', JSON.stringify({ session_id: sid, question_id: 'x' })]],
      ['submit', 'quiz_action', ['submit', JSON.stringify({ session_id: sid, question_id: 'x', response: 'a', request_id: crypto.randomUUID(), compact: true })]],
      ['compose', 'quiz_compose', [JSON.stringify({ kind: 'self', course_id: '115-1-hanlin-g3-math', count: 10, units: [1, 2, 3], request_id: crypto.randomUUID() })]],
      ['wrong', 'quiz_wrong_questions', ['{"action":"list"}']], ['rewards', 'quiz_rewards', ['{}']]]) { await call(fn, ps); steps[label] = await total(); }
    const contexts = await top(); cl.release(); await m.end(); return { fresh, steps, contexts }; };
  const memory = await mem();
  const q = s => pool.query(s).then(r => r.rows);
  const top = await q(`select toplevel, calls, round(total_exec_time::numeric,1) total_ms, round(mean_exec_time::numeric,3) mean_ms, round(max_exec_time::numeric,1) max_ms,
    shared_blks_hit hit, shared_blks_read rd, temp_blks_written tmp, wal_bytes, regexp_replace(left(query,180),'\\s+',' ','g') query
    from pg_stat_statements where userid=(select oid from pg_roles where rolname='authenticated') or toplevel=false order by total_exec_time desc limit 60`);
  const funcs = await q(`select funcname, calls, round(total_time::numeric,1) total_ms, round(self_time::numeric,1) self_ms, round((total_time/nullif(calls,0))::numeric,3) mean_ms from pg_stat_user_functions order by total_time desc limit 30`);
  const by = {};
  for (const r of records) { const s = by[r.fn] ||= { calls: 0, db: [], queue: [], bytes: 0 }; s.calls++; s.db.push(r.db); s.queue.push(r.queue); s.bytes += r.bytes; }
  const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
  const actions = Object.fromEntries(Object.entries(by).map(([k, s]) => [k, { calls: s.calls, db_p50: pct(s.db, .5), db_p95: pct(s.db, .95), db_max: pct(s.db, 1), queue_p95: pct(s.queue, .95), total_db: +s.db.reduce((a, b) => a + b, 0).toFixed(1), avg_bytes: Math.round(s.bytes / s.calls) }]));
  const report = { at: new Date().toISOString(), memory, students, count, poolSize, extra, wall_ms: Math.round(wall), actions, functions: funcs, statements: top };
  await fs.writeFile(output + '/report.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ wall_ms: report.wall_ms, memory }, null, 1));
} finally { await pool.end(); await pg.stop(); }
