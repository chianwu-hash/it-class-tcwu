import { initNavbarAuth } from './navbar-auth.js';
import { createQuizRequest } from './quiz-api.mjs?v=20261029-diagnostics-switch';
import { quizPageGrade, quizLibraryPath, quizStudentRedirect } from './quiz-grade-route.mjs';
import { initWrongQuestions } from './quiz-wrong-questions.mjs?v=20261029-load-batch2';
import { localPoolContext, initComposer, paperUrl } from './quiz-compose.mjs?v=20261029-load-batch1';
import {comparePapers,paperRange,paperTitle,paperMix,isExtension,paperDifficulty} from './quiz-paper-display.mjs';
import {difficultyAdjustment} from './quiz-difficulty.mjs';

let currentSession = null, generation = 0, papers = [], busy = false, studentView=false, reloadAfter=false, focusPaperId=null;
const el = id => document.getElementById(id);
const pageGrade = quizPageGrade(location.pathname);
el('grade-filter').value = String(pageGrade);
const localContext = localPoolContext();
const request = await createQuizRequest({ getSession: () => currentSession, local: Boolean(localContext), localStudent: localContext?.student });
const composer = initComposer({request,context:localContext});
const ownSection=document.createElement('section');ownSection.id='my-papers-section';ownSection.className='paper-collection collection-own';ownSection.hidden=true;ownSection.setAttribute('aria-labelledby','my-papers-title');
ownSection.innerHTML='<header class="collection-heading"><span class="collection-label">自己選範圍</span><h2 id="my-papers-title" tabindex="-1">我的自組卷 <span id="my-papers-count" class="collection-count"></span></h2><p>依科目、複習範圍與角色卷名找到練習，整理試卷，並接著作答。</p></header><p id="my-papers-empty" class="collection-empty" hidden>目前沒有符合篩選條件的自組卷，按「我要自組卷」試試看。</p><div id="my-papers" class="papers"></div>';
const presetSection=document.createElement('section');presetSection.id='system-papers-section';presetSection.className='paper-collection collection-preset';presetSection.setAttribute('aria-labelledby','system-papers-title');
presetSection.innerHTML='<header class="collection-heading"><span class="collection-label">已準備好的練習</span><h2 id="system-papers-title">老師準備的卷 <span id="system-papers-count" class="collection-count"></span></h2><p>各科單元卷已經準備好，選一份就能開始練習。</p></header><p id="system-papers-empty" class="collection-empty" hidden>目前沒有符合篩選條件的老師準備的卷。</p>';
el('cloud-papers').before(presetSection);presetSection.append(el('cloud-papers'));presetSection.before(ownSection);
document.addEventListener('quiz-paper-saved',()=>{if(busy)reloadAfter=true;else load({refreshComposer:false,refreshWrong:false});});
const wrongQuestions = initWrongQuestions({request,pageGrade,getUserId:()=>currentSession?.user?.id,onExtension:composer?.extend,canExtend:catalog=>composer?.canExtend(catalog),externalNavigation:true});
let activeView=location.hash==='#wrong'?'wrong':location.hash==='#mine'?'mine':'preset';
const tabs=document.createElement('div');tabs.className='library-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','選擇練習方式');
for(const [view,label,panel] of [['preset','老師準備的卷','system-papers-section'],['mine','我的自組卷','my-papers-section'],['wrong','我的錯題','wrong-panel']]){
 const b=document.createElement('button');b.type='button';b.id='tab-'+view;b.textContent=label;b.dataset.view=view;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel);tabs.append(b);const p=el(panel);p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby',b.id);p.tabIndex=-1;b.addEventListener('click',()=>showView(view));
 b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...tabs.children],i=buttons.indexOf(b),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;buttons[next].focus();buttons[next].click();});
}
el('cloud-library').querySelector('.filters').before(tabs);
const continueBox=document.createElement('section');continueBox.id='continue-practice';continueBox.className='continue-practice';continueBox.hidden=true;el('compose-entry').before(continueBox);
function applyView(){ownSection.hidden=activeView!=='mine'||!studentView;presetSection.hidden=activeView!=='preset';el('wrong-panel').hidden=activeView!=='wrong';el('cloud-library').querySelector('.filters').hidden=activeView==='wrong';el('cloud-status').hidden=activeView==='wrong';for(const b of tabs.children){const selected=b.dataset.view===activeView;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}}
function showView(view){activeView=view;history.replaceState(null,'',location.pathname+location.search+(view==='wrong'?'#wrong':view==='mine'?'#mine':''));applyView();wrongQuestions.activate(view==='wrong');}
function focusOwnPaper(){if(activeView!=='mine'||!focusPaperId)return;const card=[...el('my-papers').children].find(n=>n.dataset.sessionId===focusPaperId);if(card){card.querySelector('.paper-start').focus();focusPaperId=null;}}
document.addEventListener('quiz-show-own',e=>{el('subject-filter').value='';render();showView('mine');focusPaperId=e.detail.sessionId;el('my-papers-title').focus();focusOwnPaper();});
addEventListener('hashchange',()=>showView(location.hash==='#wrong'?'wrong':location.hash==='#mine'?'mine':'preset'));
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
  shown.sort(comparePapers);
  el('my-papers-empty').hidden=shown.some(p=>p.generated);
  const ownCount=shown.filter(p=>p.generated).length;
  el('my-papers-count').textContent=`${ownCount}卷`;el('system-papers-count').textContent=`${shown.length-ownCount}卷`;el('system-papers-empty').hidden=shown.length>ownCount;
  for (const p of shown) {
    const a = node('article', undefined, 'paper-card'); a.dataset.subject = p.catalog?.subject || '';
    a.dataset.source=p.generated?'own':'preset';
    a.dataset.kind=isExtension(p)?'extension':p.generated?'self':'preset';
    a.dataset.sessionId=p.id;
    const header = node('div', undefined, 'paper-card-header'), icon = node('span', undefined, 'subject-icon');
    const symbol = node('i', undefined, `fa-solid ${subjectIcons[p.catalog?.subject] || 'fa-book'}`); symbol.setAttribute('aria-hidden','true'); icon.append(symbol);
    const title = node('div'); title.append(node('span',isExtension(p)?'錯題延伸':p.generated?'自組卷':'老師準備的卷','paper-source-label'),node('p', p.catalog?.subject || '單元練習', 'paper-subject'), node('h3',p.generated?paperRange(p):p.catalog?.unit||p.title));
    header.append(icon,title); a.append(header);
    const body = node('div', undefined, 'paper-card-body');
    const level=paperDifficulty(p);body.append(node('p',`${p.total} 題${level?'・'+level:''}`,'meta paper-difficulty'));
    if(p.generated)body.append(node('p',paperTitle(p),'paper-name'));
    const progress = node('progress'); progress.max = p.total; progress.value = p.answered;
    progress.setAttribute('aria-label', `已答 ${p.answered} 題，共 ${p.total} 題`);
    body.append(node('p', `已作答 ${p.answered}／${p.total} 題${p.answered ? `・答對 ${p.correct} 題` : ''}`, 'paper-progress-label'), progress);
    const mix=paperMix(p);
    const adjustment=difficultyAdjustment(p.distribution);if(adjustment)body.append(node('p',adjustment,'meta paper-adjustment'));
    const link = node('a', p.answered === p.total ? '查看作答與解析' : p.answered ? '接續練功 →' : '開始練功 →', 'paper-start');
    link.href = paperUrl(p.id,localContext); body.append(link);
    if(p.generated||mix){
      const manage=node('details',undefined,'paper-manage'),summary=node('summary','試卷詳情');manage.append(summary);body.append(manage);
      if(mix)manage.append(node('p',mix,'meta paper-mix'));
      if(p.generated){
      manage.append(node('p',`試卷已儲存｜${new Date(p.saved_at).toLocaleString('zh-TW')}`,'meta'));
      const status=node('p');status.setAttribute('role','status');manage.append(status);
      const remove=node('button','刪除試卷','paper-delete');remove.type='button';manage.append(remove);
      remove.addEventListener('click',async()=>{
        if(remove.disabled)return;
        if(!confirm(`要刪除「${paperTitle(p)}」嗎？\n試卷會從「我的自組卷」移除，已儲存的作答與錯題紀錄會保留。`))return;
        const uid=currentSession?.user?.id,token=generation;remove.disabled=true;status.textContent='正在移除試卷…';
        try{await request('delete_paper',{session_id:p.id});if(token!==generation||currentSession?.user?.id!==uid)return;
          papers=papers.filter(x=>x.id!==p.id);render();el('cloud-status').textContent='已從「我的自組卷」移除試卷；作答與錯題紀錄已保留。';
          document.dispatchEvent(new CustomEvent('quiz-paper-removed',{detail:{sessionId:p.id}}));
        }catch(e){if(token===generation)status.textContent=e.message;}
        finally{if(token===generation)remove.disabled=false;}
      });
      }
    }
    a.append(body); (p.generated?el('my-papers'):el('cloud-papers')).append(a);
  }
  el('cloud-status').textContent = `進度已從${localContext?'本機測試資料庫':'雲端'}讀取`;
  renderContinue();
  focusOwnPaper();
}
function renderContinue(){
 continueBox.replaceChildren();
 const unfinished=papers.filter(p=>p.catalog?.volume?.startsWith(String(pageGrade))&&p.answered>0&&p.answered<p.total);
 // No last-answer timestamp in the existing payload; never label this as the last practiced paper.
 if(unfinished.length){const p=unfinished[0],a=node('a','繼續練習 →','paper-start');a.href=paperUrl(p.id,localContext);continueBox.append(node('h2','接著完成這份練習'),node('p',(p.catalog?.subject||'')+'・'+(paperRange(p)||p.title)+'｜已作答 '+p.answered+'／'+p.total+' 題'),a);}
 continueBox.hidden=!unfinished.length;applyView();
}
function showLock(message){
 el('cloud-library').hidden=true;el('cloud-lock').hidden=false;
 el('cloud-lock').querySelector('h2').textContent='僅限本校學生使用';
 const notes=el('cloud-lock').querySelectorAll('p');notes[0].textContent=message;notes[1].textContent='請使用115學年度三、六年級名冊中的學生 Google 帳號登入。';
}
async function load({refreshComposer=true,refreshWrong=true}={}) {
  if (!currentSession?.user || busy) return;
  const token = generation; busy = true; el('refresh-library').disabled = true; el('cloud-status').textContent = '正在讀取雲端進度…';
  try {
    const data = await request('library_sessions');
    if (token !== generation) return;
    if(data.role!=='student')throw Object.assign(new Error('考前練功房僅限名冊中的學生帳號使用。'),{code:'student_required'});
    const redirect = quizStudentRedirect(data, location.pathname);
    if (redirect) { location.replace(redirect); return; }
    el('grade-filter-label').hidden=true;
    el('cloud-lock').hidden=true;el('cloud-library').hidden=false;
    papers = data.sessions;
    studentView=data.role==='student';
    el('cloud-identity').textContent = localContext ? `本機合成學生 ${localContext.student}｜進度存於本機測試資料庫，尚未同步雲端` : data.role === 'teacher' ? '教師試答｜可切換年級檢視' : '學生練習｜進度已從雲端讀取';
    render();
    if(refreshComposer)await composer?.ready({student:data.role==='student'});
    // Saving a paper updates the cards, while the current wrong-answer explanation stays open.
    if(refreshWrong){wrongQuestions.ready();if(activeView==='wrong')wrongQuestions.activate(true);}
  } catch (e) { if (token === generation) {studentView=false;papers=[];composer.reset();wrongQuestions.reset();el('cloud-papers').replaceChildren();el('my-papers').replaceChildren();continueBox.replaceChildren();continueBox.hidden=true;el('cloud-identity').textContent='尚未取得學生使用資格';showLock(['student_required','roster_required','login_required'].includes(e.code)?e.message:'暫時無法確認學生資格，請稍後重新整理。');} }
  finally { if (token === generation) { busy = false; el('refresh-library').disabled = false;if(reloadAfter){reloadAfter=false;setTimeout(()=>load({refreshComposer:false,refreshWrong:false}),0);} } }
}
el('grade-filter').addEventListener('change', () => location.assign(quizLibraryPath(el('grade-filter').value)));
el('subject-filter').addEventListener('change', render);
el('refresh-library').addEventListener('click', () => load({refreshComposer:false}));
if (localContext) {
  const localInfo = await fetch('/__quiz-local').then(r=>r.json());
  if (!localInfo.pool) throw new Error('本機題庫服務尚未啟動。');
  currentSession = localContext.session;
  document.querySelector('.library-description').textContent='各科期中練習：自己選範圍與難度組卷，核對答案與解析。此處使用合成身分與本機測試資料庫。';
  document.querySelector('.library-parent').href='quiz-library.html?local=1&student='+localContext.student;
  el('refresh-library').textContent='更新本機進度';
  el('cloud-lock').hidden=true;el('cloud-library').hidden=false;
  await load();
} else initNavbarAuth({ onSessionResolved(session) {
  const same = (session?.user?.id || null) === (currentSession?.user?.id || null);
  currentSession = session;
  if (same) {if(!session?.user){el('cloud-identity').textContent='尚未登入・僅限名冊中的學生使用';showLock('請使用名冊中的學生帳號登入後開始練習。');}return;}
  el('cloud-identity').textContent=session?.user?'正在確認學生資格…':'尚未登入・僅限名冊中的學生使用';
  showLock(session?.user?'正在確認學生資格，請稍候…':'請使用名冊中的學生帳號登入後開始練習。');
  reloadAfter=false;focusPaperId=null;
  generation++; busy = false; papers = []; el('cloud-papers').replaceChildren(); el('cloud-status').textContent = '';
  studentView=false;el('my-papers').replaceChildren();ownSection.hidden=true;ownSection.dataset.enabled='false';continueBox.hidden=true;continueBox.replaceChildren();activeView=same?activeView:location.hash==='#wrong'?'wrong':location.hash==='#mine'?'mine':'preset';el('subject-filter').value='';applyView();
  wrongQuestions.reset();
  composer?.reset();
  el('grade-filter-label').hidden = true;
  if (session?.user) setTimeout(load, 0);
} });
