// Additive, guarded preference migration. No student progress writes.
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const out='D:/projects/it-class-tcwu/automation/output/pet-rest-persistence-20261101',project='upxgyusodibaqcrocdzj';await fs.mkdir(out,{recursive:true});
async function cli(args){const {stdout}=await promisify(execFile)('pwsh',['-NoProfile','-File','D:/local-bin/supabase-personal.ps1',...args],{windowsHide:true,timeout:60000,maxBuffer:6e6});const at=Math.min(...[stdout.indexOf('{'),stdout.indexOf('[')].filter(x=>x>=0));return JSON.parse(stdout.slice(at))}
async function query(name,sql){const p=out+'/'+name+'.sql';await fs.writeFile(p,sql);return (await cli(['db','query','--linked','--project-ref',project,'--file',p,'--output','json'])).rows}
if(!(await cli(['projects','list','--output','json'])).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const tables=['student_progress','quiz_leaf_awards','quiz_past_leaves','garden_growth','garden_test_setup','quiz_integrity_settings','garden_companion_choices'];
const snapshot=`jsonb_build_object(${tables.flatMap(t=>["'"+t+"'",`(select md5(coalesce(string_agg((to_jsonb(x)-'modes')::text,'' order by (to_jsonb(x)-'modes')::text),'')) from public.${t} x)`]).join(',')},'functions',(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname<>'garden_companions'))`;
if(process.argv[2]==='prepare'){
 const before=(await query('before-readonly',`begin read only;select jsonb_build_object('definition',pg_get_functiondef('public.garden_companions(text,text,jsonb)'::regprocedure),'snapshot',${snapshot}) b;commit;`))[0].b;
 await fs.writeFile(out+'/before.private.json',JSON.stringify(before));await fs.writeFile(out+'/rollback.sql',"begin;"+before.definition+";revoke all on function public.garden_companions(text,text,jsonb) from public,anon;grant execute on function public.garden_companions(text,text,jsonb) to authenticated;notify pgrst,'reload schema';commit;");
 const body=(await fs.readFile('supabase/garden-pet-mode.sql','utf8')).replace(/^([\s\S]*?)\bbegin;/,'$1').replace(/commit;\s*$/,'');
 const sql=`begin isolation level repeatable read;set local lock_timeout='3s';set local statement_timeout='30s';lock table public.garden_companion_choices in share row exclusive mode;create temporary table pet_mode_before on commit drop as select ${snapshot} value;${body}\ndo $$begin if (select value from pg_temp.pet_mode_before) is distinct from ${snapshot} then raise exception 'pet_mode_changed_existing_data_or_functions';end if;end$$;commit;`;
 await fs.writeFile(out+'/migration.sql',sql);console.log(JSON.stringify({prepared:true,projectVerified:true}));
}else if(process.argv[2]==='apply'){
 await cli(['db','query','--linked','--project-ref',project,'--file',out+'/migration.sql','--output','json']);
 const r=(await query('after-readonly',"begin read only;select not has_function_privilege('anon','public.garden_companions(text,text,jsonb)','execute') and not has_table_privilege('authenticated','public.garden_companion_choices','update') safe;commit;"))[0];if(!r.safe)throw Error('permission_failed');
 await fs.writeFile(out+'/migration-result.json',JSON.stringify({applied:true,existingDataAndOtherFunctionsUnchanged:true,permissionsSafe:true}));console.log(JSON.stringify({applied:true,existingDataAndOtherFunctionsUnchanged:true,permissionsSafe:true}));
}else throw Error('prepare_or_apply_required');
