import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../../tmp/week06-dbtest/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
test('foundation: trusted Grade3 Google binding, independent tracks, server unlocks, Grade6 regression',async()=>{
 const db=new PGlite(),a=randomUUID(),b=randomUUID(),c=randomUUID();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid,email text);create table student_enrollments(school_year integer,email text,class_code text,display_name text);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function is_teacher() returns boolean language sql as $$select coalesce(current_setting('test.teacher',true),'')='true'$$;
 create function grade3_google_ready() returns boolean language sql as $$select coalesce(current_setting('test.ready',true),'')='true'$$;
 insert into auth.users values('${a}','three@apps.ntpc.edu.tw'),('${b}','six@apps.ntpc.edu.tw'),('${c}','outsider@gmail.com');
 insert into student_enrollments values(115,'three@apps.ntpc.edu.tw','301','合成三年級'),(115,'six@apps.ntpc.edu.tw','601','合成六年級');`);
 await db.exec(await readFile(new URL('../../supabase/typing_foundation.sql',import.meta.url),'utf8'));
 const as=async(id,ready=false,teacher=false)=>db.query("select set_config('test.uid',$1,false),set_config('test.ready',$2,false),set_config('test.teacher',$3,false)",[id,String(ready),String(teacher)]);
 const rpc=async(action,course,p={})=>(await db.query('select typing_foundation_action($1,$2,$3::jsonb) as data',[action,course,JSON.stringify(p)])).rows[0].data;
 await as('');await assert.rejects(rpc('list','grade3-115-1'),/student_required/);
 await as(a);await assert.rejects(rpc('list','grade3-115-1'),/course_identity_required/);
 await as(c,true);await assert.rejects(rpc('list','grade3-115-1'),/roster_required/);
 await as(a,true,true);await assert.rejects(rpc('list','grade3-115-1'),/student_required/);
 await as(a,true);assert.deepEqual(await rpc('list','grade3-115-1',{include_zhuyin:true}),[]);
 await assert.rejects(rpc('start','grade3-115-1',{lesson_key:'english-top-row-v1',session_id:randomUUID()}),/lesson_locked/);
 for(const [lesson,n,final] of [['english-home-row-v1',67,117],['zhuyin-home-v1',56,96]]){
  const session=randomUUID();let r=await rpc('start','grade3-115-1',{lesson_key:lesson,session_id:session});
  assert.equal(r.learner_key,`google:${a}`);
  for(let stage=1;stage<=7;stage++)r=await rpc('save','grade3-115-1',{lesson_key:lesson,session_id:session,revision:r.revision,stage:Math.min(stage,6),correct:stage<6?n:final,errors:0,elapsed_ms:stage<6?60000:175500,interrupted:false,fingerprint:String(stage).repeat(64),event_id:randomUUID()});
  assert.equal(r.completed,true);assert.equal(r.checkpoint,5);
 }
 assert.equal((await rpc('list','grade3-115-1',{include_zhuyin:true})).length,2);
 await rpc('start','grade3-115-1',{lesson_key:'english-top-row-v1',session_id:randomUUID()});
 await rpc('start','grade3-115-1',{lesson_key:'zhuyin-top-v1',session_id:randomUUID()});
 await as(b);assert.deepEqual(await rpc('list','grade6-115-1',{include_zhuyin:true}),[]);
 await rpc('start','grade6-115-1',{session_id:randomUUID()});
 await assert.rejects(rpc('start','grade3-115-1',{session_id:randomUUID()}),/course_identity_required/);
 assert.equal((await db.query("select count(*)::int n from typing_foundation_lessons")).rows[0].n,24);
 }finally{await db.close();}
});
