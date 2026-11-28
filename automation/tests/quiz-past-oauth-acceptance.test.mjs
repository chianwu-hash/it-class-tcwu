import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';

const migration=(await readFile('supabase/quiz-past-oauth-acceptance.sql','utf8')).replaceAll('\r\n','\n');
const rollback=(await readFile('supabase/quiz-past-oauth-acceptance-rollback.sql','utf8')).replaceAll('\r\n','\n');
const paper='fixture-grade4-private';
const version=randomUUID();
const book=randomUUID();
const packageId=randomUUID();
const h='f'.repeat(64);

test('私人考古驗收僅限指定 Google 學生和固定版本，課本、媒體、草稿、判分走正式入口',async()=>{
 const {db,uid,as}=await setupProductionQuizDB({snapshot:true});
 const call=async(n,action,data={})=>rpc(n,'quiz_past_action',[action,{paper_id:paper,...data}]);
 async function rpc(n,name,args) {
   await as(n,n?'authenticated':'anon');
   try {
     const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');
     return (await db.query('select public.'+name+'('+placeholders+') result',args)).rows[0].result;
   } finally {await db.exec('reset role');}
 }
 const questionAsset='https://quiz-media.invalid/'+uid(1)+'/'+h;
 const bookAsset='https://quiz-media.invalid/'+book+'/'+'e'.repeat(64);
 const doc={schema:2,title:'合成四年級考古驗收卷',
   groups:[{id:'q1',sourceLabel:'第一題',kind:'single',assets:[],codes:[],title:'合成題',
     material:'',materialContent:{text:'',media:[]},
     promptContent:{text:'圖形',media:[{kind:'image',url:questionAsset,alt:'合成圖'}]},
     choices:[{id:'a',text:'甲'},{id:'b',text:'乙'}],
     fields:[{id:'q1',text:'選出甲。',points:1,label:'1',answer:'a'}]}],blocked:[]};
 try {
   await db.exec(migration);
   for (const n of [1,2,3,4,5]) {
     const email=n===1?'teacher@example.invalid':n+'@example.invalid';
     await db.query('insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,now(),$3)',
       [uid(n),email,{providers:[n===5?'email':'google']}]);
     if(n!==1) await db.query('insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values(115,$1,$2,$3,$4)',
       [email,n===4?'603':'407',n,'合成測試學生']);
   }
   await db.query('insert into public.quiz_past_papers(id,owner_id,grade,school_year,semester,title,enabled) values($1,$2,4,115,1,$3,false)',[paper,uid(1),doc.title]);
   await db.query('select public.quiz_past_validate($1::jsonb)',[doc]);
   await db.query('insert into public.quiz_past_versions(id,paper_id,sha256,document,provenance) values($1,$2,$3,$4,$5)',[version,paper,h,doc,{}]);
   await db.query('insert into public.quiz_media_assets(url,owner_id,object_path,mime,bytes) values($1,$2,$3,$4,100)',[questionAsset,uid(1),'drive-past/'+h,'image/png']);
   await db.query('insert into public.quiz_textbooks(id,grade,school_year,semester,title,source_sha256,enabled) values($1,4,115,1,$2,$3,true)',[book,'合成課本','d'.repeat(64)]);
   await db.query("insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes) values($1,'p60','{60}','60',$2,100)",[book,'e'.repeat(64)]);
   await db.query("insert into public.quiz_study_packages(id,kind,version_id,approved,enabled,provenance) values($1,'past',$2,true,false,'{}')",[packageId,version]);
   await db.query("insert into public.quiz_study_items(package_id,group_id,question_id,book_id,primary_page,reference_pages,student_explanation,origin,teacher_notes) values($1,'q1','q1',$2,60,'{60}','答後解析','ai','{}')",[packageId,book]);
   const grants=async n=>db.query("insert into public.quiz_past_acceptance_grants(paper_id,version_id,user_id,expires_at) values($1,$2,$3,now()+interval '20 minutes')",[paper,version,uid(n)]);
   const start=id=>call(id,'start',{request_id:randomUUID()});
   await assert.rejects(start(2),/paper_unavailable/);
   for(const n of [2,4,5]) await grants(n);
   for(const n of [2,3,4,5]) assert.deepEqual((await call(n,'list')).papers,[]);
   for(const n of [3,4,5]) await assert.rejects(start(n),/paper_unavailable/);
   await assert.rejects(start(0));
   await assert.rejects(rpc(2,'quiz_past_acceptance_version',[paper]),/permission denied/);
   await as(2);
   try {await assert.rejects(db.query('select * from public.quiz_past_acceptance_grants'),/permission denied/);}
   finally {await db.exec('reset role');}

   const result=await start(2);
   const aid=result.attemptId;
   assert.equal(result.version,version);
   assert.equal(result.study.references.q1.primary,60);
   assert.deepEqual(result.study.explanations,{});
   assert.equal(Object.hasOwn(result.groups[0].fields[0],'answer'),false);
   assert.equal((await start(2)).attemptId,aid);
   assert.equal((await rpc(2,'quiz_media_access',[questionAsset,aid])).object_path,'drive-past/'+h);
   assert.equal((await rpc(2,'quiz_textbook_media_access',['past',aid,version,bookAsset])).backend,'drive');
   await assert.rejects(rpc(3,'quiz_media_access',[questionAsset,aid]),/media_unavailable/);
   await assert.rejects(rpc(3,'quiz_textbook_media_access',['past',aid,version,bookAsset]),/attempt_unavailable/);
   const draft={attempt_id:aid,version,request_id:randomUUID(),revision:0,groups:{q1:['a']},current_group:'q1'};
   assert.equal((await call(2,'save_draft',draft)).revision,1);
   assert.deepEqual((await call(2,'resume',{attempt_id:aid})).draft.groups,{q1:['a']});
   await call(2,'view',{attempt_id:aid,group_id:'q1'});
   await db.query("update public.quiz_past_views set started_at=clock_timestamp()-interval '4 seconds' where attempt_id=$1",[aid]);
   const submitted=await call(2,'submit',{attempt_id:aid,version,group_id:'q1',request_id:randomUUID(),responses:[{questionId:'q1',value:'a'}]});
   assert.equal(submitted.summary.score,1);
   assert.equal(submitted.practice.complete,true);
   assert.equal(submitted.study.explanations.q1.text,'答後解析');
   assert.equal((await db.query('select count(*)::int n from public.quiz_past_leaves')).rows[0].n,0);
   await assert.rejects(db.exec(rollback),/Acceptance attempts exist/);
   await db.exec('ROLLBACK');
   await db.query("update public.quiz_past_acceptance_grants set starts_at=now()-interval '30 minutes',expires_at=now()-interval '1 second' where user_id=$1",[uid(2)]);
   await assert.rejects(call(2,'resume',{attempt_id:aid}),/paper_unavailable/);
   await assert.rejects(rpc(2,'quiz_media_access',[questionAsset,aid]),/media_unavailable/);
   await assert.rejects(rpc(2,'quiz_textbook_media_access',['past',aid,version,bookAsset]),/attempt_unavailable/);

   await db.query('update public.quiz_past_papers set enabled=true,active_version=$1 where id=$2',[version,paper]);
   assert.equal((await call(2,'list')).papers[0].enabled,true);
   assert.equal((await call(3,'list')).papers[0].enabled,true);
   await assert.rejects(call(2,'resume',{attempt_id:aid}),/attempt_unavailable/);
   const publicAttempt=await start(2);
   assert.notEqual(publicAttempt.attemptId,aid);
   assert.ok(publicAttempt.practice.history.every(item=>item.id!==aid));
   await assert.rejects(rpc(2,'quiz_media_access',[questionAsset,aid]),/media_unavailable/);
   const stranger=await start(3);
   assert.equal(stranger.version,version);
   await call(3,'view',{attempt_id:stranger.attemptId,group_id:'q1'});
   await db.query("update public.quiz_past_views set started_at=clock_timestamp()-interval '4 seconds' where attempt_id=$1",[stranger.attemptId]);
   const publicResult=await call(3,'submit',{attempt_id:stranger.attemptId,version,group_id:'q1',request_id:randomUUID(),responses:[{questionId:'q1',value:'a'}]});
   assert.equal(publicResult.summary.score,1);
   assert.equal(publicResult.practice.complete,true);
   const awards=await db.query('select user_id,attempt_id from public.quiz_past_leaves');
   assert.deepEqual(awards.rows,[{user_id:uid(3),attempt_id:stranger.attemptId}]);
 } finally {
   await db.close();
 }
});

test('尚未使用的驗收功能可完整回復正式函式、權限及資料結構',async()=>{
 const {db}=await setupProductionQuizDB({snapshot:true});
 const digest=async()=> (await db.query(
   "select p.oid::regprocedure::text name,md5(pg_get_functiondef(p.oid)) fingerprint,p.proacl::text acl from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f' order by name"
 )).rows;
 try{
   const original=await digest();
   await db.exec(migration);
   await db.exec(rollback);
   assert.deepEqual(await digest(),original);
   assert.equal((await db.query("select to_regclass('public.quiz_past_acceptance_grants') as relation")).rows[0].relation,null);
   const columns=await db.query("select column_name from information_schema.columns where table_name='quiz_past_attempts' and column_name='acceptance_only'");
   assert.deepEqual(columns.rows,[]);
 }finally{await db.close();}
});
