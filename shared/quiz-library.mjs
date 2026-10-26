import { initNavbarAuth } from './navbar-auth.js';
import { createQuizRequest } from './quiz-api.mjs';
import { quizPageGrade, quizLibraryPath, quizStudentRedirect } from './quiz-grade-route.mjs';

let currentSession = null, generation = 0, papers = [], busy = false;
const el = id => document.getElementById(id);
const pageGrade = quizPageGrade(location.pathname);
el('grade-filter').value = String(pageGrade);
const request = await createQuizRequest({ getSession: () => currentSession });
const node = (tag, text, className) => {
  const n = document.createElement(tag); if (text !== undefined) n.textContent = text;
  if (className) n.className = className; return n;
};
const subjectIcons = { '國語':'fa-book-open', '英語':'fa-language', '數學':'fa-calculator', '社會':'fa-earth-asia', '自然':'fa-leaf' };
function render() {
  el('cloud-papers').replaceChildren();
  const subject = el('subject-filter').value;
  const shown = papers.filter(p => p.catalog?.volume?.startsWith(String(pageGrade)) && (!subject || p.catalog?.subject === subject));
  for (const p of shown) {
    const a = node('article', undefined, 'paper-card'); a.dataset.subject = p.catalog?.subject || '';
    const header = node('div', undefined, 'paper-card-header'), icon = node('span', undefined, 'subject-icon');
    const symbol = node('i', undefined, `fa-solid ${subjectIcons[p.catalog?.subject] || 'fa-book'}`); symbol.setAttribute('aria-hidden','true'); icon.append(symbol);
    const title = node('div'); title.append(node('p', p.catalog?.subject || '單元練習', 'paper-subject'), node('h2', p.catalog?.unit || p.title));
    header.append(icon,title); a.append(header);
    const body = node('div', undefined, 'paper-card-body');
    body.append(node('p', `${p.catalog?.volume || ''}・${p.catalog?.publisher || ''}・${p.total} 題`, 'meta'));
    const progress = node('progress'); progress.max = p.total; progress.value = p.answered;
    progress.setAttribute('aria-label', `已答 ${p.answered} 題，共 ${p.total} 題`);
    body.append(node('p', `已保存 ${p.answered}／${p.total} 題${p.answered ? `・答對 ${p.correct} 題` : ''}`, 'paper-progress-label'), progress);
    if (p.catalog?.difficulty) body.append(node('p', p.catalog.difficulty, 'meta'));
    const link = node('a', p.answered === p.total ? '查看作答與解析' : p.answered ? '接續練功 →' : '開始練功 →', 'paper-start');
    link.href = `quiz.html?cloud=1&session=${encodeURIComponent(p.id)}`; body.append(link); a.append(body); el('cloud-papers').append(a);
  }
  el('cloud-status').textContent = `顯示 ${shown.length} 卷・進度已從雲端讀取`;
}
async function load() {
  if (!currentSession?.user || busy) return;
  const token = generation; busy = true; el('refresh-library').disabled = true; el('cloud-status').textContent = '正在讀取雲端進度…';
  try {
    const data = await request('library_sessions');
    if (token !== generation) return;
    const redirect = quizStudentRedirect(data, location.pathname);
    if (redirect) { location.replace(redirect); return; }
    el('grade-filter-label').hidden = data.role !== 'teacher';
    papers = data.sessions;
    el('cloud-identity').textContent = data.role === 'teacher' ? '教師試答｜可切換年級檢視' : '學生練習｜進度已從雲端讀取';
    render();
  } catch (e) { if (token === generation) el('cloud-status').textContent = e.message; }
  finally { if (token === generation) { busy = false; el('refresh-library').disabled = false; } }
}
el('grade-filter').addEventListener('change', () => location.assign(quizLibraryPath(el('grade-filter').value)));
el('subject-filter').addEventListener('change', render);
el('refresh-library').addEventListener('click', load);
initNavbarAuth({ onSessionResolved(session) {
  const same = (session?.user?.id || null) === (currentSession?.user?.id || null);
  currentSession = session;
  el('cloud-identity').textContent = session?.user ? '已登入｜送出答案後會保存練習進度' : '尚未登入・登入後才能讀取及保存作答';
  el('cloud-lock').hidden = Boolean(session?.user); el('cloud-library').hidden = !session?.user;
  if (same) return;
  generation++; busy = false; papers = []; el('cloud-papers').replaceChildren(); el('cloud-status').textContent = '';
  el('grade-filter-label').hidden = true;
  if (session?.user) setTimeout(load, 0);
} });
