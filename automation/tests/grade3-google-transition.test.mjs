import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../tmp/week06-dbtest/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',x='00000000-0000-0000-0000-000000000003';
async function baseDb(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.is_teacher() returns boolean language sql as $$select false$$;
 grant usage on schema public,auth to anon,authenticated;
 create table student_enrollments(school_year smallint,email text,class_code text,seat_no smallint,display_name text,primary key(school_year,email),unique(school_year,class_code,seat_no));
 create table class_card_students(course_id text,class_code text,seat_no smallint,student_code text,display_name text,active boolean,practice_account text);
 create table guest_progress(course_id text,week_code text,activity_key text,student_code text,class_code text,seat_no smallint,display_name text,current_level integer,score smallint,completed boolean,updated_at timestamptz);
 create table student_progress(user_id uuid,course_id text,week_code text,activity_key text,current_level integer constraint student_progress_current_level_check check(current_level between 1 and 5),score smallint,completed boolean,updated_at timestamptz default now(),primary key(user_id,course_id,week_code,activity_key));
 alter table student_progress enable row level security;
 create policy own on student_progress for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 grant select,insert,update,delete on student_progress to authenticated;
 insert into auth.users values('${a}','synthetic1@apps.ntpc.edu.tw',now()),('${b}','synthetic2@apps.ntpc.edu.tw',now()),('${x}','outsider@gmail.com',now());
 insert into student_enrollments values(115,'synthetic1@apps.ntpc.edu.tw','301',1,'合成甲'),(115,'synthetic2@apps.ntpc.edu.tw','302',1,'合成乙');
 insert into class_card_students values('grade3-115-1','301',1,'30101','合成甲',true,'synthetic1'),('grade3-115-1','302',1,'30201','合成乙',true,'synthetic2');
 insert into guest_progress values('grade3-115-1','05','typing_task_5','30101','301',1,'合成甲',6,6,true,now()),('grade3-115-1','03','typing_task_6','30101','301',1,'合成甲',3,null,false,now()),('grade3-115-1','02','window_practice_5','30101','301',1,'合成甲',5,5,true,now()),('grade3-115-1','05','typing_task_5','30201','302',1,'合成乙',2,null,false,now()),('grade6-115-1','05','typing_task_5','30101','301',1,'合成甲',5,5,true,now());`);
 await db.exec("alter table class_card_students add column birthday_code text default '0101'; create function get_class_card_practice_account(text,text,smallint,text) returns text language sql as $$select 'synthetic'::text$$;");
 return db;
}
test('actual PostgreSQL migration: trusted identity, RLS, frozen history, retries, monotone merge and reset',async()=>{
 const db=await baseDb();
 try {

 const sql=await readFile(new URL('../../supabase/grade3_google_transition.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 await db.query("insert into student_progress values($1,'grade3-115-1','05','typing_task_5',4,3,false,now())",[b]);
 const as=async(uid,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[uid]);await db.exec(`set role ${role}`);};
 const reconnect=()=>db.query('select * from reconnect_grade3_progress()');
 await as('', 'anon');await assert.rejects(reconnect(),/permission denied/);
 assert.equal((await db.query("select * from verify_class_card_identity('grade3-115-1','301',1::smallint,'0101')")).rows.length,0);
 assert.equal((await db.query("select * from get_guest_progress('grade3-115-1','05','typing_task_5','301',1::smallint,'0101')")).rows.length,0);
 await assert.rejects(db.query("select get_class_card_practice_account('grade3-115-1','301',1::smallint,'0101')"),/permission denied/);
 await as(x);await assert.rejects(reconnect(),/名冊不一致/);await assert.rejects(db.query("select save_grade3_progress('06','typing_task_5',5)"),/本人舊成果/);
 await as(a);await assert.rejects(reconnect(),/尚未核對你的歷史名冊/);
 await db.exec('reset role');await db.exec("insert into grade3_google_approvals(email,student_code,display_name,history_student_code,history_display_name) values('synthetic1@apps.ntpc.edu.tw','30101','合成甲','30101','合成甲'),('synthetic2@apps.ntpc.edu.tw','30201','合成乙','30201','合成乙')");
 await as(b);await assert.rejects(reconnect(),/正式成果尚未經老師核對/);
 await db.exec('reset role');await db.query("update grade3_google_approvals set reviewed_existing_progress=(select jsonb_agg(to_jsonb(p)) from student_progress p where p.user_id=$1) where email='synthetic2@apps.ntpc.edu.tw'",[b]);
 await assert.rejects(db.query("update guest_progress set display_name='舊座號的其他人' where student_code='30201'"),/已切換/);
 // Frozen history is immutable even to the owner; identity checks use its snapshot.
 await as(a);assert.equal((await reconnect()).rows[0].student_code,'30101');
 let rows=(await db.query("select * from student_progress where course_id='grade3-115-1'")).rows;
 assert.equal(rows.length,3);assert.equal(rows.find(r=>r.week_code==='05').current_level,6);assert.equal(rows.find(r=>r.week_code==='03').score,2);
 await reconnect();await reconnect();assert.equal((await db.query('select * from student_progress')).rows.length,3);
 await assert.rejects(db.query("insert into student_progress values($1,'grade3-115-1','06','typing_task_5',5,5,true,now())",[a]),/row-level security/);
 await assert.rejects(db.query("select save_grade3_progress('06','invented',5)"),/無效/);
 await assert.rejects(db.query("select save_grade3_progress('06','typing_task_5',6)"),/無效/);
 await db.query("select save_grade3_progress('06','typing_task_5',4)");await db.query("select save_grade3_progress('06','typing_task_5',2)");
 assert.equal((await db.query("select * from get_grade3_progress('06','typing_task_5')")).rows[0].score,4);
 await db.query("select save_grade3_progress('06','typing_task_5',5)");await db.query("select save_grade3_progress('06','typing_task_5',1)");
 assert.equal((await db.query("select * from get_grade3_progress('06','typing_task_5')")).rows[0].completed,true);
 await db.query("delete from student_progress where course_id='grade3-115-1' and week_code='05'");
 assert.equal((await db.query("select * from get_grade3_progress('05','typing_task_5')")).rows.length,1);
 await db.exec('reset role');await db.query("delete from student_progress where user_id=$1 and course_id='grade3-115-1' and week_code='05'",[a]);await as(a);await reconnect();
 assert.equal((await db.query("select * from get_grade3_progress('05','typing_task_5')")).rows.length,0);
 await as(b);await reconnect();assert.equal((await db.query('select * from student_progress')).rows.length,1);
 assert.equal((await db.query("select * from get_grade3_progress('05','typing_task_5')")).rows[0].score,3);
 await as(a);assert.equal((await db.query('select * from student_progress where user_id=$1',[b])).rows.length,0);
 // Other course writes retain their existing contract.
 await db.query("insert into student_progress values($1,'grade6-115-1','01','typing_task_5',5,5,true,now())",[a]);
 await db.exec('reset role');
 await assert.rejects(db.query("update guest_progress set current_level=1 where course_id='grade3-115-1'"),/已切換/);
 await assert.rejects(db.query("delete from guest_progress where course_id='grade3-115-1'"),/已切換/);
 await db.query("update guest_progress set current_level=1 where course_id='grade6-115-1'");
 assert.equal((await db.query('select * from grade3_google_imports')).rows.length,4);
 // Changing the roster revokes future writes without silently rebinding.
 await db.query("update student_enrollments set seat_no=2 where email='synthetic1@apps.ntpc.edu.tw'");
 await as(a);await assert.rejects(db.query("select save_grade3_progress('06','typing_task_5',1)"),/本人舊成果/);
 } finally {await db.close();}
});

test('historical seats remain distinct; malformed snapshots fail atomically; teacher reset preserves audit',async()=>{
 const sql=await readFile(new URL('../../supabase/grade3_google_transition.sql',import.meta.url),'utf8');
 const approve="insert into grade3_google_approvals(email,student_code,display_name,history_student_code,history_display_name) values('synthetic2@apps.ntpc.edu.tw','30201','合成乙','30201','合成乙')";
 const as=async(db,uid)=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[uid]);await db.exec('set role authenticated');};
 const mutations=["display_name='其他人'","display_name=null","week_code='06'","activity_key='unknown'","current_level=20","score=10","completed=true,score=1","seat_no=2","completed=true,score=null","current_level=6,completed=true,score=null","current_level=null,score=1","current_level=null,score=null,completed=null"];
 for(const mutation of mutations){
  const db=await baseDb();try{
   await db.exec(`update guest_progress set ${mutation} where student_code='30201' and course_id='grade3-115-1'`);
   await db.exec("insert into guest_progress values('grade3-115-1','02','quiz_posture_5','30201','302',1,'合成乙',2,1,false,now())");
   await db.exec(sql);await db.exec(approve);await as(db,b);
   await assert.rejects(db.query('select * from reconnect_grade3_progress()'),/舊成果資料需老師查核/);
   await db.exec('reset role');
   for(const table of ['grade3_google_bindings','grade3_google_imports','student_progress'])
    assert.equal((await db.query(`select * from ${table} where user_id=$1`,[b])).rows.length,0,mutation);
  }finally{await db.close();}
 }
 const db=await baseDb();try{
  // Current seat changed; the original source remains 30201 and is never edited.
  await db.exec("update class_card_students set seat_no=2,student_code='30202' where student_code='30201';update student_enrollments set seat_no=2 where class_code='302'");
  await db.exec(sql);await db.exec(approve.replace("'30201','合成乙','30201'","'30202','合成乙','30201'"));
  await as(db,b);assert.equal((await db.query('select * from reconnect_grade3_progress()')).rows[0].student_code,'30202');
  assert.equal((await db.query("select * from get_grade3_progress('05','typing_task_5')")).rows[0].score,1);
  await db.exec('reset role');assert.equal((await db.query('select * from grade3_google_imports')).rows[0].student_code,'30201');
  await db.exec("update class_card_students set seat_no=3,student_code='30203' where student_code='30202';update student_enrollments set seat_no=3 where class_code='302'");
  await as(db,b);await assert.rejects(db.query('select * from reconnect_grade3_progress()'),/班級座號已異動/);
  await db.exec('reset role');await db.exec("update grade3_google_approvals set student_code='30203' where student_code='30202';update grade3_google_bindings set student_code='30203' where student_code='30202'");
  await as(db,b);assert.equal((await db.query('select * from reconnect_grade3_progress()')).rows[0].student_code,'30203');
  // Actual existing teacher RPC, not a mock owner DELETE.
  await db.exec('reset role');await db.exec(`create or replace function is_teacher() returns boolean language sql as $$select auth.uid()='${x}'::uuid$$`);
  const base=await readFile(new URL('../../supabase/student_progress.sql',import.meta.url),'utf8');
  const begin=base.indexOf('create or replace function public.admin_reset_progress('),end=base.indexOf('grant execute on function public.admin_reset_progress',begin);
  await db.exec(base.slice(begin,end)+"grant execute on function public.admin_reset_progress(uuid,text,text,text) to authenticated;");
  await as(db,b);await assert.rejects(db.query("select admin_reset_progress($1,'grade3-115-1','05','typing_task_5')",[b]),/not authorized/);
  assert.equal((await db.query('select * from grade3_google_imports')).rows.length,0);
  await as(db,x);assert.equal((await db.query('select * from grade3_google_imports')).rows.length,1);
  await db.query("select admin_reset_progress($1,'grade3-115-1','05','typing_task_5')",[b]);
  await as(db,b);await db.query('select * from reconnect_grade3_progress()');assert.equal((await db.query('select * from student_progress')).rows.length,0);
  await db.exec('reset role');await db.exec("update auth.users set email_confirmed_at=null where email='synthetic2@apps.ntpc.edu.tw'");
  await as(db,b);await assert.rejects(db.query('select * from reconnect_grade3_progress()'),/名冊不一致/);
 }finally{await db.close();}
 const conflict=await baseDb();try{
  await conflict.exec(sql);await conflict.exec(approve);
  await conflict.query("insert into grade3_google_bindings(student_code,history_student_code,user_id,email) values('30201','30201',$1,'synthetic1@apps.ntpc.edu.tw')",[a]);
  await as(conflict,b);await assert.rejects(conflict.query('select * from reconnect_grade3_progress()'),/其他帳號綁定|帳號綁定衝突/);
  await conflict.exec('reset role');assert.equal((await conflict.query('select * from grade3_google_imports')).rows.length,0);
 }finally{await conflict.close();}
 const residual=await baseDb();try{
  await residual.exec(sql);await residual.exec(approve);await as(residual,b);
  await residual.query('select * from reconnect_grade3_progress()');await residual.exec('reset role');
  await residual.exec('delete from grade3_google_bindings');
  await residual.query("update grade3_google_approvals set reviewed_existing_progress=(select jsonb_agg(to_jsonb(p)) from student_progress p where p.user_id=$1)",[b]);
  await as(residual,b);await assert.rejects(residual.query('select * from reconnect_grade3_progress()'),/資料綁定或匯入紀錄衝突/);
  await residual.exec('reset role');
  assert.equal((await residual.query('select * from grade3_google_bindings')).rows.length,0);
  assert.equal((await residual.query('select * from grade3_google_imports')).rows.length,1);
  assert.equal((await residual.query('select * from student_progress')).rows.length,1);
 }finally{await residual.close();}
 for(const valid of [false,true]){
  const legacy=await baseDb();try{
   await legacy.query("insert into student_progress values($1,'grade3-115-1','02','typing_task_4',4,$2,true,now())",[b,valid?null:1]);
   await legacy.exec(sql);await legacy.exec(approve);
   await legacy.query("update grade3_google_approvals set reviewed_existing_progress=(select jsonb_agg(to_jsonb(p)) from student_progress p where p.user_id=$1)",[b]);
   await as(legacy,b);
   if(valid){await legacy.query('select * from reconnect_grade3_progress()');assert.equal((await legacy.query("select * from get_grade3_progress('02','typing_task_4')")).rows[0].score,4);}
   else{await assert.rejects(legacy.query('select * from reconnect_grade3_progress()'),/正式成果尚未經老師核對/);await legacy.exec('reset role');assert.equal((await legacy.query('select * from grade3_google_imports')).rows.length,0);}
  }finally{await legacy.close();}
 }
});
