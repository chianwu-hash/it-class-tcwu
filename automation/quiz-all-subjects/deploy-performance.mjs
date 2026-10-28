// Function-only, authorized update; no compute/plan changes or classroom load generation.
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildNamingMigration } from '../lib/quiz-name-migration.mjs';
export function performanceMigration(files) {
  const core = files.core.slice(files.core.indexOf('create or replace function public.quiz_student_identity()'), files.core.lastIndexOf('commit;'));
  const wrong = files.wrong.slice(files.wrong.indexOf('create or replace function public.quiz_wrong_questions('), files.wrong.lastIndexOf('commit;'));
  const catalog = files.pool.slice(files.pool.indexOf('create or replace function public.quiz_delete_paper('), files.pool.lastIndexOf('commit;'));
  const compose = files.pool.slice(files.pool.indexOf('create or replace function public.quiz_compose('), files.pool.indexOf('-- Compatibility endpoint'));
  const rewards = files.rewards.slice(files.rewards.indexOf('create or replace function public.quiz_rewards('), files.rewards.indexOf('revoke all on function public.quiz_answer_guard'));
  if (![core, wrong, catalog, rewards, compose].every(s => s.startsWith('create or replace function'))) throw Error('function_source_missing');
  const source = `begin;\n${core}\n${wrong}\n${compose}\n${catalog}\n${rewards}\nrevoke all on function public.quiz_rewards(jsonb) from public,anon;grant execute on function public.quiz_rewards(jsonb) to authenticated;\ncommit;`;
  if (/\b(create|alter|drop) table\b|insert into public\.quiz_name_characters/i.test(source)) throw Error('unexpected_schema_change');
  const timing = "(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by to_jsonb(x)::text),'')) from public.quiz_question_timing x)";
  const names = "(select md5(coalesce(string_agg(to_jsonb(x)::text,'' order by to_jsonb(x)::text),'')) from public.quiz_generated_papers x)";
  const extra = `jsonb_build_object('timing',${timing},'names',${names})`;
  return buildNamingMigration(source).replace('lock table public.quiz_generated_papers', "set local lock_timeout='3s';set local statement_timeout='20s';\nlock table public.quiz_generated_papers")
    .replace('create temporary table quiz_name_deploy_before', `create temporary table quiz_timing_deploy_before on commit drop as select ${extra} value;\ncreate temporary table quiz_name_deploy_before`)
    .replace("notify pgrst", () => `do $$begin if (select value from pg_temp.quiz_timing_deploy_before) is distinct from ${extra} then raise exception 'performance_changed_timing_or_names';end if;end$$;\nnotify pgrst`);
}
async function deploy() {
  const project = 'upxgyusodibaqcrocdzj', dir = 'automation/output/quiz/performance-deploy-20261028'; await fs.mkdir(dir, { recursive: true });
  function cli(args) {
    try { const text = execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', '& supabase-personal ' + args.map(a => "'" + a.replaceAll("'", "''") + "'").join(' ')], { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 40 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
      return JSON.parse(text.slice(Math.min(...[text.indexOf('{'), text.indexOf('[')].filter(n => n >= 0))));
    } catch (error) { writeFileSync(dir + '/error.txt', String(error.stderr || error.message), 'utf8'); throw Error('performance_cloud_operation_failed'); }
  }
  const projects = cli(['projects', 'list', '--output', 'json']);
  if (!projects.some(p => p.id === project && p.name === "chianwu-hash's Project")) throw Error('project_mismatch');
  const query = sql => cli(['db', 'query', '--linked', '--project-ref', project, sql, '--output', 'json']).rows;
  const before = query("select count(*)::int answers,(select count(*)::int from public.quiz_attempts) attempts,(select count(*)::int from public.quiz_leaf_awards) leaves from public.quiz_answers")[0];
  if (process.argv.includes('--check')) return console.log(JSON.stringify({ projectVerified: true, ...before }));
  if (!process.argv.includes('--apply')) throw Error('action_required');
  const validationPath = process.argv[process.argv.indexOf('--validation-report') + 1];
  if (!process.argv.includes('--validation-report') || !validationPath) throw Error('validation_report_required');
  const validation = JSON.parse(await fs.readFile(validationPath, 'utf8'));
  if (!validation.passed || !validation.correctnessPassed || !validation.performancePassed || validation.model !== 'actual'
    || !validation.warm_http_path_before_each_arm || !validation.results.some(r => r.count === 30)
    || validation.results.filter(r => r.count === 22).length < 6) throw Error('local_performance_gate_not_passed');
  const before30 = validation.results.find(r => r.db === 'baseline' && r.count === 30), after30 = validation.results.find(r => r.db === 'optimized' && r.count === 30);
  if (!before30 || !after30 || ['p95', 'max'].some(key => after30.http_ms[key] > before30.http_ms[key] * 1.10 + 3)) throw Error('thirty_student_gate_not_passed');
  const definitions = query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('quiz_student_identity','quiz_action','quiz_pool_catalog','quiz_wrong_questions','quiz_rewards','quiz_delete_paper','quiz_compose')");
  await fs.writeFile(dir + '/functions-before.json', JSON.stringify(definitions, null, 2));
  await fs.writeFile(dir + '/rollback.sql', 'begin;\n' + definitions.map(x => x.definition).join('\n') + "\nnotify pgrst,'reload schema';commit;\n");
  const files = Object.fromEntries(await Promise.all([['core', 'quiz.sql'], ['pool', 'quiz-pool.sql'], ['wrong', 'quiz-wrong-questions.sql'], ['rewards', 'quiz-rewards.sql']].map(async ([key, file]) => [key, await fs.readFile('supabase/' + file, 'utf8')])));
  const sql = performanceMigration(files); await fs.writeFile(dir + '/migration.sql', sql);
  cli(['db', 'query', '--linked', '--project-ref', project, '--file', path.resolve(dir + '/migration.sql'), '--output', 'json']);
  const report = { at: new Date().toISOString(), projectVerified: true, protectedDataUnchanged: true, validationReport: validationPath, before,
    privateIdentity: query("select not has_function_privilege('authenticated','public.quiz_student_identity()','execute') and not has_function_privilege('anon','public.quiz_student_identity()','execute') as private")[0].private };
  if (!report.privateIdentity) throw Error('private_identity_exposed');
  await fs.writeFile(dir + '/deployment.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) await deploy();
