import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createOpenSelfReviewDb} from '../lib/quiz-open-self-review-fixture.mjs';
import {quizCall,studentId} from '../lib/quiz-local-db.mjs';
import {newQuestion,content} from '../../shared/quiz-document.mjs';

test('缺可靠課本仍固定綁定解析；不製造頁碼，保留既有權限與固定版本',async()=>{
 const db=await createOpenSelfReviewDb();
 try{
  const snapshot=await readFile('supabase/production-snapshot/functions.sql','utf8');
  const before=snapshot.match(/CREATE OR REPLACE FUNCTION public\.quiz_bind_composed_study\(\)[\s\S]*?(?=\r?\nrevoke all)/)[0];
  await db.exec(before);
  const migration=await readFile('supabase/quiz-pool-study-unmatched.sql','utf8');
  await db.exec(migration);
  await assert.rejects(db.exec(migration),/unmatched_study_function_changed/);
  await db.exec('rollback;');
  const course='synthetic-unmatched',book=randomUUID();
  await db.query('insert into public.quiz_courses values($1,6,$2,true)',[course,{subject:'國語',volume:'6年級上學期',units:{7:'合成單元'}}]);
  await db.query("insert into public.quiz_textbooks values($1,6,115,1,'合成教材',$2,false)",[book,'a'.repeat(64)]);
  await db.query("insert into public.quiz_textbook_pages values($1,'p84','{84}','u7',$2,100)",[book,'b'.repeat(64)]);
  await db.query('update public.quiz_textbooks set enabled=true where id=$1',[book]);
  const questions=[];
  const notes={book_match_status:'no_reliable_match',unmatched_explanation:'合成來源未找到可靠對照，保留解析。',teacher_secret:true};
  async function source(q,bookId=null,page=null,pages=[],teacherNotes=notes){
   await db.query("insert into public.quiz_question_pool values($1,$1,$1,'[7]','unmapped','未配題',0,'v1',false,$2,'{}',true) on conflict do nothing",[q.id,q]);
   await db.query('insert into public.quiz_pool_membership values($1,$2,false) on conflict do nothing',[q.id,course]);
   await db.query("insert into public.quiz_pool_study_sources values($1,$2,$3,$4,$5,$6,'合成固定解析',$7,'{\"reviewed\":true}',true)",[q.id,course,q,bookId,page,pages,teacherNotes]);
  }
  for(let i=0;i<5;i++){
   const q=newQuestion();q.id='unmatched_'+i;q.prompt=content('合成來源 '+i);q.explanation=content('原題解析');questions.push(q);await source(q);
  }
  const compose=()=>db.transaction(async tx=>{
   await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');
   return(await tx.query('select public.quiz_compose($1) r',[{kind:'self',course_id:course,units:[7],difficulty:'medium',count:5,request_id:randomUUID()}])).rows[0].r;
  });
  const made=await compose(),joined=await quizCall(db,studentId(1),'join',{session_id:made.session_id});
  assert.deepEqual(joined.study.pages,[]);assert.deepEqual(joined.study.references,{});assert.deepEqual(joined.study.explanations,{});
  assert.doesNotMatch(JSON.stringify(joined),/合成固定解析|teacher_secret/);
  assert.equal((await db.query('select count(*)::int n from public.quiz_study_items where package_id=$1',[joined.study.packageId])).rows[0].n,5);
  const q=questions.find(q=>q.id===joined.document.questions[0].id);
  const answered=await quizCall(db,studentId(1),'submit',{session_id:made.session_id,question_id:q.id,response:q.answer.option_id,request_id:randomUUID(),compact:true});
  assert.equal(answered.study.explanations[q.id].text,'合成固定解析');
  const other=await quizCall(db,studentId(2),'join',{session_id:made.session_id}).catch(e=>e);
  assert.match(other.message,/session_unavailable|session_access_denied/);
  for(const [bookId,page,pages,note]of [[book,null,[],notes],[null,84,[],notes],[null,null,[84],notes],[null,null,[],{}],[null,null,[],{book_match_status:'no_reliable_match',unmatched_explanation:' '}],[book,84,[null,84],{}],[book,84,[0,84],{}],[book,84,[],{}]]){
   const bad=newQuestion();bad.id='bad_'+randomUUID();
   await assert.rejects(source(bad,bookId,page,pages,note),/check constraint/);
  }
  const matched=newQuestion();matched.id='matched';await source(matched,book,84,[84],{});
  await db.query("update public.quiz_pool_study_sources set enabled=false where question_id like 'unmatched_%'");
  const pinned=await quizCall(db,studentId(1),'resume',{session_id:made.session_id});assert.equal(pinned.study.packageId,joined.study.packageId);
  assert.equal(pinned.study.explanations[q.id].text,'合成固定解析');
  await assert.rejects(db.query("update public.quiz_pool_study_sources set student_explanation='更換固定內容'"),/study_fixed_version/);
  for(const role of ['anon','authenticated'])await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role '+role);await tx.exec('select * from public.quiz_pool_study_sources');}),/permission denied/);
 }finally{await db.close();}
});
