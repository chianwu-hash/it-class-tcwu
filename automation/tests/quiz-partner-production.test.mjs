import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';
import{PGlite}from'../../tmp/quiz-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import{partnerTreeData}from'../../shared/quiz-partner-rewards.mjs';
import{wholeQuizLeaves}from'../../shared/quiz-leaf-credit.mjs';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
const configUrl='data:text/javascript;base64,'+Buffer.from(await read('shared/reward-tree-config.js')).toString('base64');
const modelSource=(await read('shared/reward-tree-model.js')).replace('./reward-tree-config.js',configUrl);
const {deriveRewardTreeModel}=await import('data:text/javascript;base64,'+Buffer.from(modelSource).toString('base64'));
const rendererSource=(await read('shared/reward-tree-renderer.js')).replace('./reward-source-colors.mjs',new URL('../../shared/reward-source-colors.mjs',import.meta.url).href).replace('./quiz-partner-rewards.mjs',new URL('../../shared/quiz-partner-rewards.mjs',import.meta.url).href);
const {safeRewardSourceHref}=await import('data:text/javascript;base64,'+Buffer.from(rendererSource).toString('base64'));
test('partner keepsake links allow only local known pages and UUID award IDs',()=>{
 for(const grade of[3,4,6,9])assert(safeRewardSourceHref(`/grade${grade}/115-1/partner-practice.html?award=${uid(1)}`));
 for(const href of['javascript:alert(1)','https://example.invalid/partner-practice.html','/grade5/115-1/partner-practice.html?award='+uid(1),'/grade3/115-1/partner-practice.html?award='+uid(1)+'&redirect=https://example.invalid'])assert(!safeRewardSourceHref(href));
});
test('partner 2/3/4 participants, correction, original tree invariants and access boundaries',async()=>{
 const db=new PGlite();const check=(v,m)=>assert(v,m);
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema realtime;create function realtime.send(jsonb,text,text,boolean) returns void language plpgsql as $$begin end$$;create function public.is_teacher() returns boolean language sql stable as $$select coalesce((select (raw_app_meta_data->>'teacher')::boolean from auth.users where id=auth.uid()),false)$$;`);
 await db.exec(await read('automation/fixtures/quiz-partner-before.sql'));
 await db.exec(`create table public.foundation_milestone_policy(id boolean,activated_at timestamptz);insert into public.foundation_milestone_policy values(true,now());`);
 for(let i=1;i<=7;i++){
  await db.query('insert into auth.users values($1,$2,now(),$3)',[uid(i),`qa${i}@example.invalid`,{providers:['google'],teacher:i===7}]);
  if(i!==5)await db.query('insert into public.student_enrollments values(115,$1,$2,$3,$4)',[`qa${i}@example.invalid`,i===6?'601':i===4?'302':'301',i,'合成夥伴'+i]);
 }
 for(const [id,total,kind,grade]of[['ten',10,'leaf',3],['twenty',20,'leaf',3],['past',12,'flower',3]]){
  const v=uid(100+total),personal=uid(200+total),practice=uid(300+total);
  if(kind==='leaf')for(const [sid,mode,classes]of[[personal,'personal',[]],[practice,'practice',['301','302']]])await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode,status,library_visible) values($1,$2,$3,115,$4,'complete',false,false,$5,'open',true)`,[sid,uid(1),v,classes,mode]);
  else await db.query('insert into public.quiz_past_papers(id,owner_id,grade,school_year,semester,title,active_version,enabled) values($1,$2,3,115,1,$3,$4,true)',['qa-past',uid(1),'合成考古卷',v]);
  await db.query('insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,source_version,is_real,source_session,past_meta) values($1,$1,$2,\'數學\',$3,$4,$1,$5,true,$6,$7)',[id,grade,kind,total,v,kind==='leaf'?personal:null,kind==='flower'?{sourcePaper:'qa-past'}:null]);
  for(let n=1;n<=total;n++){
   const q=total*100+n,manual=kind==='flower'&&n===total;
   await db.query('insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation,past_meta,past_config,past_answer) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[q,'合成題'+n,'合成情境題',['甲','乙'],0,'合成解析',manual?{kind:'manual',selfCheck:true}:null,manual?{kind:'manual'}:null,null]);
   await db.query('insert into partner_pilot.paper_items values($1,$2,$3)',[id,n,q]);
  }
 }
 const as=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?uid(n):'']);
 const call=async(n,p)=>{await as(n);return(await db.query('select public.quiz_partner_pilot_action($1) data',[{...p,requestId:p.requestId||crypto.randomUUID()}])).rows[0].data};
 const growth=async n=>{await as(n);return(await db.query("select public.garden_growth('grade3-115-1') data")).rows[0].data};
 await as(1);const old=(await db.query("select public.quiz_rewards('{}') data")).rows[0].data;const before=await growth(1);await growth(1);const baseline=(await db.query('select * from public.garden_growth where user_id=$1',[uid(1)])).rows[0];
 await db.exec(await read('supabase/quiz-partner-production.sql'));
 // Opt-in: run the whole production scenario again on top of the stability migration.
 if(process.env.QUIZ_PARTNER_STABILITY==='1')await db.exec(await read('supabase/quiz-partner-stability.sql'));
 await db.exec('update partner_pilot.settings set enabled=true where id');
 for(const n of[0,5,7])await assert.rejects(()=>call(n,{action:'catalog'}),/ACCESS_DENIED/);
 await as(1);check(!(await db.query("select has_schema_privilege('authenticated','partner_pilot','usage') ok")).rows[0].ok,'private schema not exposed');
 const team=async(members,paper)=>{
  let r=await call(members[0],{action:'create',paper,team:'合成小隊',theme:'forest',capacity:members.length});
  for(const n of members.slice(1))r=await call(n,{action:'join',roomId:r.id,code:r.code});
  for(const n of members){r=await call(n,{action:'snapshot',roomId:r.id});r=await call(n,{action:'ready',roomId:r.id,revision:r.revision,ready:true});}
  r=await call(members.at(-1),{action:'start',roomId:r.id,revision:r.revision});return r;
 };
 const answerAll=async(members,r,correct=false)=>{
  for(const n of members){const s=await call(n,{action:'snapshot',roomId:r.id});for(const q of s.exercise.mine)await call(n,{action:'answer',roomId:r.id,qid:q.id,expectedAttempt:q.attempts.length,...(q.past?.selfCheck?{value:{text:'我已核對',confirmed:true,strokes:[]}}:{choice:correct?0:1})});}
  for(const n of members)await call(n,{action:'review',roomId:r.id,text:'我記住了先想再請教。'});
  return call(members[0],{action:'finish',roomId:r.id});
 };
 const first=await team([1,2,3,4],'ten');const allocations=[];for(const n of[1,2,3,4])allocations.push((await call(n,{action:'snapshot',roomId:first.id})).exercise.mine.length);assert.deepEqual(allocations,[3,3,2,2]);
 await assert.rejects(()=>call(6,{action:'lookup',code:first.code}),/ROOM_NOT_FOUND/);
 let r=await answerAll([1,2,3,4],first,false);check(!r.exercise.award,'not awarded below threshold');
 let fixed=0;for(const n of[1,2,3,4]){const s=await call(n,{action:'snapshot',roomId:r.id});for(const q of s.exercise.mine)if(fixed++<6)r=await call(n,{action:'answer',roomId:r.id,qid:q.id,choice:0,expectedAttempt:q.attempts.length});}
 check(r.exercise.award?.leaves===1,'correction automatically awards whole team');const award=r.exercise.award.id;
 for(const n of[1,2,3,4]){await as(n);const a=(await db.query("select public.quiz_partner_rewards('grade3-115-1') data")).rows[0].data;assert.equal(a.length,1);assert.equal(a[0].id,award);const view=partnerTreeData(a,'grade3-115-1'),model=deriveRewardTreeModel(view.rows,view.activities),server=(await db.query("select public.quiz_partner_reward_ids('grade3-115-1') data")).rows[0].data;assert.deepEqual(model.rewards.map(x=>x.id),server.map(x=>x.id));}
 const after=await growth(1),stored=(await db.query('select * from public.garden_growth where user_id=$1',[uid(1)])).rows[0];assert.deepEqual(stored.baseline,baseline.baseline);assert.deepEqual(stored.grown_at,baseline.grown_at);assert.deepEqual(stored.seen_at,baseline.seen_at);assert.deepEqual(stored.pet_unlocked_at,baseline.pet_unlocked_at);assert.deepEqual(stored.reward_order.slice(0,baseline.reward_order.length),baseline.reward_order);assert.equal(after.newLeaves,before.newLeaves+1);
 await as(1);const data=(await db.query("select public.quiz_rewards('{}') data")).rows[0].data;assert.deepEqual(data.awards,old.awards);assert.deepEqual(wholeQuizLeaves(data.awards),wholeQuizLeaves(old.awards));
 r=await team([4,3,2,1],'ten');await answerAll([4,3,2,1],r,true);assert.equal((await growth(1)).newLeaves,after.newLeaves,'same set new room no extra');
 r=await team([1,2,3],'ten');await answerAll([1,2,3],r,true);assert.equal((await growth(1)).newLeaves,after.newLeaves+1,'different member set eligible');
 r=await team([1,2],'twenty');await answerAll([1,2],r,true);assert.equal((await growth(1)).newLeaves,after.newLeaves+3,'20 questions two leaves');
 r=await team([1,2,3,4],'past');r=await answerAll([1,2,3,4],r,true);assert.equal(r.exercise.gradedTotal,11);assert.equal(r.exercise.award.flowers,1);
 // A new class session after the migration is discovered and its lineage is retained.
 await db.query('insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode,status,library_visible) values($1,$2,$3,115,\'["303"]\',\'complete\',false,false,\'practice\',\'open\',true)',[uid(777),uid(1),uid(110)]);
 await db.query('update public.student_enrollments set class_code=\'303\' where email=$1',['qa4@example.invalid']);
 const fresh=await team([4,1],'ten');await db.query('update public.quiz_sessions set version_id=$1 where id=$2',[uid(998),uid(777)]);check((await call(4,{action:'snapshot',roomId:fresh.id})).exercise,'new class source link survives later version change');
 const c=await team([1,2],'ten');await db.query('update public.quiz_sessions set version_id=$1 where id=$2',[uid(999),uid(310)]);check((await call(1,{action:'snapshot',roomId:c.id})).exercise,'existing room survives version change');await assert.rejects(()=>call(1,{action:'create',paper:'ten',team:'新隊',theme:'forest',capacity:2}),/SOURCE_CHANGED/);
 await db.query('update public.quiz_sessions set status=\'closed\' where id=$1',[uid(310)]);check((await call(1,{action:'snapshot',roomId:c.id})).paused,'withdrawn source becomes read-only');await assert.rejects(()=>call(1,{action:'chat',roomId:c.id,text:'不能送出'}),/SOURCE_CHANGED/);check((await growth(1)).newLeaves>=after.newLeaves+3,'earned awards survive source withdrawal');
 // Exercise the existing, unmodified item/pet unlock code with authoritative synthetic keepsakes.
 await db.query("insert into partner_pilot.awards(content_key,member_key,members,room_id,leaves,flowers,record,course_id,school_year,semester) select 'qa-threshold-'||n,'qa-threshold',array[$1::uuid],$2::uuid,1,0,'{}','grade3-115-1',115,1 from generate_series(1,10)n",[uid(1),first.id]);
 const unlocked=await growth(1);check(unlocked.newLeaves>=12,'partner whole leaves reach the original growth threshold');check(unlocked.petUnlocked,'existing pet unlock counts partner rewards');check(unlocked.unlockedItems.length>0,'existing decoration unlock counts partner rewards');
 const notices=await db.query('select count(*)::int n from public.garden_item_notices where user_id=$1',[uid(1)]);assert(notices.rows[0].n>0);const againGrowth=await growth(1);assert.deepEqual(againGrowth.unlockedItems,unlocked.unlockedItems);assert.equal((await db.query('select count(*)::int n from public.garden_item_notices where user_id=$1',[uid(1)])).rows[0].n,notices.rows[0].n,'revisiting does not repeat item notices');
 console.log(JSON.stringify({fourPersonAllocation:allocations,wholeLeafIds:true,legacyHalfUntouched:true,automaticCorrectionAward:true,sameSetDedup:true,newSetAward:true,manualExcluded:true,normalVersionContinues:true,withdrawalReadOnly:true,testsUseSyntheticUsers:true}));
 }finally{await db.close();}
});
