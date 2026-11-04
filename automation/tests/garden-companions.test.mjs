import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
const require=createRequire('D:/projects/it-class-tcwu/tmp/quiz-runtime/package.json'),{PGlite}=require('@electric-sql/pglite');const cid='grade3-115-1';
async function setup(){const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.is_teacher() returns boolean language sql as $$select coalesce(current_setting('test.teacher',true),'')='yes'$$;
create table public.student_enrollments(school_year int,email text,class_code text);
create table public.student_progress(user_id uuid,course_id text,week_code text,activity_key text,current_level int,completed boolean);
create function public.typing_foundation_action(text,text,jsonb) returns jsonb language sql as $$select coalesce(nullif(current_setting('test.foundation',true),'')::jsonb,'[]')$$;
create function public.quiz_rewards(jsonb) returns jsonb language sql as $$select jsonb_build_object('awards',coalesce(nullif(current_setting('test.quiz',true),'')::jsonb,'[]'))$$;
create function public.homework_action(text,jsonb) returns jsonb language sql as $$select '{"assignments":[]}'::jsonb$$;
create function public.reading_action(text,jsonb) returns jsonb language sql as $$select '{"periods":[]}'::jsonb$$;
grant usage on schema public,auth to authenticated,anon;
insert into auth.users values('00000000-0000-4000-8000-000000000001','student@example.invalid',now()),('00000000-0000-4000-8000-000000000002','other@example.invalid',now());
insert into student_enrollments values(115,'student@example.invalid','304'),(115,'other@example.invalid','304');
select set_config('test.uid','00000000-0000-4000-8000-000000000001',false);`);

for(const f of ['garden-growth.sql','garden-reward-conversion.sql','garden-companions.sql','garden-level2.sql','garden-item-notice.sql'])await db.exec(await fs.readFile('supabase/'+f,'utf8'));
await db.exec(`insert into garden_reward_catalog values('grade3-115-1','01','base','typing',45,null);
insert into student_progress values(auth.uid(),'grade3-115-1','01','base',45,false);
insert into garden_reward_catalog select 'grade3-115-1','02','boss'||i,'typing',1,'boss' from generate_series(1,22)i;
insert into student_progress select auth.uid(),'grade3-115-1','02','boss'||i,1,true from generate_series(1,10)i;`);
await growth(db);return db;}
const growth=async db=>(await db.query('select garden_growth($1) r',[cid])).rows[0].r;
const notice=async(db,action='pending',claim=null)=>(await db.query('select garden_unlock_notice($1,$2,$3) r',[cid,action,claim])).rows[0].r;
const choice=async(db,action='get',data={})=>(await db.query('select garden_companions($1,$2,$3) r',[cid,action,data])).rows[0].r;
const leaves=async(db,n)=>db.query("select set_config('test.quiz',$1,false)",[JSON.stringify(Array.from({length:n},(_,i)=>({id:'award-'+i,half_units:2})))]);

test('12/24/36葉、六窩逐項解鎖，伺服器持久選擇，不提前顯示或重複建事件',async()=>{
 const db=await setup();try{
 assert.deepEqual((await choice(db)).pets,[]);
 await leaves(db,11);assert.deepEqual((await growth(db)).unlockedItems,[]);
 await leaves(db,12);assert.deepEqual((await choice(db)).pets.map(p=>p.id),['cat']);
 await assert.rejects(choice(db,'save',{pet:'dog'}),/pet_locked/);await assert.rejects(choice(db,'save',{pet:'cat',home:'c'}),/home_locked/);
 await leaves(db,18);let s=await choice(db,'save',{pet:'cat',home:'a'});assert.equal(s.selectedHome,'a');assert.equal((await choice(db)).selectedHome,'a');
 await leaves(db,24);s=await choice(db,'save',{pet:'dog',home:'a'});assert.deepEqual(s.pets.map(p=>p.id),['cat','dog']);
 await leaves(db,30);assert.equal((await choice(db,'save',{pet:'dog',home:'b'})).selectedHome,'b');
 await leaves(db,36);s=await choice(db,'save',{pet:'rabbit',home:'b'});assert.equal(s.pets.length,3);
 await leaves(db,42);assert.equal((await choice(db,'save',{pet:'rabbit',home:'a'})).selectedHome,'a');
 await leaves(db,48);s=await choice(db,'save',{pet:'rabbit',home:'c'});assert.equal(s.selectedHome,'c');assert.equal(s.homes.length,3);
 assert.equal((await db.query('select count(*)::int n from garden_item_unlocks')).rows[0].n,9);
 await growth(db);await growth(db);assert.equal((await db.query('select count(*)::int n from garden_item_notices')).rows[0].n,9);
 await assert.rejects(choice(db,'save',{pet:'cat',home:'z'}),/home_locked/);await assert.rejects(choice(db,'save',{pet:'cat',new_leaves:100}),/invalid_request/);
 await db.exec('set role authenticated');await assert.rejects(db.query("select garden_unlock_items('grade3-115-1',100,100)"),/permission denied/);await assert.rejects(db.query('select * from garden_companion_choices'),/permission denied/);await db.exec('reset role');
 }finally{await db.close()}
});

test('3/6/9花替代途徑，跨學期保留權利、低於第二級不能使用、其他人不能讀取選擇',async()=>{
 const db=await setup();try{
 for(const [n,expected,rights] of [[13,1,1],[15,1,2],[16,2,4],[18,2,5],[19,3,7],[21,3,8],[22,3,9]]){
  await db.query("insert into student_progress select auth.uid(),$1,'02','boss'||i,1,true from generate_series(11,$2)i where not exists(select 1 from student_progress s where s.user_id=auth.uid() and s.activity_key='boss'||i)",[cid,n]);
  assert.equal((await choice(db)).pets.length,expected);assert.equal((await db.query('select count(*)::int n from garden_item_unlocks')).rows[0].n,rights);
 }
 await choice(db,'save',{pet:'dog',home:'b'});assert.equal((await choice(db)).selectedPet,'dog');
 await db.exec(`insert into garden_reward_catalog select 'grade3-114-2',week_code,activity_key,kind,total_levels,reward_mode from garden_reward_catalog where course_id='grade3-115-1';insert into student_progress select user_id,'grade3-114-2',week_code,activity_key,current_level,completed from student_progress where course_id='grade3-115-1';`);
 const other=(await db.query("select garden_companions('grade3-114-2') r")).rows[0].r;assert.equal(other.selectedPet,'dog');assert.equal(other.selectedHome,'b');assert.equal(other.pets.length,3);

 await db.exec("select set_config('test.uid','00000000-0000-4000-8000-000000000002',false)");assert.deepEqual((await choice(db)).pets,[]);
 await db.exec("select set_config('test.uid','00000000-0000-4000-8000-000000000001',false);delete from student_progress where activity_key='base'");assert.deepEqual((await choice(db)).pets,[]);await assert.rejects(choice(db,'save',{pet:'dog'}),/level_two_required/);
 assert.equal((await db.query('select count(*)::int n from garden_item_unlocks')).rows[0].n,9);
 await db.exec("select set_config('test.teacher','yes',false)");await assert.rejects(choice(db),/student_required/);
 }finally{await db.close()}
});

test('多項解鎖合併、跨分頁互斥、錯誤claim不消耗、過期可重試、確認不重播',async()=>{const db=await setup();try{
 assert.equal(await notice(db,'check'),null);await leaves(db,36);const found=await notice(db,'check');assert.equal(found.items.length,7);
 const a=await notice(db,'claim');assert.equal(a.items.length,7);assert(a.claim);assert.equal(await notice(db,'claim'),null);
 await notice(db,'ack','00000000-0000-4000-8000-000000000000');assert(await notice(db));
 await db.exec("update garden_item_notices set claim_until=now()-interval '1 minute'");const b=await notice(db,'claim');assert.notEqual(a.claim,b.claim);await notice(db,'ack',a.claim);assert(await notice(db));await notice(db,'ack',b.claim);assert.equal(await notice(db,'check'),null);
 await leaves(db,42);const c=await notice(db,'check');assert.equal(c.items.length,1);assert.equal(c.items[0].key,'home:rabbit:a');
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from garden_item_notices'),/permission denied/);await db.exec('reset role');
 }finally{await db.close()}});

test('既有小貓待看通知原樣搬移，重置過的紀錄不造成外鍵錯誤，重跑不重建',async()=>{const db=await setup();try{
 await db.exec(`create table garden_unlock_notices(user_id uuid primary key,event_key text,course_id text,created_at timestamptz default now(),seen_at timestamptz,claim_id uuid,claim_until timestamptz);
 insert into garden_unlock_notices(user_id,event_key,course_id) values('00000000-0000-4000-8000-000000000002','pet-home','grade3-115-1');`);
 await db.exec(await fs.readFile('supabase/garden-companions.sql','utf8'));await db.exec(await fs.readFile('supabase/garden-companions.sql','utf8'));
 await db.exec("select set_config('test.uid','00000000-0000-4000-8000-000000000002',false)");const n=await notice(db);assert.equal(n.items.length,1);assert.equal(n.items[0].key,'pet:cat');const claim=await notice(db,'claim');await notice(db,'ack',claim.claim);assert.equal(await notice(db),null);
 await db.exec(await fs.readFile('supabase/garden-companions.sql','utf8'));assert.equal(await notice(db),null);
 }finally{await db.close()}});

test('小窩顯示偏好存資料庫、跨人隔離、重裝預設相容，拒絕未解鎖和非布林',async()=>{const db=await setup();try{
 assert.equal((await choice(db)).homeVisible,false);await assert.rejects(choice(db,'save',{homeVisible:true}),/pet_locked/);
 await leaves(db,12);await choice(db);const progressBefore=(await db.query('select * from student_progress order by user_id,course_id,activity_key')).rows;let state=await choice(db,'save',{homeVisible:true});assert.equal(state.homeVisible,true);assert.equal((await choice(db)).homeVisible,true);
 await db.exec(await fs.readFile('supabase/garden-companions.sql','utf8'));assert.equal((await choice(db)).homeVisible,true);
 state=await choice(db,'save',{homeVisible:false});assert.equal(state.homeVisible,false);assert.deepEqual((await db.query('select * from student_progress order by user_id,course_id,activity_key')).rows,progressBefore);
 for(const v of ['false',1,null,{},[]])await assert.rejects(choice(db,'save',{homeVisible:v}),/invalid_request/);
 await db.exec("select set_config('test.uid','00000000-0000-4000-8000-000000000002',false)");assert.equal((await choice(db)).homeVisible,false);
 }finally{await db.close()}});
