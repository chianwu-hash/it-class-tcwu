import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
const ref='upxgyusodibaqcrocdzj',mail='chianwu@apps.ntpc.edu.tw',out='automation/output/garden-rehearsal';await fs.mkdir(out,{recursive:true});
function cli(a){const s=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+a.map(s=>"'"+s.replaceAll("'","''")+"'").join(' ')],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:16e6,stdio:['ignore','pipe','pipe']});const i=Math.min(...[s.indexOf('['),s.indexOf('{')].filter(i=>i>=0));return JSON.parse(s.slice(i));}
if(!cli(['projects','list','--output','json']).some(p=>p.id===ref&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const q=s=>cli(['db','query','--linked','--project-ref',ref,s,'--output','json']).rows;
const users=q(`select u.id,u.email,u.email_confirmed_at,e.class_code,e.seat_no,e.display_name from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where lower(u.email)='${mail}'`);
if(users.length!==1||!users[0].email_confirmed_at||!['307','609'].includes(users[0].class_code)||users[0].seat_no!==30)throw Error('unique_confirmed_test_identity_required');const u=users[0];
const protectedSql="select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('quiz_action','quiz_leaf_result','quiz_rewards','typing_foundation_action','reading_action','homework_action','switch_test_identity','reconnect_grade3_progress') order by 1";
const progressSql=`select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.course_id,p.week_code,p.activity_key)::text,'[]')) fingerprint from public.student_progress p where p.user_id='${u.id}'`;
if(process.argv.includes('--prepare')){
 const current=q(`select * from public.garden_growth where user_id='${u.id}' and course_id='grade3-115-1'`);if(current.length)throw Error('existing_growth_keep_it_for_review');
 const hashes=q(protectedSql),progress=q(progressSql);const definition=q("select pg_get_functiondef('public.garden_growth(text,text)'::regprocedure) definition")[0].definition;
 await fs.writeFile(out+'/prepare-backup.json',JSON.stringify({target:u,growth:current,hashes,progress,growthDefinition:definition},null,2));
 const body=definition.match(/AS \$(\w*)\$([\s\S]*?)\$\1\$/i)?.[2];if(!body)throw Error('collector_definition_format');
 const split=' select * into g from public.garden_growth where user_id=uid and course_id=p_course_id;';if(!body.includes(split))throw Error('collector_changed');
 const probe=body.slice(0,body.indexOf(split)).replace(/ if to_regprocedure\('public\.garden_test_rewards\(text\)'\) is not null then[\s\S]*? end if;\s*/g,'').replace(/ result := result \|\| public\.garden_test_rewards\(p_course_id\);\s*/g,'')+" return jsonb_build_object('leaves',leaves,'flowers',flowers);\nend";
 const migration=path.resolve('supabase/garden-test-setup.sql');cli(['db','query','--linked','--project-ref',ref,'--file',migration,'--output','json']);
 const sql=`begin;
do $$begin perform set_config('request.jwt.claim.sub','${u.id}',true);perform set_config('request.jwt.claims','{"sub":"${u.id}","role":"authenticated"}',true);end$$;
create function pg_temp.garden_rehearsal_counts(p_course_id text,p_action text) returns jsonb language plpgsql security definer set search_path='' as $probe$${probe}$probe$;
do $$declare n jsonb;begin
 if exists(select 1 from public.garden_test_setup where user_id='${u.id}' and course_id='grade3-115-1') then raise exception 'rehearsal_already_prepared_do_not_reset';end if;
 perform public.switch_test_identity('grade3');perform public.reconnect_grade3_progress();
 n:=pg_temp.garden_rehearsal_counts('grade3-115-1','get');
 if (n->>'leaves')::int>43 or (n->>'flowers')::int>10 then raise exception 'actual_progress_already_above_target_%',n;end if;
 insert into public.garden_test_setup(user_id,course_id,leaves,flowers) values('${u.id}','grade3-115-1',43-(n->>'leaves')::int,10-(n->>'flowers')::int);
end$$;
select t.leaves prepared_leaves,t.flowers prepared_flowers,pg_temp.garden_rehearsal_counts('grade3-115-1','get') real_progress,
 (select count(*) from jsonb_array_elements(public.garden_test_rewards('grade3-115-1')) r where r->>'kind'<>'flower') test_leaves,
 (select count(*) from jsonb_array_elements(public.garden_test_rewards('grade3-115-1')) r where r->>'kind'='flower') test_flowers,
 (select count(*) from public.garden_growth where user_id='${u.id}' and course_id='grade3-115-1') growth_events,
 (select class_code from public.student_enrollments where email='${mail}' and school_year=115) class_code
 from public.garden_test_setup t where t.user_id='${u.id}' and t.course_id='grade3-115-1';
commit;`;
 await fs.writeFile(out+'/prepare.sql',sql);const prepared=cli(['db','query','--linked','--project-ref',ref,'--file',path.resolve(out+'/prepare.sql'),'--output','json']).rows;
 if(prepared.length!==1)throw Error('setup_result_missing');const p=prepared[0],L=Number(p.real_progress.leaves)+Number(p.test_leaves),F=Number(p.real_progress.flowers)+Number(p.test_flowers);
 if(L!==43||F!==10||Number(p.growth_events)!==0||p.class_code!=='307')throw Error('pre_upgrade_assertion_failed');
 if(JSON.stringify(q(protectedSql))!==JSON.stringify(hashes))throw Error('protected_functions_changed');if(JSON.stringify(q(progressSql))!==JSON.stringify(progress))throw Error('real_student_progress_changed');
 const result={prepared:true,projectVerified:true,onlyDesignatedTestAccount:true,classCode:p.class_code,leaves:L,flowers:F,realProgress:p.real_progress,preparedLeaves:p.test_leaves,preparedFlowers:p.test_flowers,alreadyGrown:false,realProgressUnchanged:true,protectedFunctionsUnchanged:true,at:new Date().toISOString()};await fs.writeFile(out+'/prepared.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}else if(process.argv.includes('--verify')){
 const rows=q(`select e.class_code,(select leaves from public.garden_test_setup where user_id='${u.id}' and course_id='grade3-115-1') prepared_leaves,(select flowers from public.garden_test_setup where user_id='${u.id}' and course_id='grade3-115-1') prepared_flowers,(select count(*) from public.garden_growth where user_id='${u.id}' and course_id='grade3-115-1') growth_events from public.student_enrollments e where e.email='${mail}' and e.school_year=115`);console.log(JSON.stringify(rows));
}else throw Error('explicit_action_required');
