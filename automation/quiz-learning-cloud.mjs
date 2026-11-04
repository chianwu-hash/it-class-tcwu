import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {randomUUID,createHash} from 'node:crypto';
const source=path.resolve(process.env.PAST_SOURCE_ROOT||process.cwd()),out=path.join(source,'automation/output/past-extension-production-20261102'),project='upxgyusodibaqcrocdzj';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),save=(p,d)=>fs.writeFileSync(path.join(out,p),JSON.stringify(d,null,2)),lit=s=>"'"+String(s).replaceAll("'","''")+"'",j=v=>lit(JSON.stringify(v))+'::jsonb';
function cli(args){try{const raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(lit).join(' ')],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:24*1024*1024,stdio:['ignore','pipe','pipe']});return JSON.parse(raw.slice(Math.min(...[raw.indexOf('{'),raw.indexOf('[')].filter(i=>i>=0))));}catch(e){fs.writeFileSync(path.join(out,'cloud-error.private.txt'),String(e.stderr||e.message));throw Error('cloud_operation_failed; inspect private error');}}
function query(sql,name='query.private.sql'){const p=path.join(out,name);fs.writeFileSync(p,sql);return cli(['db','query','--linked','--project-ref',project,'--file',p,'--output','json']).rows;}
if(!cli(['projects','list','--output','json']).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const before=read(path.join(out,'paper-before.private.json')),map=read(path.join(source,'automation/output/past-full-learning-20261101/learning-map.private.json')),packet=read(path.join(source,'automation/output/past-full-learning-20261101/publisher-practice.private.json'));
if(before.sha256!==map.documentSha256||before.id!==map.paperId||!before.enabled)throw Error('paper_mismatch');
const protectedTables=['quiz_attempts','quiz_answers','quiz_leaf_awards','quiz_past_attempts','quiz_past_answers','quiz_past_receipts','quiz_past_leaves','quiz_past_views','student_progress'];
const digest=()=>protectedTables.map(t=>`select ${lit(t)} t,count(*)::integer n,md5(coalesce(string_agg(row_to_json(x)::text,'' order by row_to_json(x)::text),'')) digest from public.${t} x`).join(' union all ');
const migration=fs.readFileSync('supabase/quiz-learning.sql','utf8').replace('\nbegin;\n','\n').replace(/\ncommit;\s*$/,'\n');
const phase=process.argv[2];
if(phase==='rollback'){
 const proof=read(path.join(out,'production-pglite-results.private.json'));
 if(!proof.passed||proof.migrationSha256!==createHash('sha256').update(fs.readFileSync('supabase/quiz-learning.sql')).digest('hex')||proof.testSha256!==createHash('sha256').update(fs.readFileSync('automation/tests/quiz-learning.test.mjs')).digest('hex'))throw Error('fresh_local_proof_required');
 const u1=randomUUID(),u2=randomUUID();let body=fs.readFileSync(path.join(out,'learning-smoke-body.private.sql'),'utf8');body=body.replaceAll('00000000-0000-4000-8001-000000000001',u1).replaceAll('00000000-0000-4000-8001-000000000002',u2);
 const sql=`begin;set local statement_timeout='90s';set transaction isolation level repeatable read;
 create temp table learning_protected_before as ${digest()};
 ${migration}
 create temp table learning_test_ids(k text primary key,v text);grant all on pg_temp.learning_test_ids to authenticated;
 create function pg_temp.learning_remap(d jsonb) returns jsonb language plpgsql as $remap$ declare x record;s text:=d::text;begin for x in select * from pg_temp.learning_test_ids loop s:=replace(s,x.k,x.v);end loop;return s::jsonb;end$remap$;
 insert into auth.users(id,email,email_confirmed_at) values(${lit(u1)},${lit('learning-'+u1+'@example.invalid')},clock_timestamp()),(${lit(u2)},${lit('learning-'+u2+'@example.invalid')},clock_timestamp());
 insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values(115,${lit('learning-'+u1+'@example.invalid')},'301',98,'合成回復測試1'),(115,${lit('learning-'+u2+'@example.invalid')},'301',99,'合成回復測試2');
 ${body}
 do $$begin
 if(select count(*) from public.quiz_learning_credits where user_id in(${lit(u1)},${lit(u2)}))<>20 then raise exception 'credit_count';end if;
 if(select count(*) from public.quiz_learning_leaves where user_id in(${lit(u1)},${lit(u2)}))<>2 then raise exception 'leaf_count';end if;
 if(select count(*) from public.quiz_past_leaves where user_id in(${lit(u1)},${lit(u2)}))<>1 then raise exception 'original_flower_count';end if;
 if(select count(*) from public.quiz_leaf_awards where user_id in(${lit(u1)},${lit(u2)}))<>1 then raise exception 'ordinary_leaf_count';end if;
 if exists(select 1 from public.admin_learning_paper_rows(${lit(u1)},115,'301') p join public.quiz_learning_sessions l on l.session_id=p.session_id) then raise exception 'teacher_private_session_leak';end if;
 end$$;
 rollback;
 select count(*)::integer remaining from auth.users where id in(${lit(u1)},${lit(u2)});`;
 const first=query(digest());const result=query(sql,'rollback-smoke.private.sql');const after=query(digest());
 if(JSON.stringify(first)!==JSON.stringify(after)||result.at(-1).remaining!==0)throw Error('rollback_data_changed');
 save('cloud-rollback.private.json',{passed:true,migrationSha256:proof.migrationSha256,testSha256:proof.testSha256,project,before:first,after,fakeUsersRemoved:true,at:new Date().toISOString()});console.log('PASS real PostgreSQL rollback: mixed/five/extension and existing student rows unchanged');
}else if(phase==='apply'){
 if(fs.existsSync(path.join(out,'cloud-applied.private.json')))throw Error('already_applied');
 const rollback=read(path.join(out,'cloud-rollback.private.json'));
 if(!rollback.passed||rollback.migrationSha256!==createHash('sha256').update(fs.readFileSync('supabase/quiz-learning.sql')).digest('hex')||rollback.testSha256!==createHash('sha256').update(fs.readFileSync('automation/tests/quiz-learning.test.mjs')).digest('hex'))throw Error('fresh_cloud_rollback_required');
 const current=query(`select active_version,enabled from public.quiz_past_papers where id=${lit(before.id)}`)[0];if(current.active_version!==before.active_version||!current.enabled)throw Error('active_paper_changed');
 const original=read(path.join(out,'functions-before.private.json'));const live=query("select p.proname,md5(pg_get_functiondef(p.oid)) hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quiz_%'");if(live.some(f=>original.find(o=>o.proname===f.proname)?.hash!==f.hash))throw Error('live_functions_changed');
 const teacherBefore=read(path.join(out,'admin-live.private.json')).rows;
 const teacherNow=query("select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin_learning%'");
 if(teacherBefore.length!==teacherNow.length||teacherNow.some(f=>teacherBefore.find(o=>o.proname===f.proname)?.definition!==f.definition))throw Error('teacher_projection_changed');
 let sql=`begin;set local statement_timeout='60s';set transaction isolation level repeatable read;create temp table learning_protected_before as ${digest()};\n${migration}\n`;
 sql+=`insert into public.quiz_learning_maps values(${lit(before.active_version)},${lit(before.id)},${lit(before.sha256)},${j(map)},false);\n`;
 const planned=[];
 for(const [concept,e] of Object.entries(packet.documents)){
  const bank=randomUUID(),version=randomUUID();planned.push({concept,bank,version,sha256:createHash('sha256').update(JSON.stringify(e.document)).digest('hex')});
  sql+=`select public.quiz_validate(${j(e.document)});insert into public.quiz_banks(id,owner_id,draft) values(${lit(bank)},${lit(before.owner_id)},${j(e.document)});insert into public.quiz_versions(id,bank_id,revision,document) values(${lit(version)},${lit(bank)},1,${j(e.document)});insert into public.quiz_learning_topics values(${lit(before.active_version)},${lit(concept)},${lit(version)});\n`;
 }
 sql+=`do $$begin if exists(select * from learning_protected_before except ${digest()}) or exists(${digest()} except select * from learning_protected_before) then raise exception 'protected_data_changed';end if;end$$;commit;`;
 query(sql,'apply.private.sql');save('cloud-applied.private.json',{project,sourceVersion:before.active_version,sha256:before.sha256,planned,enabled:false,studentDataUnchanged:true,at:new Date().toISOString()});console.log('Registered disabled learning adapter and 22 fixed practice versions; student data unchanged.');
}else if(phase==='activate'){
 const receipt=read(path.join(out,'cloud-applied.private.json'));if(!fs.existsSync(path.join(out,'candidate-verified.private.json')))throw Error('candidate_proof_required');
 query(`begin;update public.quiz_learning_maps set enabled=true where source_version=${lit(receipt.sourceVersion)};update public.quiz_learning_settings set enabled=true,enabled_at=clock_timestamp() where id;commit;`,'activate.private.sql');save('cloud-activated.private.json',{sourceVersion:receipt.sourceVersion,at:new Date().toISOString()});console.log('Activated exact verified learning version.');
}else throw Error('phase_required');
