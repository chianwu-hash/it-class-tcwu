// Read-only schema/volume audit. No student names, addresses or raw user IDs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const out=path.resolve('D:/projects/it-class-tcwu/automation/output/effort-prerelease-audit-20261031');
await fs.mkdir(out,{recursive:true});
const sql=`begin read only;
set local statement_timeout='15s';set local lock_timeout='2s';
select jsonb_build_object(
 'at',clock_timestamp(),'server_version',current_setting('server_version'),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid)))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'garden_%' or p.proname in('quiz_rewards','quiz_rewards_before_past_flowers','quiz_rewards_before_past','typing_foundation_action','homework_action','reading_action'))),
 'columns',(select jsonb_agg(to_jsonb(x)) from(select table_name,column_name,data_type,udt_name,column_default,is_nullable from information_schema.columns where table_schema='public' and (table_name like 'garden_%' or table_name in('quiz_leaf_awards','quiz_past_leaves','student_progress','student_enrollments')) order by table_name,ordinal_position)x),
 'table_sizes',(select jsonb_agg(jsonb_build_object('table',relname,'estimated_rows',n_live_tup,'bytes',pg_total_relation_size(relid))) from pg_stat_user_tables where schemaname='public' and (relname like 'garden_%' or relname in('student_progress','quiz_leaf_awards','quiz_past_leaves','quiz_answers','quiz_attempts'))),
 'indexes',(select jsonb_agg(to_jsonb(x)) from(select tablename,indexname,indexdef from pg_indexes where schemaname='public' and (tablename like 'garden_%' or tablename in('student_progress','quiz_leaf_awards','quiz_past_leaves','student_enrollments')))x),
 'progress_volume',(select jsonb_agg(to_jsonb(x)) from(select course_id,count(*) rows,count(distinct user_id) students,max(current_level) max_level from public.student_progress group by course_id)x),
 'growth_volume',(select jsonb_agg(to_jsonb(x)) from(select course_id,count(*) students,max(jsonb_array_length(baseline)) max_baseline,max(jsonb_array_length(reward_order)) max_order from public.garden_growth group by course_id)x)
) audit;
commit;`;
await fs.writeFile(out+'/read-only-audit.sql',sql);
const {stdout}=await promisify(execFile)('pwsh',['-NoProfile','-NonInteractive','-File','D:/local-bin/supabase-personal.ps1','db','query','--linked','--project-ref','upxgyusodibaqcrocdzj','--file',out+'/read-only-audit.sql','--output','json'],{windowsHide:true,timeout:45000,maxBuffer:8e6});
const result=JSON.parse(stdout.slice(stdout.indexOf('{'))),audit=result.rows?.find(x=>x.audit)?.audit;
if(!audit?.columns)throw Error('audit_missing');
await fs.writeFile(out+'/schema.private.json',JSON.stringify(audit,null,2));
console.log(JSON.stringify({readOnly:true,out,functions:audit.functions.map(x=>x.signature),progressVolume:audit.progress_volume,growthVolume:audit.growth_volume}));
