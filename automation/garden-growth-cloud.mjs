import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
const project='upxgyusodibaqcrocdzj',out='automation/output/garden-release';await fs.mkdir(out,{recursive:true});
function cli(args){const s=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ')],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:12*1024*1024,stdio:['ignore','pipe','pipe']});const i=Math.min(...[s.indexOf('{'),s.indexOf('[')].filter(n=>n>=0));return JSON.parse(s.slice(i));}
if(!cli(['projects','list','--output','json']).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const query=s=>cli(['db','query','--linked','--project-ref',project,s,'--output','json']).rows;
const signatures=`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('quiz_action','quiz_leaf_result','quiz_rewards','typing_foundation_action','reading_action','homework_action') order by 1`;
if(process.argv.includes('--check')){
 const rows=query("select to_regprocedure('public.garden_growth(text,text)') is not null growth_exists,to_regprocedure('public.typing_foundation_action(text,text,jsonb)') is not null foundation_exists,to_regprocedure('public.quiz_rewards(jsonb)') is not null rewards_exists,to_regprocedure('public.homework_action(text,jsonb)') is not null homework_exists,to_regprocedure('public.reading_action(text,jsonb)') is not null reading_exists");
 await fs.writeFile(out+'/preflight.json',JSON.stringify({projectVerified:true,rows,hashes:query(signatures)},null,2));console.log(JSON.stringify(rows));
}else if(process.argv.includes('--apply')){
 const before=query(signatures);await fs.writeFile(out+'/protected-functions-before.json',JSON.stringify(before,null,2));
 const backup=query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='garden_growth'");await fs.writeFile(out+'/growth-before.json',JSON.stringify(backup,null,2));
 const sql=await fs.readFile('supabase/garden-growth.sql','utf8'),catalog=await fs.readFile('supabase/garden-catalog.sql','utf8');
 await fs.writeFile(out+'/migration.sql',sql+catalog);cli(['db','query','--linked','--project-ref',project,'--file',path.resolve(out+'/migration.sql'),'--output','json']);
 if(JSON.stringify(query(signatures))!==JSON.stringify(before))throw Error('protected_functions_changed');
 const check=query("select not has_function_privilege('anon','public.garden_growth(text,text)','execute') and has_function_privilege('authenticated','public.garden_growth(text,text)','execute') and not has_table_privilege('authenticated','public.garden_growth','select') and not has_table_privilege('authenticated','public.garden_reward_catalog','insert') safe,(select count(*) from public.garden_reward_catalog) catalog_count")[0];if(!check.safe)throw Error('unsafe_permissions');
 await fs.writeFile(out+'/migration-result.json',JSON.stringify({projectVerified:true,protectedFunctionsUnchanged:true,...check},null,2));console.log(JSON.stringify({applied:true,...check}));
}else throw Error('action_required');
