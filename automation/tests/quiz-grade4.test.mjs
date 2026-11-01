import test from 'node:test';import assert from 'node:assert/strict';
import {quizPageGrade,quizLibraryForEnrollment,quizStudentRedirect} from '../../shared/quiz-grade-route.mjs';
import {readFile} from 'node:fs/promises';
const browserModule=async file=>import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(file,import.meta.url),'utf8')).toString('base64'));
const {getCourseDefinition,inferCourseIdFromPath}=await browserModule('../../shared/course-context.js');
const {getRewardTreeCourse}=await browserModule('../../shared/reward-tree-config.js');
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
