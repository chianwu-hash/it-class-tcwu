import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuizDb, quizCall, TEACHER, OTHER_TEACHER, studentId } from '../lib/quiz-local-db.mjs';
import { newDocument, content } from '../../shared/quiz-document.mjs';

test('學生選卷：名冊年級、個人紀錄隔離、揭答與跨班不限29人的自學場次', async () => {
  const db = await createQuizDb(); const call = (uid, action, data={}) => quizCall(db, uid, action, data);
  try {
    await db.query('update public.student_enrollments set class_code=$1 where email=$2', ['301','student31@example.invalid']);
    const outsider='00000000-0000-4000-9000-000000000001';
    await db.query('insert into auth.users values($1,$2,now())',[outsider,'unlisted@example.invalid']);
    const sessions=[];
    for(const grade of [3,6]) {
      const document=newDocument();document.title=`合成${grade}年級卷`;document.catalog.volume=`${grade}年級上學期`;
      document.blocks[0].questions[0].explanation=content('送答後才出現的原解析');
      const bank_id=crypto.randomUUID();await call(TEACHER,'save',{bank_id,expected_revision:0,document});
      const v=await call(TEACHER,'publish',{bank_id,expected_revision:1});
      const session={session_id:crypto.randomUUID(),version_id:v.id,school_year:115,class_codes:[grade===3?'301':'603'],
        reveal:'immediate',shuffle_options:true,access_mode:'practice'};
      await call(TEACHER,'open',session);sessions.push({session,document});
    }
    const six=(await call(studentId(1),'library_sessions'));assert.equal(six.role,'student');assert.equal(six.grade,6);assert.equal(six.sessions.length,1);
    assert.equal((await call(studentId(31),'library_sessions')).grade,3);
    assert.equal(six.sessions[0].id,sessions[1].session.session_id);
    assert.equal((await call(studentId(31),'library_sessions')).sessions[0].id,sessions[0].session.session_id);
    await assert.rejects(call(outsider,'library_sessions'),/roster_required/);
    await assert.rejects(call(studentId(31),'join',sessions[1].session),/roster_required/);
    await assert.rejects(call(TEACHER,'join',sessions[1].session),/student_required/);
    await assert.rejects(call(OTHER_TEACHER,'library_sessions'),/student_required/);
    const args=sessions[1].session,joined=await call(studentId(1),'join',args);
    assert.doesNotMatch(JSON.stringify(joined),/原解析|option_id|explanation/);
    const q=sessions[1].document.blocks[0].questions[0];
    const submit={...args,question_id:q.id,response:q.answer.option_id,request_id:crypto.randomUUID(),user_id:studentId(2)};
    const saved=await call(studentId(1),'submit',submit);
    assert.equal(saved.reviews[0].correct,true);assert.equal(saved.complete,true);
    assert.deepEqual(await call(studentId(1),'submit',submit),saved);
    assert.deepEqual(await call(studentId(1),'resume',args),saved);
    assert.equal((await call(studentId(2),'join',args)).reviews.length,0);
    assert.equal((await call(studentId(2),'library_sessions')).sessions[0].answered,0);
    assert.equal((await call(studentId(1),'library_sessions')).sessions[0].answered,1);
    for(let n=3;n<=30;n++)await call(studentId(n),'join',args);
    assert.equal((await db.query('select count(*) as n from public.quiz_attempts where session_id=$1',[args.session_id])).rows[0].n,30);
  } finally { await db.close(); }
});
