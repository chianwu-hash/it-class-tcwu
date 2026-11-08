import {initQuizModule} from './quiz-module.js?v=20261107-boolean-choice';
import {initNavbarAuth} from './navbar-auth.js';
import {workshopCourseForPath} from './quiz-workshop-config.mjs';
const paperId=new URLSearchParams(location.search).get('paper')||workshopCourseForPath(location.pathname)?.defaultPastPaper||null;
const quiz=paperId?initQuizModule({mode:'past-exam',selectors:{container:'past-exam',lock:'quiz-lock',content:'quiz-content'},server:{paperId}}):null;
if(!paperId)document.querySelector('#quiz-lock [role=status]').textContent='請從考古題專區選擇試卷。';
initNavbarAuth({onSessionResolved:session=>quiz?.handleAuthChange(session)});
