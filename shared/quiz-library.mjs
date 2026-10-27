import { initNavbarAuth } from './navbar-auth.js';
import { createQuizRequest } from './quiz-api.mjs?v=20261027-delete';
import { quizPageGrade, quizLibraryPath, quizStudentRedirect } from './quiz-grade-route.mjs';
import { initWrongQuestions } from './quiz-wrong-questions.mjs';
import { localPoolContext, initComposer, paperUrl } from './quiz-compose.mjs';

let currentSession = null, generation = 0, papers = [], busy = false, studentView=false;
const el = id => document.getElementById(id);
const pageGrade = quizPageGrade(location.pathname);
el('grade-filter').value = String(pageGrade);
const localContext = localPoolContext();
const request = await createQuizRequest({ getSession: () => currentSession, local: Boolean(localContext), localStudent: localContext?.student });
const composer = pageGrade === 3 ? initComposer({request,context:localContext}) : null;
const ownSection=document.createElement('section');ownSection.id='my-papers-section';ownSection.className='paper-collection collection-own';ownSection.hidden=true;ownSection.setAttribute('aria-labelledby','my-papers-title');
ownSection.innerHTML='<header class="collection-heading"><span class="collection-label">自己選範圍</span><h2 id="my-papers-title">我的自組卷 <span id="my-papers-count" class="collection-count"></span></h2><p>自己組的卷與錯題延伸卷，可以改名、整理，並接著作答。</p></header><p id="my-papers-empty" class="collection-empty" hidden>目前沒有符合篩選條件的自組卷，可以從上方選擇範圍組一份。</p><div id="my-papers" class="papers"></div>';
const presetSection=document.createElement('section');presetSection.id='system-papers-section';presetSection.className='paper-collection collection-preset';presetSection.setAttribute('aria-labelledby','system-papers-title');
presetSection.innerHTML='<header class="collection-heading"><span class="collection-label">已準備好的練習</span><h2 id="system-papers-title">系統預設卷 <span id="system-papers-count" class="collection-count"></span></h2><p>各科單元卷已經準備好，選一份就能開始練習。</p></header><p id="system-papers-empty" class="collection-empty" hidden>目前沒有符合篩選條件的系統預設卷。</p>';
el('cloud-papers').before(presetSection);presetSection.append(el('cloud-papers'));presetSection.before(ownSection);
document.addEventListener('quiz-paper-saved',()=>load({refreshComposer:false}));
const wrongQuestions = initWrongQuestions({request,pageGrade,getUserId:()=>currentSession?.user?.id,onExtension:composer?.extend,canExtend:()=>document.getElementById('quiz-composer')?.dataset.available==='true'});
const node = (tag, text, className) => {
  const n = document.createElement(tag); if (text !== undefined) n.textContent = text;
  if (className) n.className = className; return n;
};
const subjectIcons = { '國語':'fa-book-open', '英語':'fa-language', '數學':'fa-calculator', '社會':'fa-earth-asia', '自然':'fa-leaf' };
function render() {
  el('cloud-papers').replaceChildren();
  el('my-papers').replaceChildren();ownSection.dataset.enabled=String(Boolean(composer&&studentView));ownSection.hidden=ownSection.dataset.enabled!=='true';
  const subject = el('subject-filter').value;
  const shown = papers.filter(p => p.catalog?.volume?.startsWith(String(pageGrade)) && (!subject || p.catalog?.subject === subject));
  shown.sort((a,b)=>Date.parse(b.saved_at||0)-Date.parse(a.saved_at||0));
  el('my-papers-empty').hidden=shown.some(p=>p.generated);
  const ownCount=shown.filter(p=>p.generated).length;
  el('my-papers-count').textContent=`${ownCount}卷`;el('system-papers-count').textContent=`${shown.length-ownCount}卷`;el('system-papers-empty').hidden=shown.length>ownCount;
  for (const p of shown) {
    const a = node('article', undefined, 'paper-card'); a.dataset.subject = p.catalog?.subject || '';
    a.dataset.source=p.generated?'own':'preset';
    a.dataset.sessionId=p.id;
    const header = node('div', undefined, 'paper-card-header'), icon = node('span', undefined, 'subject-icon');
    const symbol = node('i', undefined, `fa-solid ${subjectIcons[p.catalog?.subject] || 'fa-book'}`); symbol.setAttribute('aria-hidden','true'); icon.append(symbol);
    const title = node('div'); title.append(node('span',p.generated?'自組卷':'系統預設卷','paper-source-label'),node('p', p.catalog?.subject || '單元練習', 'paper-subject'), node('h2', p.generated ? p.display_name||p.title : p.catalog?.unit || p.title));
    header.append(icon,title); a.append(header);
    const body = node('div', undefined, 'paper-card-body');
    body.append(node('p', `${p.catalog?.volume || ''}・${p.catalog?.publisher || ''}・${p.total} 題`, 'meta'));
    const progress = node('progress'); progress.max = p.total; progress.value = p.answered;
    progress.setAttribute('aria-label', `已答 ${p.answered} 題，共 ${p.total} 題`);
    body.append(node('p', `已保存 ${p.answered}／${p.total} 題${p.answered ? `・答對 ${p.correct} 題` : ''}`, 'paper-progress-label'), progress);
    if (p.catalog?.difficulty) body.append(node('p', p.catalog.difficulty, 'meta'));
    const link = node('a', p.answered === p.total ? '查看作答與解析' : p.answered ? '接續練功 →' : '開始練功 →', 'paper-start');
    link.href = paperUrl(p.id,localContext); body.append(link);
    if(p.generated){
      body.append(node('p',p.catalog?.unit||'','meta'),node('p',`已儲存｜${new Date(p.saved_at).toLocaleString('zh-TW')}`,'meta'));
      const form=node('form',undefined,'paper-rename'),label=node('label','試卷名稱'),input=node('input');input.type='text';input.maxLength=60;input.required=true;input.value=p.display_name||p.title;input.setAttribute('aria-label','試卷名稱');label.append(input);
      const save=node('button','儲存名稱'),status=node('p');save.type='submit';status.setAttribute('role','status');form.append(label,save,status);body.append(form);
      form.addEventListener('submit',async e=>{e.preventDefault();const name=input.value.trim();if(!name){status.textContent='請輸入試卷名稱。';return;}const uid=currentSession?.user?.id,token=generation;save.disabled=true;input.disabled=true;status.textContent='正在儲存名稱…';try{const r=await request('rename_paper',{session_id:p.id,name});if(token!==generation||currentSession?.user?.id!==uid)return;p.display_name=r.display_name;title.querySelector('h2').textContent=r.display_name;input.value=r.display_name;status.textContent='名稱已儲存。';}catch(e){if(token===generation)status.textContent=e.message;}finally{if(token===generation){save.disabled=false;input.disabled=false;}}});
      const remove=node('button','刪除試卷','paper-delete');remove.type='button';body.append(remove);
      remove.addEventListener('click',async()=>{
        if(remove.disabled||save.disabled)return;
        if(!confirm(`要刪除「${p.display_name||p.title}」嗎？\n試卷會從「我的自組卷」移除，已保存的作答與錯題紀錄會保留。`))return;
        const uid=currentSession?.user?.id,token=generation;remove.disabled=true;save.disabled=true;input.disabled=true;status.textContent='正在移除試卷…';
        try{await request('delete_paper',{session_id:p.id});if(token!==generation||currentSession?.user?.id!==uid)return;
          papers=papers.filter(x=>x.id!==p.id);render();el('cloud-status').textContent='已從「我的自組卷」移除試卷；作答與錯題紀錄已保留。';
          document.dispatchEvent(new CustomEvent('quiz-paper-removed',{detail:{sessionId:p.id}}));
        }catch(e){if(token===generation)status.textContent=e.message;}
        finally{if(token===generation){remove.disabled=false;save.disabled=false;input.disabled=false;}}
      });
    }
    a.append(body); (p.generated?el('my-papers'):el('cloud-papers')).append(a);
  }
  el('cloud-status').textContent = `顯示 ${shown.length} 卷・進度已從${localContext?'本機測試資料庫':'雲端'}讀取`;
}
async function load({refreshComposer=true}={}) {
  if (!currentSession?.user || busy) return;
  const token = generation; busy = true; el('refresh-library').disabled = true; el('cloud-status').textContent = '正在讀取雲端進度…';
  try {
    const data = await request('library_sessions');
    if (token !== generation) return;
    const redirect = quizStudentRedirect(data, location.pathname);
    if (redirect) { location.replace(redirect); return; }
    el('grade-filter-label').hidden = data.role !== 'teacher';
    papers = data.sessions;
    studentView=data.role==='student';
    el('cloud-identity').textContent = localContext ? `本機合成學生 ${localContext.student}｜進度存於本機測試資料庫，尚未同步雲端` : data.role === 'teacher' ? '教師試答｜可切換年級檢視' : '學生練習｜進度已從雲端讀取';
    render();
    if(refreshComposer)await composer?.ready();
    wrongQuestions.ready();
  } catch (e) { if (token === generation) el('cloud-status').textContent = e.message; }
  finally { if (token === generation) { busy = false; el('refresh-library').disabled = false; } }
}
el('grade-filter').addEventListener('change', () => location.assign(quizLibraryPath(el('grade-filter').value)));
el('subject-filter').addEventListener('change', render);
el('refresh-library').addEventListener('click', load);
if (localContext) {
  const localInfo = await fetch('/__quiz-local').then(r=>r.json());
  if (!localInfo.pool) throw new Error('本機題庫服務尚未啟動。');
  currentSession = localContext.session;
  document.querySelector('.library-description').textContent='三上數學全冊：自己選單元組卷，從錯題找同一個重點再練。此處為本機試作。';
  document.querySelector('.library-parent').href='quiz-library.html?local=1&student='+localContext.student;
  el('refresh-library').textContent='更新本機進度';
  el('cloud-lock').hidden=true;el('cloud-library').hidden=false;
  await load();
} else initNavbarAuth({ onSessionResolved(session) {
  const same = (session?.user?.id || null) === (currentSession?.user?.id || null);
  currentSession = session;
  el('cloud-identity').textContent = session?.user ? '已登入｜送出答案後會保存練習進度' : '尚未登入・登入後才能讀取及保存作答';
  el('cloud-lock').hidden = Boolean(session?.user); el('cloud-library').hidden = !session?.user;
  if (same) return;
  generation++; busy = false; papers = []; el('cloud-papers').replaceChildren(); el('cloud-status').textContent = '';
  studentView=false;el('my-papers').replaceChildren();ownSection.hidden=true;ownSection.dataset.enabled='false';
  wrongQuestions.reset();
  composer?.reset();
  el('grade-filter-label').hidden = true;
  if (session?.user) setTimeout(load, 0);
} });
