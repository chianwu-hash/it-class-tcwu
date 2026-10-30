import {initQuizModule} from './quiz-module.js?v=20261030-question-reports';
import {initNavbarAuth} from './navbar-auth.js';
const paperId=new URLSearchParams(location.search).get('paper')||(location.pathname.includes('/grade3/')?'dingxi-114-1-g3-exam1-science':null);
const quiz=paperId?initQuizModule({mode:'past-exam',selectors:{container:'past-exam',lock:'quiz-lock',content:'quiz-content'},server:{paperId}}):null;
if(!paperId)document.querySelector('#quiz-lock [role=status]').textContent='請從考古題專區選擇試卷。';
initNavbarAuth({onSessionResolved:session=>quiz?.handleAuthChange(session)});
