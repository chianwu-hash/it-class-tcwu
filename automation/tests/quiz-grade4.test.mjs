import test from 'node:test';import assert from 'node:assert/strict';
import {quizPageGrade,quizLibraryForEnrollment,quizStudentRedirect} from '../../shared/quiz-grade-route.mjs';
import {readFile} from 'node:fs/promises';
import {extendWrongQuestionsToGrade4} from '../lib/quiz-grade4-migration.mjs';
import {createQuizDb} from '../lib/quiz-local-db.mjs';
const browserModule=async file=>import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(file,import.meta.url),'utf8')).toString('base64'));
const {getCourseDefinition,inferCourseIdFromPath}=await browserModule('../../shared/course-context.js');
const {getRewardTreeCourse}=await browserModule('../../shared/reward-tree-config.js');

test('四年級增量遷移只擴充錯題年級白名單，拒絕來源已變動或重複套用',()=>{
 const guard="coalesce(p_data->>'grade','') not in ('','3','6')";
 const source=`create function public.quiz_wrong_questions(p_data jsonb) returns jsonb as $$ begin if ${guard} then raise exception 'invalid_request'; end if; return public.quiz_wrong_refs(); end $$ language plpgsql security definer set search_path='';`;
 const after=extendWrongQuestionsToGrade4(source);
 assert.equal(after,source.replace("('','3','6')","('','3','4','6')"));
 assert.throws(()=>extendWrongQuestionsToGrade4(after),/grade_guard_missing/);
 assert.throws(()=>extendWrongQuestionsToGrade4(source+source),/grade_guard_missing/);
 assert.throws(()=>extendWrongQuestionsToGrade4('unexpected definition'),/grade_guard_missing/);
});

test('正式增量SQL保留既有函式內容與權限，重複執行不倒退',async()=>{
 const db=await createQuizDb(undefined,{batch4:true});try{
  const [{definition}]=(await db.query("select pg_get_functiondef('public.quiz_wrong_questions(jsonb)'::regprocedure) definition")).rows;
  const old=definition.replace("('','3','4','6')","('','3','6')");
  await db.query(old);
  const metadata=async()=>(await db.query("select proacl,proowner,prosecdef,proconfig from pg_proc where oid='public.quiz_wrong_questions(jsonb)'::regprocedure")).rows;
  const before=await metadata();
  const sql=await readFile(new URL('../../supabase/quiz-grade4-wrong-questions.sql',import.meta.url),'utf8');
  // The migration patches the installed definition without reinstalling read upgrades.
  await db.exec(sql);
  assert.equal((await db.query("select pg_get_functiondef('public.quiz_wrong_questions(jsonb)'::regprocedure) definition")).rows[0].definition,extendWrongQuestionsToGrade4(old));
  assert.deepEqual(await metadata(),before);
  await db.exec(sql);
  assert.equal((await db.query("select pg_get_functiondef('public.quiz_wrong_questions(jsonb)'::regprocedure) definition")).rows[0].definition,definition);
 }finally{await db.close();}
});
test('四年級依名冊進正確入口，跨年級作答連結保留場次',()=>{
 assert.equal(quizLibraryForEnrollment({class_code:'409'}),'/grade4/115-1/quiz-library.html');
 assert.equal(quizPageGrade('/grade4/115-1/quiz.html'),4);
 assert.equal(quizStudentRedirect({role:'student',grade:4},'/grade3/115-1/quiz.html','?cloud=1&session=existing'),'/grade4/115-1/quiz.html?cloud=1&session=existing');
 assert.equal(quizStudentRedirect({role:'student',grade:3},'/grade4/115-1/quiz-library.html'),'/grade3/115-1/quiz-library.html');
 assert.throws(()=>quizStudentRedirect({role:'student',grade:5},'/grade4/115-1/quiz.html'),/名冊年級/);
});
test('四年級努力樹使用本學期空活動目錄，不借三年級打字成果',()=>{
 const course=getCourseDefinition('grade4-115-1');assert.equal(course.grade,'grade4');assert.equal(course.schoolYear,'115');
 assert.equal(inferCourseIdFromPath('/grade4/115-1/quiz-library.html'),'grade4-115-1');
 const tree=getRewardTreeCourse('grade4-115-1');assert.equal(tree.id,'grade4-115-1');assert.deepEqual(tree.activities,[]);
});
