import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {buildFoundationMilestoneMigration} from '../lib/foundation-milestone-migration.mjs';
import {completeRows,model} from './foundation-milestones.test.mjs';
const require=createRequire(process.env.FOUNDATION_PGLITE_PACKAGE||new URL('../../tmp/quiz-runtime/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const raw=await fs.readFile(new URL('../fixtures/foundation-milestones/garden-growth-before.sql',import.meta.url),'utf8');
const id='11111111-1111-1111-1111-111111111111';
test('真實PostgreSQL：前後端同ID、舊成果補算、重跑不重複、保留已解鎖時間與權限',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${id}'::uuid$$;
 create table auth.users(id uuid,email text,email_confirmed_at timestamptz);
 insert into auth.users values('${id}','test@example.test',now());
 create table public.student_enrollments(email text,school_year int,class_code text);insert into public.student_enrollments values('test@example.test',115,'301');
 create function public.is_teacher() returns boolean language sql as $$select false$$;
 create table public.garden_reward_catalog(course_id text,week_code text,activity_key text,kind text,reward_mode text,total_levels int);
 create table public.student_progress(user_id uuid,course_id text,week_code text,activity_key text,completed boolean,current_level int);
 create table public.garden_growth(user_id uuid,course_id text,baseline jsonb default '[]',reward_order jsonb default '[]',reward_version int default 2,leaf_floor int default 44,flower_floor int default 10,seen_at timestamptz,pet_unlocked_at timestamptz,primary key(user_id,course_id));
 create table public.fixture(rows jsonb);insert into public.fixture values('[]');
 create function public.typing_foundation_action(text,text,jsonb) returns jsonb language sql as $$select rows from public.fixture$$;
 create function public.quiz_rewards(jsonb) returns jsonb language sql as $$select '{"awards":[],"flowers":[]}'::jsonb$$;
 create function public.homework_action(text,jsonb) returns jsonb language sql as $$select '{"assignments":[]}'::jsonb$$;
 create function public.reading_action(text,jsonb) returns jsonb language sql as $$select '{"periods":[]}'::jsonb$$;
 create function public.garden_unlock_items(text,int,int) returns jsonb language sql as $$select '[]'::jsonb$$;
 create function public.garden_test_rewards(text) returns jsonb language sql as $$select jsonb_agg(jsonb_build_object('id','synthetic:'||n,'kind',case when n<=20 then 'leaf' else 'flower' end)) from generate_series(1,30)n$$;`);
 await db.exec(raw+';');
 for(const r of completeRows)await db.query(`insert into public.garden_reward_catalog values($1,'foundation',$2,'foundation',null,1)`,['grade3-115-1',r.lesson_key]);
 await db.query('update public.fixture set rows=$1',[JSON.stringify(completeRows)]);
 const growth=async()=> (await db.query("select public.garden_growth('grade3-115-1') g")).rows[0].g;
 const before=await growth();assert.equal(before.level,2);assert.equal(before.petUnlocked,false);assert.equal(before.baseline.length,54);
 // Use pg_get_functiondef exactly as production retrieval does.
 const original=(await db.query("select pg_get_functiondef('public.garden_growth(text,text)'::regprocedure) d")).rows[0].d;
 const migration=buildFoundationMilestoneMigration(original);await db.exec(migration);
 const after=await growth();assert.equal(after.baseline.length,60);assert.equal(after.newFlowers,0);assert.equal(after.newLeaves,0);assert.equal(after.petUnlocked,false);
 const helper=(await db.query('select public.foundation_milestone_rewards($1,$2) rewards',['grade3-115-1',JSON.stringify(completeRows)])).rows[0].rewards;
 assert.deepEqual(helper.map(r=>r.id).sort(),model(completeRows).rewards.filter(r=>r.kind==='flower').map(r=>r.id).sort());
 await db.exec(migration);assert.deepEqual(await growth(),after);
 await db.query('update public.fixture set rows=$1',[JSON.stringify([...completeRows,{...completeRows[0],completed:false}])]);
 assert.equal((await db.query('select jsonb_array_length(public.foundation_milestone_rewards($1,$2)) n',['grade3-115-1',JSON.stringify([...completeRows,{...completeRows[0],completed:false}])])).rows[0].n,3);
 await db.query('update public.fixture set rows=$1',[JSON.stringify(completeRows)]);assert.equal((await growth()).newFlowers,0);
 await db.exec("update public.garden_growth set pet_unlocked_at='2026-10-20T00:00:00Z';");await growth();assert.equal(Date.parse((await db.query('select pet_unlocked_at::text t from public.garden_growth')).rows[0].t),Date.parse('2026-10-20T00:00:00Z'));
 // Flowers earned after activation are new effort, including for an old tree.
 await db.exec("update public.garden_growth set foundation_reward_version=0,pet_unlocked_at=null,baseline=(select jsonb_agg(v) from jsonb_array_elements(baseline) v where v->>'sourceType' is distinct from 'foundation');");
 await db.query('update public.fixture set rows=$1',[JSON.stringify(completeRows.map(r=>({...r,completed_at:'2099-01-01T00:00:00Z'})))]);
 const fresh=await growth();assert.equal(fresh.newFlowers,6);assert.equal(fresh.petUnlocked,true);assert.equal((await growth()).newFlowers,6);assert.equal(new Set(fresh.order.map(r=>r.id)).size,fresh.order.length);
 assert.deepEqual((await db.query('select public.foundation_milestone_rewards($1,$2) r',['grade4-115-1',JSON.stringify(completeRows)])).rows[0].r,[]);
 await db.exec('set role anon;');await assert.rejects(db.query("select public.foundation_milestone_rewards('grade3-115-1','[]')"),/permission denied/);await assert.rejects(db.query('select * from public.foundation_milestone_definitions'),/permission denied/);await db.exec('reset role;');
 await db.exec("update public.foundation_milestone_definitions set ordinal=999 where milestone_key='foundation-english-m04-v1'");await assert.rejects(db.exec(migration),/milestone version conflicts/);await db.exec('rollback');await db.exec("update public.foundation_milestone_definitions set ordinal=4 where milestone_key='foundation-english-m04-v1'");
 await db.exec('create or replace function public.is_teacher() returns boolean language sql as $$select true$$;');await assert.rejects(growth(),/student_required/);await db.exec('create or replace function public.is_teacher() returns boolean language sql as $$select false$$;');
 await db.exec("update public.student_enrollments set class_code='601'");await assert.rejects(growth(),/student_required/);
 await db.exec('create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$;');await assert.rejects(growth(),/authentication_required/);
 await db.exec("create or replace function public.garden_growth(p_course_id text,p_action text default 'get') returns jsonb language sql as $$select '{}'::jsonb$$;");await assert.rejects(db.exec(migration),/garden_growth changed/);await db.exec('rollback');
 }finally{await db.close();}
});
