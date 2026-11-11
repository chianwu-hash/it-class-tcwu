import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createQuizDb,quizCall,studentId} from '../lib/quiz-local-db.mjs';
import {newQuestion,content} from '../../shared/quiz-document.mjs';

test('新自組卷精確綁定已核教材；保留揭答、本人權限、洗牌及舊作答固定版本',async()=>{
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});
 try{
  for(const file of ['quiz-past-exams.sql','quiz-study.sql','quiz-pool-study.sql'])await db.exec(await readFile('supabase/'+file,'utf8'));
  await db.exec(await readFile('supabase/quiz-pool-study.sql','utf8'));
  const book=randomUUID(),course='synthetic-g6-study';
  await db.query("insert into public.quiz_courses values($1,6,$2,true)",[course,{subject:'自然',publisher:'合成',volume:'6年級上學期',units:{3:'合成單元'}}]);
  await db.query("insert into public.quiz_textbooks values($1,6,115,1,'合成教材',$2,false)",[book,'a'.repeat(64)]);
  await db.query("insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes) values($1,'p64','{64}','unit3',$2,100)",[book,'b'.repeat(64)]);
  await db.query('update public.quiz_textbooks set enabled=true where id=$1',[book]);
  const originals=[];
  for(let i=0;i<5;i++){
   const q=newQuestion();q.id='study_pool_'+i;q.prompt=content('合成題目 '+i);q.explanation=content('原有解析');originals.push(q);
   await db.query("insert into public.quiz_question_pool values($1,$1,$1,'[3]','unmapped','未配題',0,'v1',false,$2,'{}',true)",[q.id,q]);
   await db.query('insert into public.quiz_pool_membership values($1,$2,false)',[q.id,course]);
   await db.query("insert into public.quiz_pool_study_sources values($1,$2,$3,$4,64,'{64}','合成學生解析','{\"teacher_secret\":true}','{\"reviewed\":true}',true)",[q.id,course,q,book]);
  }
  const compose=(request)=>db.transaction(async tx=>{
   await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');
   return(await tx.query('select public.quiz_compose($1) r',[request])).rows[0].r;
  });
  const request={kind:'self',course_id:course,difficulty:'medium',count:5,units:[3],request_id:randomUUID()};
  const made=await compose(request),s=await quizCall(db,studentId(1),'join',{session_id:made.session_id});
  assert.equal(s.study.pages.length,1);assert.equal(Object.keys(s.study.references).length,5);assert.deepEqual(s.study.explanations,{});
  assert.doesNotMatch(JSON.stringify(s),/合成學生解析|teacher_secret|option_id/);
  assert.equal((await db.query('select shuffle_options from public.quiz_sessions where id=$1',[made.session_id])).rows[0].shuffle_options,true);
  const countBefore=(await db.query('select count(*)::int n from public.quiz_study_packages')).rows[0].n;
  assert.equal((await compose(request)).session_id,made.session_id);
  assert.equal((await db.query('select count(*)::int n from public.quiz_study_packages')).rows[0].n,countBefore);
  const q=originals.find(q=>q.id===s.document.questions[0].id);
  const answered=await quizCall(db,studentId(1),'submit',{session_id:made.session_id,question_id:q.id,response:q.answer.option_id,request_id:randomUUID(),compact:true});
  assert.equal(answered.study.explanations[q.id].text,'合成學生解析');
  const pinned=answered.study.packageId;
  const call=(uid,sql,args=[],role='authenticated')=>db.transaction(async tx=>{
   await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec('set local role '+role);return tx.query(sql,args);
  });
  const mediaArgs=['normal',s.attempt_id,s.version_id,s.study.pages[0].url];
  assert.equal((await call(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4) r',mediaArgs)).rows[0].r.backend,'drive');
  await assert.rejects(call(studentId(2),'select public.quiz_textbook_media_access($1,$2,$3,$4)',mediaArgs),/attempt_unavailable/);
  for(const role of ['anon','authenticated']){
   await assert.rejects(call(null,'select * from public.quiz_pool_study_sources',[],role),/permission denied/);
   await assert.rejects(call(null,'select public.quiz_bind_composed_study()',[],role),/permission denied/);
  }
  await assert.rejects(db.query("update public.quiz_pool_study_sources set student_explanation='偷偷更換'"),/study_fixed_version/);
  await assert.rejects(db.query('delete from public.quiz_pool_study_sources'),/study_fixed_version/);
  await db.query('update public.quiz_pool_study_sources set enabled=false');
  assert.equal((await quizCall(db,studentId(1),'resume',{session_id:made.session_id})).study.packageId,pinned);
  const unbound=await compose({...request,request_id:randomUUID()});
  assert.equal((await quizCall(db,studentId(1),'join',{session_id:unbound.session_id})).study,undefined);
  await db.query('update public.quiz_pool_study_sources set enabled=true');
  // New source activation never silently enriches an earlier attempt/version.
  assert.equal((await quizCall(db,studentId(1),'resume',{session_id:unbound.session_id})).study,undefined);
  await db.query("update public.quiz_question_pool set question=jsonb_set(question,'{prompt,text}','\"已修改內容\"')");
  const changed=await compose({...request,request_id:randomUUID()});
  assert.equal((await quizCall(db,studentId(1),'join',{session_id:changed.session_id})).study,undefined);
  await db.query('update public.quiz_textbooks set enabled=false where id=$1',[book]);
  await assert.rejects(call(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4)',mediaArgs),/media_unavailable/);
 }finally{await db.close();}
});
