import fs from 'node:fs/promises';import {createRequire} from 'node:module';const require=createRequire('D:/projects/it-class-tcwu/tmp/quiz-runtime/package.json'),{PGlite}=require('@electric-sql/pglite');const cid='grade3-115-1';
export async function setup(){const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.is_teacher() returns boolean language sql as $$select coalesce(current_setting('test.teacher',true),'')='yes'$$;
create table public.student_enrollments(school_year int,email text,class_code text);
create table public.student_progress(user_id uuid,course_id text,week_code text,activity_key text,current_level int,completed boolean);
create function public.typing_foundation_action(text,text,jsonb) returns jsonb language sql as $$select coalesce(nullif(current_setting('test.foundation',true),'')::jsonb,'[]')$$;
create function public.quiz_rewards(jsonb) returns jsonb language sql as $$select jsonb_build_object('awards',coalesce(nullif(current_setting('test.quiz',true),'')::jsonb,'[]'),'flowers',coalesce(nullif(current_setting('test.flowers',true),'')::jsonb,'[]'))$$;
create function public.homework_action(text,jsonb) returns jsonb language sql as $$select '{"assignments":[]}'::jsonb$$;
create function public.reading_action(text,jsonb) returns jsonb language sql as $$select '{"periods":[]}'::jsonb$$;
grant usage on schema public,auth to authenticated,anon;
insert into auth.users values('00000000-0000-4000-8000-000000000001','student@example.invalid',now()),('00000000-0000-4000-8000-000000000002','other@example.invalid',now());
insert into student_enrollments values(115,'student@example.invalid','304'),(115,'other@example.invalid','304');
select set_config('test.uid','00000000-0000-4000-8000-000000000001',false);`);

for(const f of ['garden-growth.sql','garden-reward-conversion.sql','garden-companions.sql','garden-level2.sql','garden-item-notice.sql','garden-tree-skin.sql','garden-pet-visit.sql'])await db.exec(await fs.readFile('supabase/'+f,'utf8'));
await db.exec(`insert into garden_reward_catalog values('grade3-115-1','01','base','typing',45,null);
insert into student_progress values(auth.uid(),'grade3-115-1','01','base',45,false);
insert into garden_reward_catalog select 'grade3-115-1','02','boss'||i,'typing',1,'boss' from generate_series(1,22)i;
insert into student_progress select auth.uid(),'grade3-115-1','02','boss'||i,1,true from generate_series(1,10)i;`);
await growth(db);return db;}
export const growth=async db=>(await db.query('select garden_growth($1) r',[cid])).rows[0].r;
const notice=async(db,action='pending',claim=null)=>(await db.query('select garden_unlock_notice($1,$2,$3) r',[cid,action,claim])).rows[0].r;
const choice=async(db,action='get',data={})=>(await db.query('select garden_companions($1,$2,$3) r',[cid,action,data])).rows[0].r;
export const leaves=async(db,n)=>db.query("select set_config('test.quiz',$1,false)",[JSON.stringify(Array.from({length:n},(_,i)=>({id:'award-'+i,half_units:2})))]);
