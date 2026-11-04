// Export the production public schema (definitions only, never table rows) into supabase/production-snapshot/.
// Reads catalogs only: functions, tables/columns/constraints/indexes, RLS policies, triggers, views, grants.
// usage: node automation/db-schema-snapshot.mjs [--workdir <dir linked to the project>] [--cli <supabase command>]
//   default --cli is D:\local-bin\supabase-personal.cmd (personal account, linked to upxgyusodibaqcrocdzj).
// Output is deterministic (sorted) so `git diff` shows real schema drift.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const cli = opt('--cli', 'D:\\local-bin\\supabase-personal.cmd'), workdir = opt('--workdir', 'D:\\projects\\it-class-tcwu');
const outDir = path.join(root, 'supabase', 'production-snapshot');

async function query(name, sql) {
  const file = path.join(os.tmpdir(), `schema-snapshot-${name}-${process.pid}.sql`);
  await fs.writeFile(file, sql);
  const raw = execFileSync('cmd.exe', ['/d', '/c', cli, 'db', 'query', '--linked', '-o', 'json', '-f', file], { cwd: workdir, encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
  await fs.rm(file, { force: true });
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  return json.rows;
}

const notExtension = (cls, oid) => `not exists (select 1 from pg_depend d where d.classid='${cls}'::regclass and d.objid=${oid} and d.deptype='e')`;
const functions = await query('functions', `
select p.oid::regprocedure::text as signature, p.proname as name, pg_get_functiondef(p.oid) as definition,
       md5(pg_get_functiondef(p.oid)) as md5, p.prosecdef as security_definer, coalesce(p.proacl::text,'') as acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p') and ${notExtension('pg_proc', 'p.oid')}
order by p.proname, p.oid::regprocedure::text`);
const tables = await query('tables', `
select c.relname as name, c.relkind::text as kind, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls, coalesce(c.relacl::text,'') as acl,
  (select coalesce(json_agg(json_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
     'default',pg_get_expr(ad.adbin,ad.adrelid),'identity',a.attidentity::text,'generated',a.attgenerated::text) order by a.attnum),'[]')
   from pg_attribute a left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
   where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select coalesce(json_agg(json_build_object('name',co.conname,'def',pg_get_constraintdef(co.oid)) order by co.conname),'[]') from pg_constraint co where co.conrelid=c.oid) as constraints,
  (select coalesce(json_agg(pg_get_indexdef(i.indexrelid) order by pg_get_indexdef(i.indexrelid)),'[]') from pg_index i where i.indrelid=c.oid) as indexes,
  case when c.relkind in ('v','m') then pg_get_viewdef(c.oid,true) end as view_def
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v','m') and ${notExtension('pg_class', 'c.oid')}
order by c.relname`);
const policies = await query('policies', `
select tablename as table, policyname as name, permissive, roles::text as roles, cmd, qual, with_check
from pg_policies where schemaname='public' order by tablename, policyname`);
const triggers = await query('triggers', `
select c.relname as table, t.tgname as name, pg_get_triggerdef(t.oid) as def, t.tgenabled::text as enabled
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal order by c.relname, t.tgname`);
const sequences = await query('sequences', `
select c.relname as name, coalesce(c.relacl::text,'') as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='S' order by c.relname`);
const types = await query('types', `
select t.typname as name, t.typtype::text as kind, (select coalesce(json_agg(e.enumlabel order by e.enumsortorder),'[]') from pg_enum e where e.enumtypid=t.oid) as labels
from pg_type t join pg_namespace n on n.oid=t.typnamespace
where n.nspname='public' and t.typtype in ('e','d','c') and not exists (select 1 from pg_class c where c.oid=t.typrelid and c.relkind<>'c')
order by t.typname`);
const extensions = await query('extensions', `select extname as name, extversion as version, extnamespace::regnamespace::text as schema from pg_extension order by extname`);

// Functions file: replayable, ends with the exact production ACL per function.
const aclGrants = (sig, acl) => {
  // Revoke from every managed role first so extra direct grants cannot survive a replay.
  const lines = [`revoke all on function public.${sig.replace(/^public\./, '')} from public, anon, authenticated, service_role;`];
  for (const item of acl.replace(/^\{|\}$/g, '').split(',').filter(Boolean)) {
    const [grantee, rest] = item.split('='); if (!rest || !rest.split('/')[0].includes('X')) continue;
    lines.push(`grant execute on function public.${sig.replace(/^public\./, '')} to ${grantee === '' ? 'public' : grantee};`);
  }
  return lines.join('\n');
};
const header = `-- Production function snapshot of Supabase project upxgyusodibaqcrocdzj (public schema).
-- Generated by automation/db-schema-snapshot.mjs from pg_get_functiondef(); do not hand-edit.
-- Install order: run the legacy supabase/*.sql files first (tables, policies), then this file LAST,
-- so every function ends at the production definition (e.g. quiz_action with ordered next-question lookup).
-- Check: node automation/db-snapshot-check.mjs
`;
const fnSql = header + '\n' + functions.map(f => `-- ${f.signature}  md5=${f.md5}\n${f.definition.trimEnd()};\n${aclGrants(f.signature, f.acl)}\n`).join('\n');
const manifest = {
  project: 'upxgyusodibaqcrocdzj', exportedAt: new Date().toISOString(),
  counts: { functions: functions.length, tables: tables.length, policies: policies.length, triggers: triggers.length },
  functions: Object.fromEntries(functions.map(f => [f.signature, { md5: f.md5, securityDefiner: f.security_definer, acl: f.acl }])),
  fileSha256: createHash('sha256').update(fnSql).digest('hex'),
};
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'functions.sql'), fnSql);
await fs.writeFile(path.join(outDir, 'schema.json'), JSON.stringify({ tables, policies, triggers, sequences, types, extensions }, null, 1) + '\n');
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify(manifest.counts));
