import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuizDb,quizCall,TEACHER,OTHER_TEACHER,studentId} from '../lib/quiz-local-db.mjs';
import {newDocument} from '../../shared/quiz-document.mjs';

test('教師管理後台保留，但教師本人及其他教師皆不能進入練功房或以舊試答連結作答',async()=>{
 const db=await createQuizDb(),call=(uid,action,data={})=>quizCall(db,uid,action,data);try{
  const bank_id=crypto.randomUUID(),document=newDocument();await call(TEACHER,'save',{bank_id,expected_revision:0,document});const v=await call(TEACHER,'publish',{bank_id,expected_revision:1});
  const args={session_id:crypto.randomUUID(),version_id:v.id,school_year:115,class_codes:[],reveal:'immediate',shuffle_options:true,access_mode:'personal'};
  await call(TEACHER,'open',args);assert.equal((await call(TEACHER,'open',args)).id,args.session_id);
  for(const uid of [TEACHER,OTHER_TEACHER])for(const action of ['library_sessions','join','resume','submit','view_question'])await assert.rejects(call(uid,action,args),/student_required/);
  await assert.rejects(call(studentId(1),'join',args),/session_unavailable/);
  await assert.rejects(quizCall(db,'','join',args,'anon'),/permission denied/);
  assert.equal((await call(TEACHER,'personal_sessions')).sessions.length,1);
  assert.equal((await call(OTHER_TEACHER,'personal_sessions')).sessions.length,0);
  assert.equal((await call(TEACHER,'get',{bank_id})).id,bank_id);
  assert.equal((await db.query('select count(*)::int n from public.quiz_attempts')).rows[0].n,0);
 }finally{await db.close();}
});
