import {workshopCourse,workshopCourseForPath} from './quiz-workshop-config.mjs';
// 網址決定呈現位置；學生權限與真正年級一律來自後端名冊。
export function quizPageGrade(pathname) {
  return workshopCourseForPath(pathname)?.grade ?? null;
}
export function quizLibraryPath(grade) {
  const course=workshopCourse(grade);
  if (!course) throw new Error('無法辨識測驗年級。');
  return course.basePath+'quiz-library.html';
}
export function quizLibraryForEnrollment(enrollment) {
  const grade = String(enrollment?.class_code || '').match(/^([0-9])[0-9]{2}$/)?.[1];
  return workshopCourse(grade) ? quizLibraryPath(Number(grade)) : null;
}
export function quizStudentRedirect(identity, pathname, search = '') {
  if (identity.role !== 'student') return null;
  const grade = Number(identity.grade);
  if (!workshopCourse(grade)) throw new Error('名冊年級尚未確認，請老師協助。');
  if (quizPageGrade(pathname) === grade) return null;
  return pathname.endsWith('/quiz.html') ? `${workshopCourse(grade).basePath}quiz.html${search}` : quizLibraryPath(grade);
}
