// 呈現與既有網址註冊；不是名冊、學校或年級的授權來源。
export const workshopBrand = '考前練功坊';
const elementarySubjects = ['國語','英語','數學','社會','自然'];
export const workshopCourses = Object.freeze([
  {grade:3,label:'三年級',school:'頂溪國小',courseId:'grade3-115-1',basePath:'/grade3/115-1/',subjects:elementarySubjects,defaultPastPaper:'dingxi-114-1-g3-exam1-science'},
  {grade:4,label:'四年級',school:'土城國小',courseId:'grade4-115-1',basePath:'/grade4/115-1/',subjects:elementarySubjects,zhuyinImageScale:2},
  {grade:6,label:'六年級',school:'頂溪國小',courseId:'grade6-115-1',basePath:'/grade6/115-1/',subjects:elementarySubjects},
  {grade:9,label:'九年級',school:'中正國中',courseId:'grade9-115-1',basePath:'/grade9/115-1/',subjects:['國文','英語','數學','地理','歷史','公民','自然']},
].map(course=>Object.freeze({...course,subjects:Object.freeze([...course.subjects])})));
export function workshopCourse(grade) {
  return workshopCourses.find(course=>course.grade===Number(grade))||null;
}
export function workshopCourseForPath(pathname) {
  return workshopCourses.find(course=>pathname.startsWith(course.basePath))||null;
}
