// 呈現與既有網址註冊；不是名冊、學校或年級的授權來源。
export const workshopBrand = '考前練功坊';
const elementarySubjects = ['國語','英語','數學','社會','自然'];
const elementaryPastIntro='依所選範圍顯示已開放的歷年原卷。';
export const workshopCourses = Object.freeze([
  {grade:3,label:'三年級',school:'頂溪國小',courseId:'grade3-115-1',basePath:'/grade3/115-1/',subjects:elementarySubjects,defaultPastPaper:'dingxi-114-1-g3-exam1-science'},
  {grade:4,label:'四年級',navLabel:'土城四年級',school:'土城國小',courseId:'grade4-115-1',basePath:'/grade4/115-1/',subjects:elementarySubjects,zhuyinImageScale:2},
  {grade:6,label:'六年級',school:'頂溪國小',courseId:'grade6-115-1',basePath:'/grade6/115-1/',subjects:elementarySubjects},
  {grade:9,label:'九年級',navLabel:'中正九年級',school:'中正國中',courseId:'grade9-115-1',basePath:'/grade9/115-1/',subjects:['國文','英語','數學','地理','歷史','公民','自然'],pastCatalogIntro:'依中正國中 113、114 學年度九上第二次段考原卷整理。今年範圍尚未公告，歷年範圍僅供參考。'},
].map(course=>Object.freeze({pastExams:true,pastCatalogIntro:elementaryPastIntro,...course,subjects:Object.freeze([...course.subjects])})));
export function workshopNavigation(course){
  if(!course)throw Error('練功坊課程尚未註冊。');
  return {gradeLabel:workshopBrand+'｜'+(course.navLabel||course.label),homeHref:course.basePath+'quiz-library.html',extraLinks:[{href:'/my-tree.html?'+new URLSearchParams({course:course.courseId}),label:'努力樹',iconClass:'fa-solid fa-tree'},{href:course.basePath+'index.html',label:'課程首頁'}]};
}
export function workshopCourse(grade) {
  return workshopCourses.find(course=>course.grade===Number(grade))||null;
}
export function workshopCourseForPath(pathname) {
  return workshopCourses.find(course=>pathname.startsWith(course.basePath))||null;
}
