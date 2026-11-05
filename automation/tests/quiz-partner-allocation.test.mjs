import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '../../tmp/quiz-runtime/node_modules/@electric-sql/pglite/dist/index.js';
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('whole packs: frozen ownership, source guards, legacy rooms, retries, correction and reward',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema realtime;create function realtime.send(jsonb,text,text,boolean) returns void language plpgsql as $$begin end$$;create function public.is_teacher() returns boolean language sql stable as $$select false$$;`);
 await db.exec(await read('automation/fixtures/quiz-partner-before.sql'));
 await db.exec(`create table public.foundation_milestone_policy(id boolean,activated_at timestamptz);insert into public.foundation_milestone_policy values(true,now());
 create table public.quiz_past_versions(id uuid primary key,paper_id text,sha256 text,document jsonb);
 create table public.quiz_versions(id uuid primary key,document jsonb);
 alter table public.quiz_generated_papers add column user_id uuid,add column config jsonb,add column display_name text,add column deleted_at timestamptz,add column created_at timestamptz default now();`);
 for(let n=1;n<=5;n++){
  await db.query('insert into auth.users values($1,$2,now(),$3)',[uid(n),`allocation${n}@example.invalid`,{providers:['google']}]);
  await db.query('insert into public.student_enrollments values(115,$1,$2,$3,$4)',[`allocation${n}@example.invalid`,'301',n,'合成夥伴'+n]);
 }
 const doc={groups:Array.from({length:12},(_,n)=>({id:'g'+n,fields:[{id:'f'+n,label:String(n+1),points:1}]}))};
 await db.query(`insert into public.quiz_past_papers values('source',$1,3,115,1,'合成卷',$2,true)`,[uid(1),uid(100)]);
 await db.query(`insert into public.quiz_past_versions values($1,'source','sha',$2)`,[uid(100),doc]);
 await db.query(`insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,source_version,is_real,past_meta) values('past','合成卷',3,'數學','flower',12,'source',$1,true,'{"sourcePaper":"source"}')`,[uid(100)]);
 for(let n=0;n<12;n++){
  await db.query(`insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation,past_meta,past_config,past_answer) values($1,'合成題','合成情境','["甲","乙"]',0,'合成解析',$2,'{"kind":"single","choices":[{"id":"a"},{"id":"b"}]}','"a"')`,[n+1,{kind:'single',sourceKind:'single',group:'g'+n,label:'原題・'+(n+1),points:1,selfCheck:false}]);
  await db.query(`insert into partner_pilot.paper_items values('past',$1,$1)`,[n+1]);
 }
 await db.exec(await read('supabase/quiz-partner-production.sql'));
 await db.exec(await read('supabase/quiz-partner-stability.sql'));
 await db.exec(await read('supabase/quiz-partner-self.sql'));
 await db.exec(await read('supabase/quiz-partner-media-fix.sql'));
 await db.exec('update partner_pilot.settings set enabled=true');
 const call=async(n,p)=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?uid(n):'']);return(await db.query('select public.quiz_partner_pilot_action($1) data',[{requestId:crypto.randomUUID(),...p}])).rows[0].data;};
 let legacy=await call(1,{action:'create',paper:'past',team:'舊房',theme:'forest',capacity:2});
 legacy=await call(2,{action:'join',roomId:legacy.id,code:legacy.code});
 for(const n of [1,2])legacy=await call(n,{action:'ready',roomId:legacy.id,revision:legacy.revision,ready:true});
 legacy=await call(1,{action:'start',roomId:legacy.id,revision:legacy.revision});
 const before=(await db.query('select id,partner_pilot.owner_of($1,id) owner from partner_pilot.question_bank order by id',[legacy.id])).rows;
 let pending=await call(1,{action:'create',paper:'past',team:'舊未出發',theme:'forest',capacity:2});
 pending=await call(2,{action:'join',roomId:pending.id,code:pending.code});
 const packs=[6,3,1,1,1].map((weight,i)=>({id:'u'+i,weight,fields:Array.from({length:weight},(_,j)=>({id:'f'+([0,6,9,10,11][i]+j),group:'g'+([0,6,9,10,11][i]+j)}))}));
 const plan={version:uid(100),paper:'source',sha256:'sha',packs};
 const seed=`insert into partner_pilot.allocation_specs values('${uid(100)}','source','sha','${JSON.stringify(plan)}');`;
 await db.exec((await read('automation/templates/quiz-partner-allocation.sql')).replace('-- INSERT REVIEWED PLANS HERE',seed));
 assert.deepEqual((await db.query('select id,partner_pilot.owner_of($1,id) owner from partner_pilot.question_bank order by id',[legacy.id])).rows,before);
 for(const n of [1,2])pending=await call(n,{action:'ready',roomId:pending.id,revision:pending.revision,ready:true});
 pending=await call(1,{action:'start',roomId:pending.id,revision:pending.revision});
 assert.equal(pending.allocationVersion,0);assert.deepEqual(pending.exercise.mine.map(q=>q.id),[1,3,5,7,9,11]);
 const start=async(cap)=>{
  let r=await call(1,{action:'create',paper:'past',team:'新房',theme:'forest',capacity:cap});
  for(let n=2;n<=cap;n++)r=await call(n,{action:'join',roomId:r.id,code:r.code});
  await assert.rejects(()=>call(1,{action:'start',roomId:r.id,revision:r.revision}),/NOT_READY/);
  for(let n=1;n<=cap;n++)r=await call(n,{action:'ready',roomId:r.id,revision:r.revision,ready:true});
  const req={action:'start',roomId:r.id,revision:r.revision,requestId:crypto.randomUUID()};
  r=await call(1,req);assert.equal((await call(1,req)).id,r.id);return r;
 };
 for(const cap of [2,3,4]){
  let r=await start(cap);
  assert.equal(r.allocationVersion,1);
  const alloc=(await db.query('select * from partner_pilot.allocations where room_id=$1 order by qid',[r.id])).rows;
  assert.equal(alloc.length,12);assert.equal(new Set(alloc.map(x=>x.user_id)).size,cap);
  for(const pack of packs)assert.equal(new Set(alloc.filter(x=>x.unit_id===pack.id).map(x=>x.user_id)).size,1);
  await assert.rejects(()=>call(5,{action:'snapshot',roomId:r.id}),/NOT_MEMBER/);
  const one=alloc[0];const owner=Number(one.user_id.slice(-12));const other=owner===1?2:1;
  await assert.rejects(()=>call(other,{action:'answer',roomId:r.id,qid:one.qid,expectedAttempt:0,value:'a'}),/OWN_QUESTION_ONLY/);
  for(const action of ['ask','mark'])await assert.rejects(()=>call(other,{action,roomId:r.id,qid:one.qid,text:'QA',tag:'hard'}),/OWN_QUESTION_ONLY/);
  for(let n=1;n<=cap;n++){
   const s=await call(n,{action:'snapshot',roomId:r.id});assert(s.exercise.mine.length);
   assert.deepEqual(s.questions,s.exercise.mine.map(q=>q.number));
   assert(!JSON.stringify(s.exercise.mine).includes('合成解析'));
   for(const q of s.exercise.mine){
    const payload={action:'answer',roomId:r.id,qid:q.id,expectedAttempt:0,value:'b',requestId:crypto.randomUUID()};
    await call(n,payload);await call(n,payload);
   }
  }
  for(let n=1;n<=cap;n++)await call(n,{action:'review',roomId:r.id,text:'一起回顧'});
  r=await call(1,{action:'finish',roomId:r.id});assert.equal(r.exercise.award,null);
  for(const a of alloc.slice(0,8))r=await call(Number(a.user_id.slice(-12)),{action:'answer',roomId:r.id,qid:a.qid,expectedAttempt:1,value:'a'});
  assert.equal(r.exercise.award.flowers,1);assert.equal(r.exercise.award.leaves,0);
  assert.deepEqual((await db.query('select * from partner_pilot.allocations where room_id=$1 order by qid',[r.id])).rows,alloc);
  await assert.rejects(()=>db.query('update partner_pilot.rooms set allocation_version=0 where id=$1',[r.id]),/ALLOCATION_FROZEN/);
  await assert.rejects(()=>db.query('update partner_pilot.rooms set capacity=$1 where id=$2',[cap===4?2:4,r.id]),/ALLOCATION_FROZEN/);
  for(const sql of ["update partner_pilot.papers set total=11 where id='past'","update partner_pilot.paper_items set number=99 where paper_id='past' and number=1","update partner_pilot.question_bank set prompt='changed' where id=1"])
   await assert.rejects(()=>db.exec(sql),/ALLOCATION_SOURCE_FROZEN/);
  await db.exec('begin');await db.query('delete from partner_pilot.allocations where room_id=$1 and qid=$2',[r.id,one.qid]);
  await assert.rejects(()=>db.query('select partner_pilot.owner_of($1,$2)',[r.id,one.qid]),/ALLOCATION_UNAVAILABLE/);await db.exec('rollback');
 }
 for(const bad of [
  {...plan,version:uid(999)},
  {...plan,paper:'wrong'},
  {...plan,packs:[packs[0],packs[0],...packs.slice(2)]},
  {...plan,packs:packs.slice(1)},
  {...plan,packs:[{...packs[0],fields:[{id:'f0',group:'wrong'},...packs[0].fields.slice(1)]},...packs.slice(1)]}
 ]){
  await db.query('update partner_pilot.allocation_specs set plan=$1',[bad]);
  await assert.rejects(()=>call(1,{action:'create',paper:'past',team:'錯誤映射',theme:'forest',capacity:2}),/ALLOCATION_UNAVAILABLE/);
 }
 await db.query('update partner_pilot.allocation_specs set plan=$1',[plan]);
 await db.exec(`update partner_pilot.allocation_specs set document_sha='wrong'`);
 await assert.rejects(()=>call(1,{action:'create',paper:'past',team:'缺資料',theme:'forest',capacity:2}),/ALLOCATION_UNAVAILABLE/);
 assert.deepEqual((await db.query('select id,partner_pilot.owner_of($1,id) owner from partner_pilot.question_bank order by id',[legacy.id])).rows,before);
 for(const sig of ['allocation_items(text)','freeze_allocation()','owner_of(uuid,integer)'])assert.equal((await db.query(`select has_function_privilege('authenticated',$1,'execute') ok`,['partner_pilot.'+sig])).rows[0].ok,false);
 }finally{await db.close();}
});
