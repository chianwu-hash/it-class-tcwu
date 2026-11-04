import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '../lib/quiz-local-db.mjs';
import {createPastExtensionRewards,extensionQuestionKey} from '../lib/past-extension-rewards.mjs';

// Small synthetic SQL fixture: accounting boundaries, not a claim of real auth/quiz grading.
const publisher={name:'合成書商',grade:3,subject:'自然'},questions=Array.from({length:11},(_,i)=>({id:'q'+i,type:'single',prompt:{text:'合成題 '+i},options:[{id:'a',content:{text:'選項甲'}},{id:'b',content:{text:'選項乙'}}]}));
const copy={...structuredClone(questions[0]),id:'copied-q0'};copy.options.reverse();
assert.equal(extensionQuestionKey(publisher,questions[0]),extensionQuestionKey(publisher,copy));
const packet={publisher,documents:{one:{document:{blocks:[{questions:[...questions,copy]}]},sources:[...questions,copy].map(q=>({normalizedQuestionId:q.id,id:q.id,isoMember:'synthetic/'+q.id,sha256:'0'.repeat(64)}))}}};
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create table public.quiz_sessions(id uuid primary key);create table public.quiz_past_attempts(id uuid primary key,user_id uuid,version_id uuid,paper_id text,school_year integer,semester integer);
 create table public.quiz_attempts(id uuid primary key,session_id uuid,user_id uuid);
 create table public.quiz_answers(attempt_id uuid,question_id text,correct boolean);`);
 const uid=randomUUID(),other=randomUUID();await db.query('insert into auth.users values($1),($2)',[uid,other]);
 const rewards=await createPastExtensionRewards({db,packet,minSeconds:0});
 const create=async(user,year=115,semester=1,paper='paper-a',sourceSemester=semester)=>{
  const sessionId=randomUUID(),sourceAttempt=randomUUID(),attemptId=randomUUID();await db.query('insert into public.quiz_sessions values($1)',[sessionId]);
  await db.query('insert into public.quiz_past_attempts values($1,$2,$3,$4,$5,$6)',[sourceAttempt,user,randomUUID(),paper,year,sourceSemester]);
  await db.query('insert into public.quiz_attempts values($1,$2,$3)',[attemptId,sessionId,user]);
  await rewards.register({sessionId,uid:user,sourceAttempt,conceptId:'synthetic-concept',mode:'review',schoolYear:year,semester});return {sessionId,attemptId};
 };
 const a=await create(uid);assert.equal((await rewards.reconcile(uid,a.sessionId)).count,0);
 await assert.rejects(()=>rewards.reconcile(other,a.sessionId),/practice_session_unavailable/);
 await assert.rejects(()=>rewards.register({sessionId:a.sessionId,uid,sourceAttempt:randomUUID(),conceptId:'missing',mode:'review'}),/practice_source_unavailable/);
 for(const q of questions.slice(0,9))await db.query('insert into public.quiz_answers values($1,$2,false)',[a.attemptId,q.id]);
 assert.equal((await rewards.reconcile(uid,a.sessionId)).count,9);assert.equal((await rewards.summary(uid)).leaves,0);
 await db.exec("update past_extension_fixture.completed set created_at=clock_timestamp()-interval '1 day'");
 const b=await create(uid,115,1,'paper-b');
 // Overlap across papers and content copies: A+B and A+C count only their new questions.
 for(const id of ['q0','copied-q0','q9'])await db.query('insert into public.quiz_answers values($1,$2,true)',[b.attemptId,id]);
 const parallel=await Promise.all([rewards.reconcile(uid,a.sessionId),rewards.reconcile(uid,b.sessionId)]);
 assert.equal(parallel.reduce((n,r)=>n+r.earnedNow,0),1);assert.equal((await rewards.summary(uid)).count,10);assert.equal((await rewards.summary(uid)).leaves,1);
 await db.query('insert into public.quiz_answers values($1,$2,false)',[b.attemptId,'q10']);
 assert.equal((await rewards.reconcile(uid,b.sessionId)).count,11);assert.equal((await rewards.reconcile(uid,b.sessionId)).earnedNow,0);
 const next=await create(uid,115,2,'paper-a',1);await db.query('insert into public.quiz_answers values($1,$2,false)',[next.attemptId,'q0']);
 assert.equal((await rewards.reconcile(uid,next.sessionId)).count,1);assert.equal((await rewards.summary(uid,115,2)).leaves,0);
 const past=await rewards.summary(uid,115,1);assert.equal(past.count,11);assert.equal(past.leaves,1);assert.equal(past.history.length,2);
 const c=await create(other);await db.query('insert into public.quiz_answers values($1,$2,false)',[c.attemptId,'q0']);assert.equal((await rewards.reconcile(other,c.sessionId)).count,1);assert.equal((await rewards.summary(uid)).count,11);
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec('set local role authenticated');return tx.query('select * from past_extension_fixture.completed');}),/permission denied/);
 console.log('PASS ledger SQL: copies, overlapping sets, cross-paper dedupe, concurrency, partial credit, term boundary/history, ownership and denied direct reads');
}finally{await db.close();}
