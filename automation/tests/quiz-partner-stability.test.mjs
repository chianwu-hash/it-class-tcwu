// 2026-11-04 夥伴練功穩定性：作答重算次數、完成後獎勵仍照舊、索引存在、手寫題底圖共用媒體快取。
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';
import{PGlite}from'../../tmp/quiz-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import os from'node:os';import path from'node:path';import{pathToFileURL,fileURLToPath}from'node:url';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
// The browser modules are ES modules with a .js extension; load an exact copy as ESM in Node.
async function loadRichContent(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'partner-pilot-'));
 await fs.cp(fileURLToPath(new URL('../../shared/partner-pilot/',import.meta.url)),dir,{recursive:true});
 await fs.writeFile(path.join(dir,'package.json'),'{"type":"module"}');
 return (await import(pathToFileURL(path.join(dir,'rich-content.js')).href)).createRichContent;
}

async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema realtime;create function realtime.send(jsonb,text,text,boolean) returns void language plpgsql as $$begin end$$;create function public.is_teacher() returns boolean language sql stable as $$select coalesce((select (raw_app_meta_data->>'teacher')::boolean from auth.users where id=auth.uid()),false)$$;`);
 await db.exec(await read('automation/fixtures/quiz-partner-before.sql'));
 await db.exec(`create table public.foundation_milestone_policy(id boolean,activated_at timestamptz);insert into public.foundation_milestone_policy values(true,now());`);
 for(let i=1;i<=4;i++){
  await db.query('insert into auth.users values($1,$2,now(),$3)',[uid(i),`qa${i}@example.invalid`,{providers:['google']}]);
  await db.query('insert into public.student_enrollments values(115,$1,$2,$3,$4)',[`qa${i}@example.invalid`,'301',i,'合成夥伴'+i]);
 }
 const v=uid(110),personal=uid(210),practice=uid(310);
 for(const [sid,mode,classes]of[[personal,'personal',[]],[practice,'practice',['301']]])await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode,status,library_visible) values($1,$2,$3,115,$4,'complete',false,false,$5,'open',true)`,[sid,uid(1),v,classes,mode]);
 await db.query(`insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,source_version,is_real,source_session,past_meta) values('ten','ten',3,'數學','leaf',10,'ten',$1,true,$2,null)`,[v,personal]);
 for(let n=1;n<=10;n++){
  await db.query('insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation) values($1,$2,$3,$4,0,$5)',[1000+n,'合成題'+n,'合成情境題',['甲','乙'],'合成解析']);
  await db.query('insert into partner_pilot.paper_items values($1,$2,$3)',['ten',n,1000+n]);
 }
 await db.exec(await read('supabase/quiz-partner-production.sql'));
 await db.exec('update partner_pilot.settings set enabled=true where id');
 // Count every learning_snapshot computation. Installed before any call so no cached plan points at the old function.
 await db.exec(`create table public.qa_snapshot_calls(n int);
  alter function partner_pilot.learning_snapshot(uuid) rename to learning_snapshot_counted;
  create function partner_pilot.learning_snapshot(rid uuid) returns jsonb language plpgsql security definer set search_path to 'pg_catalog','partner_pilot' as $f$begin insert into public.qa_snapshot_calls values(1);return partner_pilot.learning_snapshot_counted(rid);end$f$;`);
 const as=n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(n)]);
 const call=async(n,p)=>{await as(n);return(await db.query('select public.quiz_partner_pilot_action($1) data',[{...p,requestId:p.requestId||crypto.randomUUID()}])).rows[0].data;};
 const counted=async(n,p)=>{await db.exec('delete from public.qa_snapshot_calls');const data=await call(n,p);return {data,snapshots:(await db.query('select count(*)::int n from public.qa_snapshot_calls')).rows[0].n};};
 const team=async members=>{
  let r=await call(members[0],{action:'create',paper:'ten',team:'合成小隊',theme:'forest',capacity:members.length});
  for(const n of members.slice(1))r=await call(n,{action:'join',roomId:r.id,code:r.code});
  for(const n of members){r=await call(n,{action:'snapshot',roomId:r.id});r=await call(n,{action:'ready',roomId:r.id,revision:r.revision,ready:true});}
  return call(members.at(-1),{action:'start',roomId:r.id,revision:r.revision});
 };
 return {db,call,counted,team};
}

test('夥伴練功：未完成小隊作答只算一次快照，完成後的獎勵與訂正補發不變',async()=>{
 const {db,call,counted,team}=await setup();
 try{
  // Before the stability migration: the production wrapper recomputes once more after action_core.
  let room=await team([1,2,3,4]);
  let mine=(await call(1,{action:'snapshot',roomId:room.id})).exercise.mine;
  const before=await counted(1,{action:'answer',roomId:room.id,qid:mine[0].id,choice:0,expectedAttempt:0});
  assert.equal(before.snapshots,2,'baseline reproduces the double recompute');

  await db.exec(await read('supabase/quiz-partner-stability.sql'));
  const after=await counted(1,{action:'answer',roomId:room.id,qid:mine[1].id,choice:0,expectedAttempt:0});
  assert.equal(after.snapshots,1,'unfinished answer computes the snapshot once');
  // The returned snapshot is complete and current: both answers are visible to their owner.
  assert.equal(after.data.exercise.submitted,2);
  assert.deepEqual(after.data.exercise.mine.slice(0,2).map(q=>q.attempts.length),[1,1]);
  // Resending the same request (lost response) writes nothing new and still computes the snapshot once.
  const body={action:'answer',roomId:room.id,qid:mine[2].id,choice:0,expectedAttempt:0,requestId:'replay-request-0001'};
  await call(1,body);
  const replay=await counted(1,body);
  assert.equal(replay.snapshots,1,'replayed request computes the snapshot once');
  assert.equal(replay.data.exercise.submitted,3);
  assert.equal((await db.query('select count(*)::int n from partner_pilot.answers where qid=$1',[mine[2].id])).rows[0].n,1,'replay does not insert another answer');

  // Finish below threshold, then correct after finishing: the award is still granted automatically (finished branch keeps claim_award).
  room=await team([1,2]);
  for(const n of[1,2]){const s=await call(n,{action:'snapshot',roomId:room.id});for(const q of s.exercise.mine)await call(n,{action:'answer',roomId:room.id,qid:q.id,choice:1,expectedAttempt:q.attempts.length});}
  for(const n of[1,2])await call(n,{action:'review',roomId:room.id,text:'先想再請教。'});
  let r=await call(1,{action:'finish',roomId:room.id});
  assert.ok(!r.exercise.award,'not awarded below threshold');
  for(const n of[1,2]){const s=await call(n,{action:'snapshot',roomId:room.id});for(const q of s.exercise.mine)r=(await call(n,{action:'answer',roomId:room.id,qid:q.id,choice:0,expectedAttempt:q.attempts.length}));}
  assert.equal(r.exercise.award?.leaves,1,'correction after finishing still awards the team');
  const awards=(await db.query('select count(*)::int n from partner_pilot.awards')).rows[0].n;assert.equal(awards,1);
 }finally{await db.close();}
});

test('夥伴練功：notes／members 的查詢索引存在',async()=>{
 const {db}=await setup();
 try{
  await db.exec(await read('supabase/quiz-partner-stability.sql'));
  await db.exec(await read('supabase/quiz-partner-stability.sql'));// re-runnable
  const names=(await db.query("select indexname from pg_indexes where schemaname='partner_pilot' and indexname like 'partner_%' order by 1")).rows.map(r=>r.indexname);
  for(const n of['partner_members_user','partner_notes_room_qid','partner_notes_room_user','partner_notes_thread'])assert.ok(names.includes(n),n);
 }finally{await db.close();}
});

test('夥伴練功：quiz_partner_rewards 改用 GIN 可用的條件，回傳完全相同、權限不變',async()=>{
 const {db,call}=await setup();
 try{
  const room=(await call(1,{action:'create',paper:'ten',team:'合成小隊',theme:'forest',capacity:2})).id;
  // Synthetic keepsakes in two courses for overlapping member sets.
  await db.query(`insert into partner_pilot.awards(content_key,member_key,members,room_id,leaves,flowers,record,course_id,school_year,semester)
   select 'qa-'||n,'k'||n,case when n%3=0 then array[$1::uuid,$2::uuid] when n%3=1 then array[$2::uuid,$3::uuid] else array[$1::uuid,$3::uuid,$4::uuid] end,$5::uuid,1,n%2,'{}',case when n%4=0 then 'grade3-115-2' else 'grade3-115-1' end,115,1 from generate_series(1,40) n`,[uid(1),uid(2),uid(3),uid(4),room]);
  const rewards=async(n,course)=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(n)]);return (await db.query('select public.quiz_partner_rewards($1) data',[course])).rows[0].data;};
  const before={};for(const n of[1,2,3,4])for(const c of['grade3-115-1','grade3-115-2'])before[n+c]=await rewards(n,c);
  await db.exec(await read('supabase/quiz-partner-stability.sql'));
  for(const n of[1,2,3,4])for(const c of['grade3-115-1','grade3-115-2'])assert.deepEqual(await rewards(n,c),before[n+c],`user ${n} ${c}`);
  assert.ok(before['1grade3-115-1'].length>0&&before['4grade3-115-1'].length>0,'fixture covers members');
  await db.exec('set enable_seqscan=off');
  const plan=(await db.query(`explain select 1 from partner_pilot.awards where members @> array['${uid(1)}'::uuid] and course_id='grade3-115-1'`)).rows;
  await db.exec('reset enable_seqscan');
  assert.match(plan.map(r=>r['QUERY PLAN']).join('\n'),/partner_awards_members/,'GIN index is usable');
  const grants=(await db.query("select has_function_privilege('authenticated','public.quiz_partner_rewards(text)','execute') a, has_function_privilege('anon','public.quiz_partner_rewards(text)','execute') b")).rows[0];
  assert.equal(grants.a,true);
  assert.equal(grants.b,false,'anonymous execution remains denied');
 }finally{await db.close();}
});

test('夥伴練功：自己已持有的 revision 廣播不再要快照，讀不懂的廣播照舊更新',async()=>{
 // app.mjs signs in on import, so test the exact function source in isolation.
 const source=(await read('shared/partner-pilot/app.mjs')).match(/function heldRevision\(message\)\{[^\r\n]*?\}(?=\r?\nasync function refresh)/)?.[0];
 assert.ok(source,'heldRevision present in app.mjs');
 let room=null;const held=new Function('getRoom',`return ${source.replace('function heldRevision','function').replace(/\broom\b/g,'getRoom()')};`)(()=>room);
 const msg=(payload,nested=false)=>nested?{payload:{payload}}:{type:'broadcast',event:'revision',payload};
 assert.equal(held(msg({room_id:'a',revision:3})),false,'no room open');
 room={id:'a',revision:5};
 assert.equal(held(msg({room_id:'a',revision:5})),true,'own mutation result already applied');
 assert.equal(held(msg({room_id:'a',revision:4})),true,'older broadcast');
 assert.equal(held(msg({room_id:'a',revision:6})),false,'teammate change');
 assert.equal(held(msg({room_id:'b',revision:1})),false,'other room');
 assert.equal(held(msg({room_id:'a',revision:5},true)),true,'nested payload shape');
 assert.equal(held(msg({room_id:'a'})),false,'no revision falls back to refresh');
 assert.equal(held(undefined),false);
});

test('夥伴練功：手寫題底圖與題目媒體共用快取，重畫不重抓、失敗不快取、換房分開',async()=>{
 const createRichContent=await loadRichContent();
 let context={room:'room-a',user:'user-1',view:'practice'},calls=0,fail=false;
 const rich=createRichContent({getQuestion:()=>null,getContext:()=>context,loadMedia:async(room,hash)=>{calls++;await new Promise(r=>setTimeout(r,5));if(fail)throw Error('offline');return {mime:'image/png',base64:'iVBORw0KGgo='+room.length+hash.length};}});
 const url='https://partner-media.invalid/'+'a'.repeat(64);
 const [x,y]=await Promise.all([rich.resolve(url),rich.resolve(url)]);
 assert.equal(x,y);assert.match(x,/^data:image\/png;base64,/);assert.equal(calls,1,'concurrent reads share one request');
 await rich.resolve(url);assert.equal(calls,1,'re-render reuses the cached data');
 await assert.rejects(()=>rich.resolve('https://example.com/x.png'),/無法讀取/);assert.equal(calls,1);
 context={room:'room-b',user:'user-1',view:'practice'};await rich.resolve(url);assert.equal(calls,2,'another room reads its own copy');
 const other='https://partner-media.invalid/'+'b'.repeat(64);fail=true;await assert.rejects(()=>rich.resolve(other),/offline/);fail=false;await rich.resolve(other);assert.equal(calls,4,'a failed read is retried, not cached');
 context=null;await assert.rejects(()=>rich.resolve(url),/無法讀取/);
});
