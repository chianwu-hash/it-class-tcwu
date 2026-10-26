import test from 'node:test';
import assert from 'node:assert/strict';
import { quizStudentRedirect, quizPageGrade, quizLibraryPath } from '../../shared/quiz-grade-route.mjs';

test('年級入口：名冊優先、保持場次、教師切換及未知年級鎖定', () => {
  assert.equal(quizPageGrade('/grade3/115-1/quiz-library.html'),3);
  assert.equal(quizStudentRedirect({role:'student',grade:3},'/grade6/115-1/quiz-library.html'),quizLibraryPath(3));
  assert.equal(quizStudentRedirect({role:'student',grade:6},'/grade3/115-1/quiz-library.html'),quizLibraryPath(6));
  assert.equal(quizStudentRedirect({role:'student',grade:3},'/grade6/115-1/quiz.html','?cloud=1&session=sample'),'/grade3/115-1/quiz.html?cloud=1&session=sample');
  assert.equal(quizStudentRedirect({role:'student',grade:6},'/grade6/115-1/quiz.html'),null);
  assert.equal(quizStudentRedirect({role:'teacher',grade:null},'/grade3/115-1/quiz-library.html'),null);
  assert.throws(()=>quizStudentRedirect({role:'student',grade:null},'/grade6/115-1/quiz.html'),/名冊年級/);
});
