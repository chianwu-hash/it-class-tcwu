// Guard against reinstalling an old function definition (e.g. quiz_action without ORDER BY).
// usage: node automation/db-snapshot-check.mjs [--live] [--cli <supabase command>] [--workdir <linked dir>]
//   static checks (default, no network):
//     1. supabase/production-snapshot/functions.sql matches manifest.json (md5 per function, file sha256).
//     2. No function in the snapshot or in any supabase/*.sql looks up "the next question" from
//        question_order with LIMIT 1 but without ORDER BY (the 2026-10-30 question_order bug).
//     3. Files that redefine public.quiz_action without the learning wrapper are reported: applying them
//        after quiz-learning.sql would drop the wrapper, so the snapshot must be applied last.
//   --live: read-only md5 comparison of every public function in production against the manifest.
// Exit 1 on any failure.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { splitSnapshot, unorderedLookups } from './lib/db-snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const snapDir = path.join(root, 'supabase', 'production-snapshot');
const failures = [], warnings = [];

// 1. snapshot integrity
const fnSql = await fs.readFile(path.join(snapDir, 'functions.sql'), 'utf8');
const manifest = JSON.parse(await fs.readFile(path.join(snapDir, 'manifest.json'), 'utf8'));
const normalized = fnSql; // byte-exact: .gitattributes marks the snapshot -text
if (createHash('sha256').update(normalized).digest('hex') !== manifest.fileSha256) failures.push('functions.sql sha256 does not match manifest.json (hand-edited? re-run automation/db-schema-snapshot.mjs)');
const blocks = splitSnapshot(normalized);
const inFile = new Map(blocks.map(b => [b.signature, b]));
for (const [sig, meta] of Object.entries(manifest.functions)) {
  const b = inFile.get(sig);
  if (!b) { failures.push(`snapshot missing ${sig}`); continue; }
  if (b.md5 !== meta.md5) failures.push(`snapshot header md5 differs for ${sig}`);
  // pg_get_functiondef() ends with a newline; the exporter trims it before appending ';'.
  if (createHash('md5').update(b.definition + '\n').digest('hex') !== meta.md5) failures.push(`snapshot body md5 differs for ${sig}`);
}
if (blocks.length !== Object.keys(manifest.functions).length) failures.push(`snapshot has ${blocks.length} blocks, manifest ${Object.keys(manifest.functions).length}`);

// 2. unordered next-question lookups
for (const b of blocks) for (const line of unorderedLookups(b.definition)) failures.push(`snapshot ${b.signature}: next-question lookup without ORDER BY (body line ${line})`);
const sqlFiles = (await fs.readdir(path.join(root, 'supabase'))).filter(f => f.endsWith('.sql')).sort();
for (const f of sqlFiles) {
  const text = (await fs.readFile(path.join(root, 'supabase', f), 'utf8')).replace(/\r\n/g, '\n');
  for (const line of unorderedLookups(text)) failures.push(`supabase/${f}:${line}: next-question lookup without ORDER BY`);
  // 3. quiz_action redefinitions that are not the learning wrapper
  for (const m of text.matchAll(/create\s+or\s+replace\s+function\s+public\.quiz_action\s*\(([\s\S]*?)\$function\$|create\s+or\s+replace\s+function\s+public\.quiz_action\s*\(([\s\S]*?)\$\$\s*;/gi)) {
    const body = m[0];
    if (!/quiz_action_before_learning/.test(body)) warnings.push(`supabase/${f}:${text.slice(0, m.index).split('\n').length}: redefines quiz_action without the learning wrapper; apply supabase/production-snapshot/functions.sql afterwards`);
  }
}

// 4. optional live drift check (read-only catalog query)
if (args.includes('--live')) {
  const cli = opt('--cli', 'D:\\local-bin\\supabase-personal.cmd'), workdir = opt('--workdir', 'D:\\projects\\it-class-tcwu');
  const file = path.join(os.tmpdir(), `snapshot-check-${process.pid}.sql`);
  await fs.writeFile(file, `select p.oid::regprocedure::text as signature, md5(pg_get_functiondef(p.oid)) as md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p') and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by 1`);
  const raw = execFileSync('cmd.exe', ['/d', '/c', cli, 'db', 'query', '--linked', '-o', 'json', '-f', file], { cwd: workdir, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
  await fs.rm(file, { force: true });
  const live = new Map(JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)).rows.map(r => [r.signature, r.md5]));
  for (const [sig, md5] of live) if (!manifest.functions[sig]) failures.push(`live has ${sig} not in snapshot`); else if (manifest.functions[sig].md5 !== md5) failures.push(`live ${sig} md5 ${md5} != snapshot ${manifest.functions[sig].md5}`);
  for (const sig of Object.keys(manifest.functions)) if (!live.has(sig)) failures.push(`snapshot has ${sig} not in live`);
}

console.log(JSON.stringify({ ok: !failures.length, functions: blocks.length, sqlFiles: sqlFiles.length, live: args.includes('--live'), failures, warnings }, null, 1));
process.exitCode = failures.length ? 1 : 0;
