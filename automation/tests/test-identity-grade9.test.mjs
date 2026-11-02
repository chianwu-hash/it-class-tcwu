import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '../lib/quiz-local-db.mjs';
const tester='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
const sql=fs.readFileSync(new URL('../../supabase/test_identity_grade9.sql',import.meta.url),'utf8');
test('測試帳號四年級切換與九年級返回，拒絕其他帳號且保留進度',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;
 create table public.student_enrollments(school_year int,email text,class_code text,seat_no int,display_name text,unique(school_year,class_code,seat_no));create table public.class_card_students(course_id text,class_code text,seat_no int,display_name text,active boolean);create table public.student_progress(value text);
 insert into auth.users values('${tester}','chianwu@apps.ntpc.edu.tw',now()),('${other}','someone@example.invalid',now());insert into public.student_enrollments values(115,'chianwu@apps.ntpc.edu.tw','609',30,'合成測試');insert into public.class_card_students values('grade3-115-1','307',30,'合成卡名',true);insert into public.student_progress values('既有成果');`);
 const after=sql.match(/execute \$definition\$([^]*?)\$definition\$/)[1];const before=after.replace("  elsif p_grade='grade9' then target_class:='922';target_name:=U&'\\5433\\5C0F\\8B19';\n",'').replace("in('307','407','609','922')","in('307','407','609')");
 await db.exec(before);await db.exec('revoke all on function public.switch_test_identity(text) from public,anon;grant execute on function public.switch_test_identity(text) to authenticated;');
 await db.exec(sql);await db.exec(sql);assert.equal((await db.query("select class_code from student_enrollments")).rows[0].class_code,'609');
 const as=async(uid,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[uid]);await db.exec('set role '+role)};
 const sw=g=>db.query('select * from public.switch_test_identity($1)',[g]);await as('','anon');await assert.rejects(sw('grade9'),/permission denied/);await as(other);await assert.rejects(sw('grade9'),/not_test_account/);await assert.rejects(sw(null),/not_test_account/);
 await as(tester);assert.equal((await sw(null)).rows[0].class_code,'609');for(const [g,c] of [['grade9','922'],['grade3','307'],['grade4','407'],['grade9','922'],['grade6','609']]){const row=(await sw(g)).rows[0];assert.equal(row.class_code,c);assert.equal(row.seat_no,30)}
 await assert.rejects(sw('grade8'),/invalid_grade/);await db.exec('reset role');assert.deepEqual((await db.query('select * from student_progress')).rows,[{value:'既有成果'}]);
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[tester]);await as(tester);await assert.rejects(sw('grade9'),/not_test_account/);
 }finally{await db.close()}
});
