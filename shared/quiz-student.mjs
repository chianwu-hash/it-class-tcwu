import { initQuizModule } from './quiz-module.js';
import { createQuizRequest } from './quiz-api.mjs';
import { initImageLightbox } from './image-lightbox.js';

initImageLightbox({ root: document.getElementById('server-quiz'), selector: 'img', initialScale: 0.8, minScale: 0.2, zoomStep: 0.1 });

const params = new URLSearchParams(location.search), sessionId = params.get('session');
const local = params.get('local') === '1' && ['127.0.0.1', 'localhost'].includes(location.hostname);
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
    if (!(await fetch('/__quiz-local').then(r => r.json())).local) throw new Error('本機服務尚未啟動。');
    document.getElementById('quiz-identity').textContent = `本機合成學生 ${student}｜不是正式學生帳號`;
    await quiz.handleAuthChange({ user: { id: `demo-student-${student}` } }); return;
  }
  // 課程導覽與 OAuth 仍由既有 navbar／navbar-auth 管理。
  const script = document.createElement('script'); script.src = 'navbar.js?v=20261024'; script.dataset.homework = 'true';
  await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('導覽未能載入，請重新整理。')); document.getElementById('quiz-navbar').append(script); });
  const { initNavbarAuth } = await import('./navbar-auth.js');
  initNavbarAuth({ onSessionResolved(session) {
    currentSession = session;
    document.getElementById('quiz-identity').textContent = session?.user?.email || '請先登入學校帳號';
    quiz.handleAuthChange(session).catch(e => { document.getElementById('entry-status').textContent = e.message; });
  } });
}
start().catch(e => { document.getElementById('entry-status').textContent = e.message; });
