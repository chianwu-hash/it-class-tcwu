// Explicit, guarded release operation for the already authorized project.
// Backups stay in ignored output; no tokens or student rows are printed.
import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {buildLevel2Migration,GARDEN_LEVEL2_FILES} from './lib/garden-level2-release.mjs';
const project='upxgyusodibaqcrocdzj',out='D:/projects/it-class-tcwu/automation/output/effort-level2-release-20261031',exec=promisify(execFile);await fs.mkdir(out,{recursive:true});
async function cli(args){const {stdout}=await exec('pwsh',['-NoProfile','-NonInteractive','-File','D:/local-bin/supabase-personal.ps1',...args],{windowsHide:true,timeout:90000,maxBuffer:8e6});const at=Math.min(...[stdout.indexOf('{'),stdout.indexOf('[')].filter(x=>x>=0));return JSON.parse(stdout.slice(at))}
const projects=await cli(['projects','list','--output','json']);if(!projects.some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
async function query(file,sql){const p=path.join(out,file+'.sql');await fs.writeFile(p,sql,'utf8');return (await cli(['db','query','--linked','--project-ref',project,'--file',p,'--output','json'])).rows}
const protectedNames=['quiz_action','quiz_answer_guard','quiz_leaf_result','quiz_compose','quiz_past_action','quiz_student_identity','typing_foundation_action','homework_action','reading_action','is_teacher'];
const quoted=xs=>xs.map(x=>"'"+x.replaceAll("'","''")+"'").join(','),own=['quiz_rewards','quiz_past_snapshot','garden_growth','garden_unlock_notice'];
const hashes=`(select coalesce(jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))),'{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(${quoted(protectedNames)}))`;
const sourceTables=['student_progress','quiz_leaf_awards','quiz_past_leaves','quiz_integrity_settings','garden_test_setup'];
const sourceHash=`jsonb_build_object(${sourceTables.flatMap(t=>["'"+t+"'",`(select md5(coalesce(string_agg((to_jsonb(x)-'reward_kind')::text,'' order by (to_jsonb(x)-'reward_kind')::text),'')) from public.${t} x)`]).join(',')})`;
async function snapshot(){return (await query('snapshot-readonly',`begin read only;set local statement_timeout='20s';select jsonb_build_object('protected_functions',${hashes},'source_hashes',${sourceHash},'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(${quoted(own)})),'growth',(select jsonb_agg(to_jsonb(g)) from public.garden_growth g),'ready',to_regprocedure('public.garden_companions(text,text,jsonb)') is not null) backup;commit;`))[0].backup}
const action=process.argv[2];
if(action==='prepare'){
 const backup=await snapshot();await fs.writeFile(out+'/before.private.json',JSON.stringify(backup,null,2));
 const files=Object.fromEntries(await Promise.all(GARDEN_LEVEL2_FILES.map(async name=>[name,await fs.readFile('supabase/'+name,'utf8')])));await fs.writeFile(out+'/migration.sql',buildLevel2Migration(files));
 const lit=x=>"'"+String(x).replaceAll("'","''")+"'";
 const restore=(backup.growth||[]).map(g=>`update public.garden_growth set baseline=${lit(JSON.stringify(g.baseline))}::jsonb,reward_order=${lit(JSON.stringify(g.reward_order))}::jsonb,reward_version=${g.reward_version||1},leaf_floor=${g.leaf_floor??44},flower_floor=${g.flower_floor??10},seen_at=${g.seen_at?lit(g.seen_at)+'::timestamptz':'null'},pet_unlocked_at=${g.pet_unlocked_at?lit(g.pet_unlocked_at)+'::timestamptz':'null'} where user_id=${lit(g.user_id)}::uuid and course_id=${lit(g.course_id)};`).join('\n');
 await fs.writeFile(out+'/rollback.private.sql',`begin;set local lock_timeout='3s';set local statement_timeout='30s';do $$begin if ${sourceHash} is distinct from ${lit(JSON.stringify(backup.source_hashes))}::jsonb then raise exception 'new_learning_activity_requires_manual_rollback_review';end if;end$$;\n${backup.functions.map(x=>x.definition+';').join('\n')}\n${restore}\nnotify pgrst,'reload schema';commit;`);
 console.log(JSON.stringify({prepared:true,projectVerified:true,previouslyReady:backup.ready,existingGrowthRecords:backup.growth?.length||0,atomic:true}));
}else if(action==='apply'){
 const before=JSON.parse(await fs.readFile(out+'/before.private.json','utf8'));await cli(['db','query','--linked','--project-ref',project,'--file',out+'/migration.sql','--output','json']);
 const after=await snapshot();if(JSON.stringify(before.protected_functions)!==JSON.stringify(after.protected_functions)||!after.ready)throw Error('post_migration_guard_failed');
 const permissions=(await query('permissions-readonly',`begin read only;select not has_function_privilege('anon','public.garden_growth(text,text)','execute') and not has_function_privilege('anon','public.garden_companions(text,text,jsonb)','execute') and not has_table_privilege('authenticated','public.garden_companion_choices','select') and not has_function_privilege('authenticated','public.garden_unlock_items(text,integer,integer)','execute') safe;commit;`))[0];if(!permissions.safe)throw Error('permission_failed');
 // The transaction's own before/after gate proves no source records were
 // changed by this migration. Legitimate student activity between separate
 // API calls must not be mistaken for an unsafe migration or overwritten.
 const report={applied:true,projectVerified:true,protectedFunctionsUnchanged:true,learningRecordsUnchangedByMigration:true,sourceHashStableAcrossChecks:JSON.stringify(before.source_hashes)===JSON.stringify(after.source_hashes),permissionsSafe:true,at:new Date().toISOString()};await fs.writeFile(out+'/migration-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else throw Error('prepare_or_apply_required');
