// Authorized naming-only migration. Private backups and SQL reports stay in ignored output.
import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {buildNamingMigration} from '../lib/quiz-name-migration.mjs';
const project='upxgyusodibaqcrocdzj',dir='automation/output/quiz/safe-names-20261028';await fs.mkdir(dir,{recursive:true});
function cli(args){try{const result=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ')],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:40*1024*1024,stdio:['ignore','pipe','pipe']});return JSON.parse(result.slice(Math.min(...[result.indexOf('{'),result.indexOf('[')].filter(n=>n>=0))));}catch{throw Error('naming_cloud_operation_failed');}}
if(!cli(['projects','list','--output','json']).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const query=sql=>cli(['db','query','--linked','--project-ref',project,sql,'--output','json']).rows;
const preflight=query("select count(*)::int generated,count(*) filter(where s.access_mode<>'self' or s.owner_id<>g.user_id or coalesce(v.document->'catalog'->>'volume','') !~ '^[36]' or coalesce(v.document->'catalog'->>'subject','') not in ('國語','英語','數學','社會','自然'))::int invalid_metadata from public.quiz_generated_papers g join public.quiz_sessions s on s.id=g.session_id join public.quiz_versions v on v.id=s.version_id")[0];
if(preflight.invalid_metadata)throw Error('legacy_metadata_review_required');
if(process.argv.includes('--check')){console.log(JSON.stringify(preflight));process.exit(0);}
if(!process.argv.includes('--apply'))throw Error('action_required');
const backups=query('select session_id,user_id,display_name,config from public.quiz_generated_papers order by user_id,created_at,session_id');await fs.writeFile(dir+`/names-before-${Date.now()}.json`,JSON.stringify(backups,null,2),'utf8');
const sql=buildNamingMigration(await fs.readFile('supabase/quiz-pool.sql','utf8'));
await fs.writeFile(dir+'/migration.sql',sql,'utf8');cli(['db','query','--linked','--project-ref',project,'--file',path.resolve(dir+'/migration.sql'),'--output','json']);
const report={at:new Date().toISOString(),protectedDataUnchanged:true,...query("select count(*)::int generated,count(*) filter(where name_number is not null)::int named,count(*) filter(where name_number is null)::int missing_name,count(*) filter(where deleted_at is not null)::int removed_included from public.quiz_generated_papers")[0]};
if(report.missing_name)throw Error('naming_migration_incomplete');await fs.writeFile(dir+'/deployment.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
