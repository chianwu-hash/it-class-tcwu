import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';

const migration=await readFile('supabase/quiz-partner-register-read-first.sql','utf8');
const rollback=await readFile('supabase/quiz-partner-register-read-first-rollback.sql','utf8');
const originalMd5='38ed977b2ca39d46bf998afd312eb291',newMd5='dc06cd3396d2567036e43b8c3eb2a4ea';
const metadata=async db=>(await db.query("select md5(pg_get_functiondef(oid)) md5,pg_get_functiondef(oid) definition,proacl::text acl,prosecdef,proconfig,provolatile,proisstrict,pg_get_userbyid(proowner) owner from pg_proc where oid='partner_pilot.register_self()'::regprocedure")).rows[0];

test('登錄修正與回滾只接受固定來源，保留函式擁有者與執行權限',async()=>{
 const{db}=await setupProductionQuizDB({snapshot:true});
 try{
  const before=await metadata(db);assert.equal(before.md5,originalMd5);
  await db.exec(migration);const after=await metadata(db);assert.equal(after.md5,newMd5);
  for(const key of ['acl','prosecdef','proconfig','provolatile','proisstrict','owner'])assert.deepEqual(after[key],before[key]);
  await assert.rejects(db.exec(migration),/REGISTER_SELF_SOURCE_CHANGED/);await db.exec('rollback');
  await db.exec('alter function partner_pilot.register_self() cost 101');
  await assert.rejects(db.exec(rollback),/REGISTER_SELF_ROLLBACK_SOURCE_CHANGED/);await db.exec('rollback');
  await db.exec('alter function partner_pilot.register_self() cost 100');await db.exec(rollback);
  assert.deepEqual(await metadata(db),before);
  await assert.rejects(db.exec(rollback),/REGISTER_SELF_ROLLBACK_SOURCE_CHANGED/);await db.exec('rollback');
 }finally{await db.close();}
});

test('相同本人登錄不發寫入敘述，名冊或啟用狀態變更仍同步，資格每次重新檢查',async()=>{
 const{db,uid,as}=await setupProductionQuizDB({snapshot:true});
 const admin=()=>db.exec('reset role');
 const access=async n=>{await as(n);return (await db.query('select public.quiz_partner_pilot_access() value')).rows[0].value.allowed;};
 const count=async()=>{await admin();return (await db.query('select count(*)::int n from registration_events')).rows[0].n;};
 const row=async()=>{await admin();return (await db.query('select to_jsonb(a) value from partner_pilot.allowed_users a where user_id=$1',[uid(1)])).rows[0].value;};
 try{
  await db.exec('insert into partner_pilot.settings(id,enabled) values(true,true)');
  for(let n=1;n<=2;n++){
   const email=n===2?'teacher@example.invalid':'registration@example.invalid';
   await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),email]);
   await db.query('insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values(115,$1,$2,$3,$4)',[email,'901',n,'合成登錄'+n]);
  }
  await db.exec(`create temp table registration_events(event text);create function pg_temp.registration_event() returns trigger language plpgsql security definer set search_path='' as $$begin insert into pg_temp.registration_events values(tg_op);return null;end$$;create trigger registration_events after insert or update on partner_pilot.allowed_users for each statement execute function pg_temp.registration_event();`);
  assert.equal(await access(1),true);assert((await count())>0);const before=await row();
  // Baseline executes INSERT ... ON CONFLICT even when its UPDATE WHERE is false.
  await db.exec('truncate registration_events');assert.equal(await access(1),true);assert((await count())>0);
  await db.exec(migration);await db.exec('truncate registration_events');
  assert.equal(await access(1),true);assert.equal(await count(),0);assert.deepEqual(await row(),before);
  await db.query('update public.student_enrollments set display_name=$1 where email=$2',['合成新名字','registration@example.invalid']);assert.equal(await access(1),true);assert((await row()).display_name.endsWith('合成新名字'));
  await db.query('update partner_pilot.allowed_users set active=false where user_id=$1',[uid(1)]);assert.equal(await access(1),true);assert.equal((await row()).active,true);
  const current=await row();await db.exec('truncate registration_events');await db.exec('update partner_pilot.settings set enabled=false where id');assert.equal(await access(1),false);assert.equal(await count(),0);assert.deepEqual(await row(),current);
  await db.exec('update partner_pilot.settings set enabled=true where id');assert.equal(await access(2),false);assert.equal(await access(99),false);await admin();
  await db.query("update auth.users set raw_app_meta_data='{}' where id=$1",[uid(1)]);assert.equal(await access(1),false);await admin();await db.query("update auth.users set raw_app_meta_data='{\"providers\":[\"google\"]}',email_confirmed_at=null where id=$1",[uid(1)]);assert.equal(await access(1),false);await admin();await db.query('update auth.users set email_confirmed_at=now() where id=$1',[uid(1)]);
  assert.equal(await access(1),true);await assert.rejects(db.query('select partner_pilot.register_self()'),e=>e.code==='42501');await as(null,'anon');await assert.rejects(db.query('select public.quiz_partner_pilot_access()'),e=>e.code==='42501');
 }finally{await db.close();}
});
