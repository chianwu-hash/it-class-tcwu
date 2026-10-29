import { initQuizModule } from './quiz-module.js?v=20261029-load-batch1';
import { createQuizRequest } from './quiz-api.mjs?v=20261029-load-batch2';
import { initImageLightbox } from './image-lightbox.js';
import {resolveQuizImage} from './quiz-media.mjs?v=20261029-load-batch1';

initImageLightbox({ root: document.getElementById('server-quiz'), selector: 'img', initialScale: 0.8, minScale: 0.2, zoomStep: 0.1,
  resolveImageSource: resolveQuizImage });

const params = new URLSearchParams(location.search), sessionId = params.get('session');
const local = params.get('local') === '1' && ['127.0.0.1', 'localhost'].includes(location.hostname);
const cloud = !local && params.get('cloud') === '1';
if (cloud) document.body.classList.add('quiz-skin');
const gradeRoute = cloud ? await import('./quiz-grade-route.mjs') : null;
if (cloud) {
  const grade = gradeRoute.quizPageGrade(location.pathname);
  document.title = `${grade === 3 ? '三' : '六'}年級考前練功房`;
  document.querySelector('.hero h1').textContent = document.title;
  document.querySelector('#quiz-lock p').textContent = '請使用名冊中的學生 Google 帳號登入，讀取並儲存自己的雲端作答。';
  const back = document.createElement('a'); back.className = 'quiz-back-link'; back.href = 'quiz-library.html'; back.textContent = '← 返回單元選卷';
  document.querySelector('.hero .wrap').append(back);
}
let currentSession = null;
async function start() {
  if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
    document.getElementById('entry-status').textContent = '請使用老師提供的完整場次連結。';
    document.getElementById('quiz-identity').textContent = '尚未選擇場次'; return;
  }
  const student = Number(params.get('student') || 1);
  if (local && (!Number.isInteger(student) || student < 1 || student > 31)) throw new Error('合成學生編號需為 1～31。');
  const request = await createQuizRequest({ local, localStudent: local ? student : null, getSession: () => currentSession });
  const quiz = initQuizModule({ mode: 'server', server: { request, sessionId },
    selectors: { lock: 'quiz-lock', content: 'quiz-content', container: 'server-quiz' } });
  if (local) {
    const descriptor=await fetch('/__quiz-local').then(r => r.json());
    if (!descriptor.local) throw new Error('本機服務尚未啟動。');
    if(descriptor.pool){
      document.body.classList.add('quiz-skin');document.getElementById('server-quiz').dataset.subject='數學';
      document.title='三年級數學｜本機試作';document.querySelector('.hero h1').textContent='三年級考前練功房';
      const back=document.createElement('a');back.className='quiz-back-link';back.href=`quiz-library.html?local=1&student=${student}`;back.textContent='← 返回選卷與錯題';document.querySelector('.hero .wrap').append(back);
    }
    document.getElementById('quiz-identity').textContent = `本機合成學生 ${student}｜${descriptor.pool?'進度存於本機測試資料庫，尚未同步雲端':'不是正式學生帳號'}`;
    await quiz.handleAuthChange({ user: { id: `demo-student-${student}` } }); return;
  }
  // 課程導覽與 OAuth 仍由既有 navbar／navbar-auth 管理。
  const script = document.createElement('script'); script.src = 'navbar.js?v=20261028-roster'; script.dataset.homework = 'true';
  if (cloud) script.dataset.quiz = 'true';
  await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('導覽未能載入，請重新整理。')); document.getElementById('quiz-navbar').append(script); });
  const { initNavbarAuth } = await import('./navbar-auth.js');
  let authGeneration = 0, validatedUser = null, validatingUser = null, practiceRole = null;
  initNavbarAuth({ onSessionResolved(session) {
    const previousId = currentSession?.user?.id || null;
    currentSession = session;
    const id = session?.user?.id || null;
    if (previousId !== id) {
      practiceRole = null;
      delete document.getElementById('server-quiz').dataset.subject;
    }
    document.getElementById('quiz-identity').textContent = session?.user?.email
      ? cloud ? (practiceRole === 'teacher' ? '教師試答｜送出後儲存進度' : practiceRole === 'student' ? '學生練習｜送出後儲存進度' : '正在確認年級與儲存紀錄…') : session.user.email
      : '請先登入 Google 帳號';
    if (!cloud) { quiz.handleAuthChange(session).catch(e => { document.getElementById('entry-status').textContent = e.message; }); return; }
    if (id && previousId === id && (validatedUser === id || validatingUser === id)) return;
    const token = ++authGeneration; validatedUser = null; validatingUser = id;
    quiz.handleAuthChange(null);
    if (!id) return;
    // Auth callback 中只排程，不在鎖內等待 SDK；年級確認前不加入場次。
    setTimeout(async () => {
      try {
        const identity = await request('entry_context',{session_id:sessionId});
        if (token !== authGeneration || currentSession?.user?.id !== id) return;
        if(identity.role!=='student')throw new Error('考前練功房僅限名冊中的學生帳號使用。');
        const redirect = gradeRoute.quizStudentRedirect(identity, location.pathname, location.search);
        if (redirect) { location.replace(redirect); return; }
        practiceRole = identity.role;
        document.getElementById('server-quiz').dataset.subject = identity.subject || '';
        document.getElementById('quiz-identity').textContent = `${practiceRole === 'teacher' ? '教師試答' : '學生練習'}｜送出後儲存進度`;
        validatedUser = id; validatingUser = null;
        document.getElementById('entry-status').textContent = '';
        await quiz.handleAuthChange(currentSession);
      } catch (e) { if (token === authGeneration) { validatingUser = null; document.getElementById('quiz-identity').textContent = '年級或儲存紀錄尚未確認'; document.getElementById('entry-status').textContent = e.message; } }
    }, 0);
  } });
}
start().catch(e => { document.getElementById('entry-status').textContent = e.message; });
