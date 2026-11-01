import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {managementRead} from './lib/admin-learning-live-query.mjs';
import {buildLearningRewardsRpc} from './lib/admin-learning-production.mjs';
import {realpathSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const direct=!!process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url));
const run=promisify(execFile),out=path.resolve('automation/output/admin-learning-release-20261101');
export const project='prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb',team='team_SOhQ0oysg6ZGV9vs3RryW2CB';
export async function vercelApi(endpoint){
 const {stdout}=await run('pwsh',['-NoProfile','-File','automation/lib/admin-learning-vercel-api.ps1','-Endpoint',endpoint],{windowsHide:true,maxBuffer:24e6,timeout:60000});return JSON.parse(stdout);
}
export async function supabase(args){
 try{const {stdout}=await run('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ')],{windowsHide:true,maxBuffer:24e6,timeout:180000});return JSON.parse(stdout.slice(Math.min(...[stdout.indexOf('{'),stdout.indexOf('[')].filter(n=>n>=0))));}
 catch(e){await fs.writeFile(out+'/supabase-error.private.txt',String(e.stderr||e.message),'utf8');throw Error('supabase_operation_failed_private_log');}
}
const sha=b=>createHash('sha1').update(b).digest('hex');
await fs.mkdir(out,{recursive:true});
if(direct&&process.argv.includes('--snapshot')){
 const base=await vercelApi('/v13/deployments/it-class-tcwu.vercel.app');
 if(base.project.id!==project||base.team.id!==team||base.readyState!=='READY')throw Error('wrong_production');
 const tree=await vercelApi('/v6/deployments/'+base.id+'/files'),src=tree.find(x=>x.name==='src'),files=[];
 function walk(n,p=''){if(n.type==='directory')for(const c of n.children||[])walk(c,p+(n===src?'':n.name+'/'));else files.push({path:p+n.name,uid:n.uid});}walk(src);
 const prior='automation/output/tucheng-grade4-20261101/remaining-release/publish';
 for(const f of files){let b=await fs.readFile(path.join(prior,f.path)).catch(()=>null);if(!b||sha(b)!==f.uid)b=await fs.readFile(path.join(out,'publish',f.path)).catch(()=>null);if(!b||sha(b)!==f.uid)throw Error('refresh_source_required_'+f.path);
  const dest=path.join(out,'publish',f.path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,b);}
 await fs.writeFile(out+'/baseline.json',JSON.stringify({deployment:base.id,url:base.url,files},null,2));
 await fs.mkdir(out+'/publish/.vercel',{recursive:true});await fs.writeFile(out+'/publish/.vercel/project.json',JSON.stringify({projectId:project,orgId:team,projectName:'it-class-tcwu'}));
 console.log(JSON.stringify({baseline:base.id,files:files.length,allSourcesVerified:true}));
}
if(direct&&process.argv.includes('--prepare')){
 const source=await fs.readFile('supabase/admin_learning.sql','utf8');
 const definition=(await managementRead("select pg_get_functiondef('public.garden_item_catalog()'::regprocedure) as definition"))[0].definition;
 const rpc=buildLearningRewardsRpc(source,definition);await fs.writeFile('supabase/admin_learning_rewards.sql',rpc,'utf8');
 const protectedTables=['student_progress','typing_foundation_progress','typing_foundation_events','typing_foundation_resets','quiz_versions','quiz_attempts','quiz_answers','quiz_leaf_awards','quiz_past_leaves','quiz_past_attempts','garden_growth','garden_item_unlocks','student_enrollments'];
 const guard=`jsonb_build_object(${protectedTables.map(t=>`'${t}',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from public.${t} t)`).join(',')})`;
 const ddl=source.replace(/^.*?begin;/s,'').replace(/commit;\s*$/,'')+'\n'+rpc;
 const qa=`do $qa$declare teacher_id uuid;student_id uuid;r jsonb;begin
 select id into teacher_id from auth.users where lower(email)='chianwu@gmail.com' and email_confirmed_at is not null;
 if teacher_id is null then raise exception 'teacher_account_missing';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher_id,'role','authenticated','email','chianwu@gmail.com')::text,true);
 if public.is_teacher() is distinct from true then raise exception 'teacher_identity_failed';end if;
 r:=public.admin_learning_action('roster','grade6-115-1','{"class_code":"603","limit":1}');
 if r->>'total' is null then raise exception 'roster_failed';end if;
 r:=public.admin_learning_rewards('class_rewards','grade6-115-1','{"class_code":"603"}');
 if jsonb_array_length(r->'items')<>(r->>'total')::integer then raise exception 'partial_class';end if;
 r:=public.admin_learning_rewards('class_rewards','grade3-115-1','{"class_code":"301"}');
 if jsonb_array_length(r->'items')<>(r->>'total')::integer then raise exception 'partial_class';end if;
 if has_function_privilege('anon','public.admin_learning_rewards(text,text,jsonb)','execute') or not has_function_privilege('authenticated','public.admin_learning_rewards(text,text,jsonb)','execute')
 or has_function_privilege('authenticated','public.admin_learning_paper_rows(uuid,integer,text)','execute') then raise exception 'unsafe_permissions';end if;
 select u.id into student_id from public.student_enrollments e join auth.users u on lower(u.email)=e.email where e.school_year=115 and e.class_code='301' and u.email_confirmed_at is not null order by e.seat_no limit 1;
 if student_id is null then raise exception 'student_fixture_missing';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',student_id,'role','authenticated')::text,true);
 begin perform public.admin_learning_rewards('class_rewards','grade3-115-1','{"class_code":"301"}');raise exception 'student_was_allowed';
 exception when others then if sqlerrm<>'teacher_required' then raise;end if;end;
end $qa$;`;
 const sql=`begin isolation level repeatable read;set local lock_timeout='3s';set local statement_timeout='45s';\ncreate temporary table learning_guard on commit drop as select ${guard} value;\n${ddl}\n${qa}\ndo $guard$begin if (select value from pg_temp.learning_guard) is distinct from ${guard} then raise exception 'protected_data_changed';end if;end$guard$;\nnotify pgrst,'reload schema';\n`;
 await fs.writeFile(out+'/migration-proof.sql',sql+'rollback;','utf8');await fs.writeFile(out+'/migration-apply.sql',sql+'commit;','utf8');
 const changes=['admin-learning.html','shared/admin-learning.mjs','shared/admin-learning.css','shared/admin-learning-api.mjs','shared/admin-learning-model.mjs','shared/admin-learning-rewards.mjs','shared/admin-learning-garden.mjs'];
 for(const f of changes)await fs.copyFile(f,path.join(out,'publish',f));
 const admin=out+'/publish/admin-progress.html';let html=(await fs.readFile(admin,'utf8')).replace(/^[ \t]*<a href="\/admin-learning.html"[^\n]*\n/gm,'');const needle='                <a href="/admin-quiz.html#question-reports"';
 if(!html.includes(needle))throw Error('admin_entry_changed');html=html.replace(needle,'                <a href="/admin-learning.html" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 font-black text-emerald-700">學生學習檔案・全班花葉</a>\n'+needle);await fs.writeFile(admin,html,'utf8');changes.push('admin-progress.html');
 await fs.writeFile(out+'/changes.json',JSON.stringify(changes,null,2));console.log(JSON.stringify({prepared:true,changed:changes.length,readOnlyRpc:true}));
}
if(direct&&(process.argv.includes('--proof')||process.argv.includes('--apply'))){
 const projects=await supabase(['projects','list','--output','json']);if(!projects.some(p=>p.id==='upxgyusodibaqcrocdzj'&&p.name==="chianwu-hash's Project"))throw Error('wrong_database');
 const applying=process.argv.includes('--apply');if(applying&&!(JSON.parse(await fs.readFile(out+'/proof.json','utf8'))).passed)throw Error('proof_required');
 const definitions=await managementRead("select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_learning_action','admin_learning_rewards','admin_learning_paper_rows','admin_learning_media_access')");
 if(!applying){await fs.writeFile(out+'/functions-before.private.json',JSON.stringify(definitions,null,2));if(definitions.length)throw Error('existing_admin_rpc_needs_review');}
 const file=out+'/migration-'+(applying?'apply':'proof')+'.sql';await supabase(['db','query','--linked','--project-ref','upxgyusodibaqcrocdzj','--file',file,'--output','json']);
 await fs.writeFile(out+'/'+(applying?'applied':'proof')+'.json',JSON.stringify({passed:true,protectedDataUnchanged:true,applied:applying,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,applied:applying,protectedDataUnchanged:true}));
}
if(direct&&process.argv.includes('--source-guard')){
 const id=process.argv.at(-1);if(!/^dpl_\w+$/.test(id))throw Error('deployment_required');
 const base=JSON.parse(await fs.readFile(out+'/baseline.json','utf8')),changes=new Set(JSON.parse(await fs.readFile(out+'/changes.json','utf8')));
 const tree=await vercelApi('/v6/deployments/'+id+'/files'),src=tree.find(n=>n.name==='src'),files=[];
 function walk(n,p=''){if(n.type==='directory')for(const c of n.children||[])walk(c,p+(n===src?'':n.name+'/'));else files.push({path:p+n.name,uid:n.uid});}walk(src);
 const added=[...changes].filter(p=>!base.files.some(f=>f.path===p)).length;
 if(files.length!==base.files.length+added)throw Error('unexpected_source_count');
 for(const f of files){if(sha(await fs.readFile(path.join(out,'publish',f.path)))!==f.uid)throw Error('deployed_source_mismatch_'+f.path);
  if(!changes.has(f.path)&&base.files.find(x=>x.path===f.path)?.uid!==f.uid)throw Error('unrelated_source_changed_'+f.path);}
 const latest=await vercelApi('/v13/deployments/it-class-tcwu.vercel.app');if(![base.deployment,id].includes(latest.id))throw Error('concurrent_production_changed');
 const report={passed:true,deployment:id,baseline:base.deployment,files:files.length,changed:[...changes],allUnrelatedSourcesPreserved:true};await fs.writeFile(out+'/source-guard.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
