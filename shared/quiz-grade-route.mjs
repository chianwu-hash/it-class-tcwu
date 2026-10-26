// 網址決定呈現位置；學生權限與真正年級一律來自後端名冊。
export function quizPageGrade(pathname) {
  const match = pathname.match(/^\/grade([36])\/115-1\//);
  return match ? Number(match[1]) : null;
}
export function quizLibraryPath(grade) {
  if (![3,6].includes(Number(grade))) throw new Error('無法辨識測驗年級。');
  return `/grade${Number(grade)}/115-1/quiz-library.html`;
}
export function quizStudentRedirect(identity, pathname, search = '') {
  if (identity.role !== 'student') return null;
  const grade = Number(identity.grade);
  if (![3,6].includes(grade)) throw new Error('名冊年級尚未確認，請老師協助。');
  if (quizPageGrade(pathname) === grade) return null;
  return pathname.endsWith('/quiz.html') ? `/grade${grade}/115-1/quiz.html${search}` : quizLibraryPath(grade);
}
