import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(path.join(process.env.TEMP,'codex-drive-validation','package.json'));
const {PGlite}=require('@electric-sql/pglite');
const t='00000000-0000-0000-0000-000000000001',u='00000000-0000-0000-0000-000000000002',o='00000000-0000-0000-0000-000000000003',unknown='00000000-0000-0000-0000-000000000004';
test('reading real SQL: optional roster, periods, retries, immutable history, isolated owners, stale reviews',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function public.is_teacher() returns boolean language sql as $$select auth.uid()='${t}'::uuid$$;create table public.student_enrollments(school_year smallint,email text,class_code text,seat_no smallint,display_name text);insert into auth.users values('${t}','teacher@test',now()),('${u}','u@test',now()),('${o}','o@test',now()),('${unknown}','unknown@test',now());insert into public.student_enrollments values(115,'u@test','603',1,'U'),(115,'o@test','604',2,'O');grant usage on schema public,auth to anon,authenticated,service_role;`);
 const sql=await readFile(new URL('../../supabase/reading.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const as=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec(`set role ${role}`);};
 const call=async(a,d={})=>(await db.query('select public.reading_action($1,$2) as data',[a,JSON.stringify(d)])).rows[0].data;
 await as('', 'anon');await assert.rejects(call('list'),/permission denied/);
 await as(unknown);await assert.rejects(call('list'),/roster_required/);
 await as(t);await call('configure',{week_code:'02',starts_on:'2026-08-03',ends_on:'2026-08-09'});await call('configure',{week_code:'04',starts_on:'2026-08-17',ends_on:'2026-08-23'});
 await assert.rejects(call('configure',{week_code:'03',starts_on:'2026-08-08',ends_on:'2026-08-14'}),/period_overlap/);
 const periods=(await call('list')).periods;assert.deepEqual(periods.map(p=>p.week_code),['02','04']);const a=periods[0].id,b=periods[1].id;
 assert.equal((await call('roster',{period_id:a})).students.length,0);
 await as(u);for(const table of ['reading_periods','reading_versions','reading_submissions','reading_events'])await assert.rejects(db.query(`select * from public.${table}`),/permission denied/);
 await assert.rejects(call('configure',{week_code:'05'}),/teacher_required/);
 await assert.rejects(call('roster',{period_id:a}),/teacher_required/);
 const first={period_id:a,id:crypto.randomUUID(),source:'school_library',book:'Book',reflection:'My thought',user_id:o};
 await call('submit',first);await call('submit',first);
 assert.equal((await call('history',{period_id:a,user_id:o})).versions.length,1);
 await assert.rejects(call('submit',{...first,book:'Changed'}),/submission_conflict/);
 await assert.rejects(call('submit',{...first,id:crypto.randomUUID()}),/version_changed/);
 await as(o);assert.equal((await call('history',{period_id:a,user_id:u})).versions.length,0);await assert.rejects(call('submit',first),/submission_conflict/);
 await as(u);await call('submit',{...first,period_id:b,id:crypto.randomUUID()});assert.equal((await call('list')).periods.filter(p=>p.submission).length,2);
 await as(t);const roster=(await call('roster',{period_id:a})).students;assert.equal(roster.length,1);assert.equal(roster[0].user_id,u);
 const review={period_id:a,user_id:u,version_id:first.id,review_seq:0,status:'passed'};await call('review',review);await assert.rejects(call('review',review),/review_changed/);
 await call('review',{...review,review_seq:1,status:'submitted',feedback:'Please add more'});
 await call('review',{...review,review_seq:2,status:'passed'});
 await assert.rejects(call('configure',{week_code:'02',starts_on:'2026-08-04',ends_on:'2026-08-09'}),/period_has_submissions/);
 await as(u);await assert.rejects(call('review',{...review,review_seq:3}),/teacher_required/);
 const second={...first,id:crypto.randomUUID(),expected_version:first.id,reflection:'New thought'};await call('submit',second);await call('submit',first);
 const hist=(await call('history',{period_id:a})).versions;assert.equal(hist.length,2);assert.equal(hist.find(v=>v.latest).id,second.id);assert.equal(hist.find(v=>v.id===first.id).reflection,'My thought');assert.equal(hist.find(v=>v.latest).status,'submitted');
 await as(t);await assert.rejects(call('review',{...review,review_seq:3}),/version_changed/);
 await call('configure',{week_code:'02',starts_on:'2026-08-03',ends_on:'2026-08-09',enabled:false});
 await as(u);await assert.rejects(call('submit',{...second,id:crypto.randomUUID(),expected_version:second.id}),/period_unavailable/);assert.equal((await call('history',{period_id:a})).versions.length,2);
 }finally{await db.close();}
});

test('homework/reading use 2 leaves, retract returns 1; typing still 4 leaves and 1 flower',async()=>{
 let code=await readFile(new URL('../../shared/reward-tree-model.js',import.meta.url),'utf8');code=code.replace('import { getActivityId } from "./reward-tree-config.js";',"const getActivityId=(w,k,c)=>[c,w,k].join(':');");const {deriveRewardTreeModel}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const activity={type:'homework',courseId:'grade6-115-1',weekCode:'02',activityKey:'reading_A',label:'Reading'};const row={course_id:activity.courseId,week_code:'02',activity_key:activity.activityKey,submitted:true};
 for(const [completed,n] of [[false,1],[true,2],[false,1],[true,2]]){const m=deriveRewardTreeModel([{...row,completed}],[activity]);assert.equal(m.stats.leafCount,n);assert.equal(m.stats.flowerCount,0);assert.equal(new Set(m.rewards.map(r=>r.id)).size,n);}
 const m=deriveRewardTreeModel([{...row,completed:true}],[{...activity,type:'typing',totalLevels:5}]);assert.equal(m.stats.leafCount,4);assert.equal(m.stats.flowerCount,1);
});
