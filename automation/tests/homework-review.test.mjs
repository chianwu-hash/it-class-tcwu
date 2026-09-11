import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createHandler} from '../../supabase/functions/homework/handler.mjs';
import {encryptToken} from '../../supabase/functions/drive-connect/handler.mjs';
const require=createRequire(path.join(process.env.TEMP,'codex-drive-validation','package.json'));
const {PGlite}=require('@electric-sql/pglite');
test('preview authenticates media ownership before reading private Drive bytes',async()=>{
 const uid='00000000-0000-0000-0000-000000000001',id='00000000-0000-0000-0000-000000000002';
 const key=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
 const token=await encryptToken('refresh',key,`${uid}:th990821@mail.thps.ntpc.edu.tw`);let permitted=false,driveCalls=0,thumbCalls=0,thumbnailLink='https://lh3.googleusercontent.com/test';
 const env=n=>({DRIVE_REDIRECT_URI:'https://school.test/admin-drive.html',SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'pub',SUPABASE_SERVICE_ROLE_KEY:'service',DRIVE_TOKEN_KEY:key,DRIVE_CLIENT_ID:'client',DRIVE_CLIENT_SECRET:'secret'}[n]);
 const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
 const h=createHandler({env,fetcher:async(url)=>{
 if(url.endsWith('/auth/v1/user'))return json({id:uid,email_confirmed_at:'today'});
 if(url.endsWith('/rpc/homework_review'))return permitted?json({owner_user_id:uid,drive_file_id:'image',file_name:'image.png',file_size:3}):json({message:'assignment_unavailable'},403);
 if(url.includes('/drive_connections?'))return json([{token_envelope:token,drive_email:'th990821@mail.thps.ntpc.edu.tw'}]);
 if(url==='https://oauth2.googleapis.com/token')return json({access_token:'private'});
 if(url.includes('drive/v3/files/image?fields=thumbnailLink'))return json({thumbnailLink});
 if(url==='https://lh3.googleusercontent.com/test'){thumbCalls++;return new Response(new Uint8Array([4,5]),{headers:{'Content-Type':'image/jpeg'}})}
 if(url.includes('drive/v3/files/image?alt=media')){driveCalls++;return new Response(new Uint8Array([1,2,3]))}
 throw Error('Unexpected URL');}});
 const req=(size)=>new Request('https://edge.test',{method:'POST',headers:{Origin:'https://school.test',Authorization:'Bearer caller','Content-Type':'application/json'},body:JSON.stringify({action:'preview',assignment_id:id,upload_id:id,...(size?{size}:{})})});
 assert.equal((await h(req())).status,400);assert.equal(driveCalls,0);permitted=true;const response=await h(req());assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.arrayBuffer()).byteLength,3);assert.equal(driveCalls,1);
 const thumbnail=await h(req('thumbnail'));assert.equal(thumbnail.status,200);assert.equal(thumbnail.headers.get('content-type'),'image/jpeg');assert.equal((await thumbnail.arrayBuffer()).byteLength,2);assert.equal(driveCalls,1);
 thumbnailLink=null;assert.equal((await h(req('thumbnail'))).status,404);assert.equal(driveCalls,1);
 thumbnailLink='https://attacker.test/steal';assert.equal((await h(req('thumbnail'))).status,400);assert.equal(thumbCalls,1);
 permitted=false;assert.equal((await h(req('thumbnail'))).status,400);assert.equal(thumbCalls,1);

});
test('review history isolates users, preserves old annotations, and rejects stale saves',async()=>{
 const db=new PGlite();const teacher='00000000-0000-0000-0000-000000000001',student='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003';
 try{await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function public.is_teacher() returns boolean language sql as $$select auth.uid()='${teacher}'::uuid$$;create table public.student_enrollments(school_year smallint,email text,class_code text);create table public.drive_connections(owner_user_id uuid);insert into auth.users values('${teacher}','t@test',now()),('${student}','s@test',now()),('${other}','o@test',now());insert into public.student_enrollments values(115,'s@test','603'),(115,'o@test','603');insert into public.drive_connections values('${teacher}');grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../../supabase/homework.sql',import.meta.url),'utf8'));
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text unique);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(await readFile(new URL('../../supabase/homework_thumbnails.sql',import.meta.url),'utf8'));
 const migration=await readFile(new URL('../../supabase/homework_review.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
 const as=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec(`set role ${role}`)};
 const rpc=async(action,data={},review=true)=>(await db.query(`select public.${review?'homework_review':'homework_action'}($1,$2) as data`,[action,JSON.stringify(data)])).rows[0].data;
 await as(teacher);const a=await rpc('create',{week_code:'02',title:'Name',class_code:'*'},false);
 const first='10000000-0000-0000-0000-000000000001',second='10000000-0000-0000-0000-000000000002';
 await as(teacher,'service_role');await db.query("update public.homework_assignments set state='open',drive_folder_id='folder' where id=$1",[a.id]);
 const upload=async(id)=>{await db.query('select homework_reserve($1,$2,$3,$4,$5,$6,$7)',[student,a.id,id,'drive-'+id,'name.png',100,'a'.repeat(64)]);await db.query('select homework_finalize($1,$2)',[student,id])};await upload(first);
 await as(student);const objectName=`${a.id}/${first}.jpg`;
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['homework-thumbnails',objectName]);
 assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await db.query('delete from storage.objects');assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await as(other);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['homework-thumbnails',`${a.id}/${second}.jpg`]),/row-level security/);
 await as(teacher);assert.equal((await db.query('select * from storage.objects')).rows.length,1);const base={assignment_id:a.id,upload_id:first};await rpc('save',{...base,status:'needs_revision'});
 const strokes=[{color:'#db433f',width:.008,points:[[.1,.2],[.3,.4]]}];const saved=await rpc('save',{...base,feedback:'Enlarge frame',strokes,annotation_updated_at:null});
 await assert.rejects(rpc('save',{...base,feedback:'stale',strokes,annotation_updated_at:null}),/version_changed/);
 await rpc('save',{...base,status:'passed'});
 for(const status of ['submitted','needs_revision','submitted','passed']) {
  await rpc('save',{...base,status});
  const history=await rpc('history',{assignment_id:a.id,user_id:student});
  assert.equal(history.versions[0].status,status);assert.equal(history.versions[0].feedback,'Enlarge frame');assert.deepEqual(history.versions[0].strokes,strokes);
  await as(teacher,'service_role');const row=(await db.query('select status,reviewed_at from homework_submissions where upload_id=$1',[first])).rows[0];assert.equal(row.status,status);assert.equal(row.reviewed_at===null,status==='submitted');
  const before=(await db.query('select count(*)::int as n from homework_events where upload_id=$1',[first])).rows[0].n;
  await as(teacher);await rpc('save',{...base,status});await as(teacher,'service_role');assert.equal((await db.query('select count(*)::int as n from homework_events where upload_id=$1',[first])).rows[0].n,before);await as(teacher);
 }

 await as(student);let h=await rpc('history',{assignment_id:a.id});assert.equal(h.versions[0].feedback,'Enlarge frame');assert.deepEqual(h.versions[0].strokes,strokes);assert.equal(h.versions[0].status,'passed');assert.equal(h.versions[0].latest,true);assert.ok(!JSON.stringify(h).includes('resume_uri'));
 await assert.rejects(rpc('save',{...base,status:'passed'}),/teacher_required/);await assert.rejects(rpc('save',{...base,status:'submitted'}),/teacher_required/);await assert.rejects(db.query('select * from homework_annotations'),/permission denied/);
 await as(other);await assert.rejects(rpc('history',{assignment_id:a.id,user_id:student}),/teacher_required/);await assert.rejects(rpc('media_context',base),/assignment_unavailable/);assert.equal((await rpc('history',{assignment_id:a.id})).versions.length,0);
 await as(teacher,'service_role');await upload(second);await as(teacher);await assert.rejects(rpc('save',{...base,status:'submitted'}),/version_changed/);await assert.rejects(rpc('save',{...base,feedback:'wrong version',strokes,annotation_updated_at:saved.annotation_updated_at}),/version_changed/);
 await assert.rejects(rpc('save',{assignment_id:a.id,upload_id:second,feedback:'bad',strokes:[{color:'#000000',width:.5,points:[]}]}),/invalid_review/);
 await rpc('save',{assignment_id:a.id,upload_id:second,feedback:'Feedback only',strokes:[]});
 await as(student);h=await rpc('history',{assignment_id:a.id});assert.equal(h.versions.length,2);assert.equal(h.versions[0].status,'passed');assert.equal(h.versions[0].feedback,'Enlarge frame');assert.equal(h.versions[0].latest,false);assert.equal(h.versions[1].status,'submitted');assert.equal(h.versions[1].feedback,'Feedback only');
 await as('', 'anon');await assert.rejects(rpc('history',{assignment_id:a.id}),/permission denied/);
 }finally{await db.close()}
});
