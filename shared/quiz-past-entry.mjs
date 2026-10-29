import {initQuizModule} from './quiz-module.js?v=20261029-past-style2';
import {initNavbarAuth} from './navbar-auth.js';
const paperId=new URLSearchParams(location.search).get('paper')||'dingxi-114-1-g3-exam1-science';
const quiz=initQuizModule({mode:'past-exam',selectors:{container:'past-exam',lock:'quiz-lock',content:'quiz-content'},server:{paperId}});
initNavbarAuth({onSessionResolved:session=>quiz.handleAuthChange(session)});
