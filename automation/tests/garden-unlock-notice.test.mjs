import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {createQuizDb,studentId,TEACHER} from '../lib/quiz-local-db.mjs';
test('解鎖通知只在正式達標後出現、跨頁可領、跨分頁互斥、確認後不重播',async()=>{
 const db=await createQuizDb();try{
 await db.exec(`create table public.garden_growth(user_id uuid,course_id text,pet_unlocked_at timestamptz,primary key(user_id,course_id));create table public.notice_test_count(user_id uuid primary key,n int);
 create function public.garden_growth(p_course_id text,p_action text) returns jsonb language plpgsql security definer as $$begin
 update public.garden_growth set pet_unlocked_at=now() where user_id=auth.uid() and course_id=p_course_id and (select n from public.notice_test_count where user_id=auth.uid())>=12;
 return jsonb_build_object('petUnlocked',exists(select 1 from public.garden_growth where user_id=auth.uid() and pet_unlocked_at is not null));end$$;`);
 await db.query("insert into public.garden_growth values($1,'grade6-115-1',null)",[studentId(1)]);await db.query('insert into public.notice_test_count values($1,11)',[studentId(1)]);
 await db.exec(await fs.readFile('supabase/garden-unlock-notice.sql','utf8'));
 const call=(uid,action='pending',claim=null)=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');return (await tx.query("select public.garden_unlock_notice('grade6-115-1',$1,$2) result",[action,claim])).rows[0].result});
 assert.equal(await call(studentId(1),'check'),null);await db.query('update public.notice_test_count set n=12');assert.equal((await call(studentId(1),'check')).key,'pet-home');assert.equal((await call(studentId(1))).courseId,'grade6-115-1');assert.equal(await call(studentId(2)),null);
 const a=await call(studentId(1),'claim');assert(a.claim);assert.equal(await call(studentId(1),'claim'),null);await call(studentId(1),'ack','00000000-0000-0000-0000-000000000000');assert(await call(studentId(1)));
 await db.exec("update public.garden_unlock_notices set claim_until=now()-interval '1 minute'");const b=await call(studentId(1),'claim');assert.notEqual(b.claim,a.claim);await call(studentId(1),'ack',a.claim);assert(await call(studentId(1)));await call(studentId(1),'ack',b.claim);assert.equal(await call(studentId(1)),null);assert.equal(await call(studentId(1),'check'),null);
 await assert.rejects(call(TEACHER),/student_required/);await assert.rejects(call(''),/authentication_required/);await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.garden_unlock_notices')}),/permission denied/);
 }finally{await db.close()}
});
