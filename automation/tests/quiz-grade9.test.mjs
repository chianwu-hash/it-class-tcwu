import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {quizLibraryForEnrollment,quizStudentRedirect,quizPageGrade} from '../../shared/quiz-grade-route.mjs';
import {pastPaperDisplay} from '../../shared/quiz-past-catalog.mjs';
import {grade9FunctionChanges,buildGrade9Migration} from '../lib/quiz-grade9-migration.mjs';
const browserModule=async file=>import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(file,import.meta.url),'utf8')).toString('base64'));

test('九年級名冊路由保留同次作答，三四六既有路由不變',()=>{
  for(const grade of [3,4,6,9]){
    assert.equal(quizLibraryForEnrollment({class_code:`${grade}22`}),`/grade${grade}/115-1/quiz-library.html`);
    assert.equal(quizPageGrade(`/grade${grade}/115-1/quiz.html`),grade);
  }
  assert.equal(quizStudentRedirect({role:'student',grade:9},'/grade3/115-1/quiz.html','?cloud=1&session=existing'),'/grade9/115-1/quiz.html?cloud=1&session=existing');
  assert.equal(quizStudentRedirect({role:'student',grade:3},'/grade9/115-1/quiz-library.html'),'/grade3/115-1/quiz-library.html');
  assert.equal(quizLibraryForEnrollment({class_code:'822'}),null);
  assert.throws(()=>quizStudentRedirect({role:'student',grade:8},'/grade9/115-1/quiz.html'),/名冊年級/);
});
test('九年級努力樹沒有借用國小打字課程',async()=>{
  const {getCourseDefinition,inferCourseIdFromPath}=await browserModule('../../shared/course-context.js');
  const {getRewardTreeCourse}=await browserModule('../../shared/reward-tree-config.js');
  assert.equal(getCourseDefinition('grade9-115-1').grade,'grade9');
  assert.equal(inferCourseIdFromPath('/grade9/115-1/quiz-library.html'),'grade9-115-1');
  assert.deepEqual(getRewardTreeCourse('grade9-115-1').activities,[]);
});
test('國中第二次段考及國小期末語意分開',()=>{
  const p={id:'test',grade:9,catalog:{sourceYear:'114-1',exam:2,subject:'數學'}};
  assert.equal(pastPaperDisplay(p).shortTitle,'114上九年級第2次段考數學');
  assert.equal(pastPaperDisplay({...p,grade:4}).shortTitle,'114上四年級期末數學');
  assert.equal(pastPaperDisplay({...p,catalog:{subject:'國文'}}).shortTitle,'九年級考古題國文');
});

test('九年級遷移只接受預期來源，保留指紋檢查與可重複執行分支',()=>{
  const row=(proname,definition)=>({proname,args:'p_data jsonb',definition});
  const defs=['quiz_student_identity','quiz_compose','quiz_action_before_learning','quiz_leaf_result_before_learning'].map(n=>row(n,'function '+n+' [346]'));
  defs.push(row('quiz_wrong_questions_before_learning',"function wrong ('','3','4','6')"),row('quiz_assign_paper_name',"function name [346] when 4 then '四年級' else '六年級' ('國語','英語','數學','社會','自然')"));
  for(const n of ['garden_pet_visit','garden_unlock_notice','garden_growth'])defs.push(row(n,"function garden 'grade4-115-1','grade6-115-1' "+(n==='garden_growth'?"p_course_id<>'grade4-115-1'":'')));
  const changes=grade9FunctionChanges(defs);assert.equal(changes.length,9);assert(changes.every(x=>x.beforeHash!==x.afterHash));
  const sql=buildGrade9Migration(defs);for(const c of changes){assert(sql.includes(`if current_hash='${c.afterHash}' then return;`));assert(sql.includes(`current_hash is distinct from '${c.beforeHash}'`));}
  assert(sql.includes("^[1-69][0-9]{2}$"));assert(!sql.includes('create table'));assert(!sql.includes('quiz_action('));
  assert.throws(()=>grade9FunctionChanges(defs.slice(1)),/grade9_function_missing/);
  assert.throws(()=>grade9FunctionChanges(defs.map((x,i)=>i===0?{...x,definition:'changed upstream'}:x)),/grade9_source_guard_missing/);
});
