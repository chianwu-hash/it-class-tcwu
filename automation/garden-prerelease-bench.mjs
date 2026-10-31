// Loopback PostgreSQL, anonymous production collector inputs + labelled stress
// fixtures. Component API readers are materialized inputs: their cost, OAuth,
// PostgREST and Supabase compute are NOT measured by this benchmark.
import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {randomBytes,randomUUID,createHash} from 'node:crypto';import {performance} from 'node:perf_hooks';import assert from 'node:assert/strict';
const root=process.cwd(),source='D:/projects/it-class-tcwu/automation/output/effort-prerelease-audit-20261031',out=path.resolve(process.argv[2]||'D:/projects/it-class-tcwu/automation/output/effort-prerelease-bench-20261031/run-'+Date.now());
await fs.mkdir(out,{recursive:true});
const schema=JSON.parse(await fs.readFile(source+'/schema.private.json','utf8')),data=JSON.parse(await fs.readFile(source+'/collector-inputs.anonymous.private.json','utf8'));
const runtime=createRequire('D:/projects/it-class-tcwu/tmp/quiz-bench-runtime/package.json'),{default:EmbeddedPostgres}=await import(pathToFileURL(runtime.resolve('embedded-postgres')).href),{Client,Pool}=runtime('pg');
const port=55449,password=randomBytes(24).toString('hex');
const pg=new EmbeddedPostgres({databaseDir:out+'/pgdata',user:'postgres',password,port,persistent:true,postgresFlags:['-h','127.0.0.1','-c','max_connections=60','-c','shared_buffers=64MB','-c','track_functions=all'],initdbFlags:['--encoding=UTF8','--locale=C'],onLog:s=>fs.appendFile(out+'/postgres.log',s+'\n'),onError:s=>fs.appendFile(out+'/postgres.log',s+'\n')});
let admin,pool;const rows=[],checks=[];
const read=f=>fs.readFile(path.join(root,'supabase',f),'utf8'),sum=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function insert(c,table,records){if(!records?.length)return;await c.query(`insert into public.${table} select * from jsonb_populate_recordset(null::public.${table},$1)`,[JSON.stringify(records)])}
async function rpc(user,course,fn='garden_growth',action='get',payload={}){
 const start=performance.now(),c=await pool.connect(),acquired=performance.now();
 try{await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('statement_timeout','10000',true),set_config('lock_timeout','5000',true)",[user]);await c.query('set local role authenticated');
  const q=fn==='garden_companions'?['select public.garden_companions($1,$2,$3) r',[course,action,payload]]:fn==='garden_unlock_notice'?['select public.garden_unlock_notice($1,$2,$3) r',[course,action,payload.claim||null]]:['select public.garden_growth($1,$2) r',[course,action]];
  const r=(await c.query(...q)).rows[0].r;await c.query('commit');rows.push({fn,ms:performance.now()-start,queueMs:acquired-start,ok:true});return r;
 }catch(e){await c.query('rollback');rows.push({fn,ms:performance.now()-start,queueMs:acquired-start,ok:false,error:e.code||e.message});throw e}finally{c.release()}
}
async function input(user,kind,course,value){await admin.query('insert into garden_fixture_inputs values($1,$2,$3,$4) on conflict(user_id,kind,course_id) do update set data=excluded.data',[user,kind,course,JSON.stringify(value)])}
async function protectedHash(){return sum((await admin.query("select jsonb_build_object('progress',(select jsonb_agg(to_jsonb(s) order by user_id,course_id,week_code,activity_key) from student_progress s),'inputs',(select jsonb_agg(to_jsonb(s) order by user_id,kind,course_id) from garden_fixture_inputs s),'setup',(select jsonb_agg(to_jsonb(s) order by user_id,course_id) from garden_test_setup s),'skins',(select jsonb_agg(to_jsonb(s) order by user_id) from garden_tree_skins s)) r")).rows[0].r)}
const files=['quiz-past-flowers.sql','garden-reward-conversion.sql','garden-companions.sql','garden-level2.sql','garden-item-notice.sql','garden-tree-skin.sql'];
async function migrate(){for(const f of files)await admin.query(await read(f))}
function stats(list){const a=list.map(x=>x.ms).sort((a,b)=>a-b);return {requests:a.length,errors:list.filter(x=>!x.ok).length,p50Ms:a[Math.floor(a.length*.5)],p95Ms:a[Math.min(a.length-1,Math.floor(a.length*.95))],maxMs:a.at(-1),maxQueueMs:Math.max(...list.map(x=>x.queueMs))}}
try{
 await pg.initialise();await pg.start();admin=new Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres'});await admin.connect();pool=new Pool({host:'127.0.0.1',port,user:'postgres',password,database:'postgres',max:30});
 await admin.query(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_teacher() returns boolean language sql as $$select false$$;
 create table student_enrollments(school_year smallint,email text,class_code text,seat_no smallint,display_name text);
 create table student_progress(user_id uuid,week_code text,activity_key text,current_level integer,completed boolean,updated_at timestamptz,score smallint,course_id text);
 create table garden_fixture_inputs(user_id uuid,kind text,course_id text,data jsonb,primary key(user_id,kind,course_id));
 create table garden_test_setup(user_id uuid,course_id text,setup_id uuid,leaves int,flowers int,created_at timestamptz);
 create table quiz_past_leaves(id uuid primary key,user_id uuid,paper_id text,school_year int,semester int,attempt_id uuid,awarded_at timestamptz);
 grant usage on schema public,auth to authenticated,anon,service_role;
 create function fixture_input(k text,c text default '') returns jsonb language sql as $$select data from public.garden_fixture_inputs where user_id=auth.uid() and kind=k and course_id=c$$;
 create function quiz_rewards(jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('awards',coalesce((select jsonb_agg(a) from jsonb_array_elements(public.fixture_input('quiz'))a where a->>'grade'=substring($1->>'course_id' from 6 for 1)),'[]'))$$;
 create function quiz_past_snapshot(uuid) returns jsonb language sql as $$select '{"practice":{"leafCount":1,"history":[]}}'::jsonb$$;
 create function typing_foundation_action(text,text,jsonb) returns jsonb language sql security definer set search_path='' as $$select coalesce(public.fixture_input('foundation',$2),'[]')$$;
 create function homework_action(text,jsonb) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('assignments',coalesce(public.fixture_input('homework'),'[]'))$$;
 create function reading_action(text,jsonb) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('periods',coalesce(public.fixture_input('reading'),'[]'))$$;
 create function garden_test_rewards(text) returns jsonb language sql security definer set search_path='' as $$select coalesce(jsonb_agg(jsonb_build_object('id',t.course_id||':test-setup:'||t.setup_id||':'||x.kind||':'||x.i,'kind',x.kind)),'[]') from public.garden_test_setup t cross join lateral(select 'typing-leaf' kind,i from generate_series(1,t.leaves)i union all select 'flower',i from generate_series(1,t.flowers)i)x where t.user_id=auth.uid() and t.course_id=$1$$;`);
 const seats={3:0,6:0};for(const u of data.users){const email=u.id+'@example.invalid';await admin.query('insert into auth.users values($1,$2,$3)',[u.id,email,u.confirmed_at]);if(['3','6'].includes(u.grade)){const n=seats[u.grade]++;await admin.query('insert into student_enrollments values(115,$1,$2,$3,$4)',[email,u.grade+String(Math.floor(n/30)+1).padStart(2,'0'),n%30+1,'anonymous']);}}
 await admin.query(await read('garden-growth.sql'));
 await admin.query(schema.functions.find(f=>f.name==='garden_growth').definition);
 for(const [table,records]of [['student_progress',data.progress],['garden_reward_catalog',data.catalog],['garden_growth',data.growth],['garden_test_setup',data.test_setup]])await insert(admin,table,records);
 await admin.query(await read('garden-tree-skin.sql'));await insert(admin,'garden_tree_skins',data.skins);
 // Create only the legacy notice table/function before restoring actual notices.
 const legacy=await read('garden-unlock-notice.sql');await admin.query(legacy.slice(0,legacy.indexOf('-- Existing unlocks'))+'commit;');await insert(admin,'garden_unlock_notices',data.notices);
 for(const x of data.rewards||[])await input(x.user_id,'quiz','',x.awards);
 for(const kind of ['foundation','homework','reading'])for(const x of data[kind]||[])await input(x.user_id,kind,x.course_id||'',x.data);
 for(const i of schema.indexes.filter(x=>['student_progress','student_enrollments'].includes(x.tablename)))await admin.query(i.indexdef);
 // A testing account may hold both grade histories while its current roster
 // belongs to only one. Temporarily switch this LOCAL fake roster to inspect
 // the dormant history, then restore it; production enrollment is untouched.
 async function historical(g,fn){const email=g.user+'@example.invalid',saved=(await admin.query('select class_code,seat_no from student_enrollments where email=$1',[email])).rows[0];await admin.query('update student_enrollments set class_code=$2,seat_no=99 where email=$1',[email,g.course[5]+'99']);try{return await fn()}finally{await admin.query('update student_enrollments set class_code=$2,seat_no=$3 where email=$1',[email,saved.class_code,saved.seat_no])}}
 const grown=[];for(const g of data.growth){const row={user:g.user_id,course:g.course_id};row.old=await historical(row,()=>rpc(row.user,row.course));grown.push(row);}
 const before=await protectedHash();await migrate();assert.equal(await protectedHash(),before);checks.push('migration preserves all source inputs, progress, test setup and skins');
 const converted=[];for(const g of grown){const now=await historical(g,()=>rpc(g.user,g.course));assert.equal(now.level,g.old.level);assert.equal(now.petUnlocked,g.old.petUnlocked);converted.push({user:g.user,course:g.course,old:g.old,now});}
 const once=(await admin.query('select * from garden_growth order by user_id,course_id')).rows;
 await migrate();for(const g of grown)await historical(g,()=>rpc(g.user,g.course));assert.deepEqual((await admin.query('select * from garden_growth order by user_id,course_id')).rows,once);checks.push('existing grown levels/pets survive conversion; second migration is idempotent');
 await fs.writeFile(out+'/conversion.private.json',JSON.stringify(converted,null,2));
 // Real input volumes, 30 different students. Each page performs the same three
 // independently authenticated RPCs as the current parent/chooser/notices.
 const actual=data.users.filter(u=>u.grade==='3'&&u.confirmed_at).slice(0,30).map(u=>({user:u.id,course:'grade3-115-1'}));assert.equal(actual.length,30);
 const benchmark=[];
 for(let round=1;round<=3;round++){const start=rows.length,t=performance.now();await Promise.all(actual.flatMap(u=>[rpc(u.user,u.course),rpc(u.user,u.course,'garden_companions'),rpc(u.user,u.course,'garden_unlock_notice','check')]));benchmark.push({scenario:'anonymous-production-inputs',round,students:30,wallMs:performance.now()-t,...stats(rows.slice(start))});await fs.writeFile(out+'/progress.json',JSON.stringify(benchmark,null,2));}
 // Future-scale workload is explicitly synthetic, not evidence that today's
 // real students already have this many rewards or unlocks.
 await admin.query("insert into garden_reward_catalog select c,'bench','synthetic-boss-'||i,'typing',1,'boss' from unnest(array['grade3-115-1','grade6-115-1'])c cross join generate_series(1,10)i");
 const stress=[];for(let i=1;i<=30;i++){const id=`ffffffff-0000-4000-8000-${String(i).padStart(12,'0')}`,grade=i<=15?'3':'6',course='grade'+grade+'-115-1';await admin.query('insert into auth.users values($1,$2,now())',[id,id+'@example.invalid']);await admin.query('insert into student_enrollments values(115,$1,$2,$3,\'stress\')',[id+'@example.invalid',grade+'90',i]);await admin.query('insert into student_progress select $1,week_code,activity_key,total_levels,true,now(),null,course_id from garden_reward_catalog where course_id=$2 and kind<>\'foundation\'',[id,course]);await input(id,'quiz','',Array.from({length:120},(_,n)=>({id:id+'-'+n,grade:Number(grade),half_units:2})));assert.equal((await rpc(id,course)).level,2);await input(id,'quiz','',Array.from({length:180},(_,n)=>({id:id+'-'+n,grade:Number(grade),half_units:2})));stress.push({user:id,course});}
 for(let round=1;round<=3;round++){const start=rows.length,t=performance.now();await Promise.all(stress.flatMap(u=>[rpc(u.user,u.course),rpc(u.user,u.course,'garden_companions'),rpc(u.user,u.course,'garden_unlock_notice','check')]));benchmark.push({scenario:'synthetic-grown-180-quiz-leaves',round,students:30,wallMs:performance.now()-t,...stats(rows.slice(start))});await fs.writeFile(out+'/progress.json',JSON.stringify(benchmark,null,2));}
 // Two browser tabs race for one surprise; exactly one may claim it.
 const u=stress[0],claims=await Promise.all([rpc(u.user,u.course,'garden_unlock_notice','claim'),rpc(u.user,u.course,'garden_unlock_notice','claim')]);assert.equal(claims.filter(Boolean).length,1);await rpc(u.user,u.course,'garden_unlock_notice','ack',{claim:claims.find(Boolean).claim});assert.equal(await rpc(u.user,u.course,'garden_unlock_notice','pending'),null);checks.push('concurrent surprise claims serialize; acknowledged surprise does not repeat');
 // A held lock for one learner cannot block another learner's garden.
 const blocker=await pool.connect();await blocker.query('begin');await blocker.query("select pg_advisory_xact_lock(hashtextextended('garden-growth:'||$1,0))",[stress[0].user]);try{const t=performance.now();await rpc(stress[1].user,stress[1].course);assert(performance.now()-t<2000);checks.push('per-user advisory locks do not serialize different learners')}finally{await blocker.query('rollback');blocker.release()}
 await admin.query('set role anon');await assert.rejects(admin.query("select garden_growth('grade3-115-1')"),/permission denied/);await admin.query('reset role');checks.push('anonymous RPC access denied');
 const report={passed:true,postgres: (await admin.query('show server_version')).rows[0].server_version,scope:'local loopback PostgreSQL; actual garden functions; anonymous collector inputs; source readers materialized, no OAuth/PostgREST/cloud compute measurement',snapshotAt:data.at,actualCounts:{users:data.users.length,progress:data.progress.length,catalog:data.catalog.length,growth:data.growth.length},benchmark,checks,errors:rows.filter(x=>!x.ok)};
 await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await fs.writeFile(out+'/requests.json',JSON.stringify(rows));console.log(JSON.stringify(report));
}finally{await pool?.end();await admin?.end();await pg.stop().catch(()=>{});}
