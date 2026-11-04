import {initNavbarAuth} from './navbar-auth.js';
import {resolveSession} from './auth.js';
import {createFoundationMilestoneSummary} from './typing-foundation-milestone-ui.mjs';

const grade = document.body.dataset.foundationGrade;
const zhuyin=document.body.dataset.foundationTrack==='zhuyin';
const courseId = `grade${grade}-115-1`;
let session = null;
let authReady=false;
function onSessionResolved(next) {
  if (!authReady && !next) return;
  if ((next?.user?.id || null) !== (session?.user?.id || null)) {
    document.querySelector('.practice-card')?.setAttribute('inert','');
    location.reload();
    return;
  }
  authReady=true;
  session = next;
}
try {
  session = await resolveSession();
  if (grade === '3') {
    const {initGoogleCourseAuth} = await import('./grade3-google-course.js?v=20261007-identity');
    await initGoogleCourseAuth({courseId});
  }
  initNavbarAuth({onSessionResolved});
  const response = await fetch('/prototypes/typing-foundation/level1/index.html?v=20261103-speed-text');
  if (!response.ok) throw new Error('介面讀取失敗');
  const doc = new DOMParser().parseFromString(await response.text(),'text/html');
  document.getElementById('foundation-root').replaceChildren(doc.querySelector('main'));
  const status = document.createElement('p'); status.id='cloud-status'; status.role='status';
  status.textContent='正在確認身分與讀取進度…'; status.className='cloud-status';
  const retry = document.createElement('button'); retry.id='cloud-retry'; retry.className='quiet'; retry.hidden=true; retry.textContent='重試連線';
  document.querySelector('.lesson-settings').after(status,retry);
  document.querySelector('footer p').textContent='基礎練習獨立於每週作業。小關進度雲端接續；大關過關計入成果，期末權重由教師另行設定。';
  document.querySelector('.growth small').textContent='基礎練習過關葉';
  document.querySelector('.badge').textContent='英打十二關';
  document.getElementById('tree-note').textContent='整關過關後，長出一片過關葉。';
  const treeLink=document.createElement('a');treeLink.href=`/my-tree.html?course=${courseId}`;treeLink.textContent='查看基礎練習努力樹';treeLink.className='underline text-cyan-700';document.querySelector('.growth').append(treeLink);
  const milestoneSummary=createFoundationMilestoneSummary(zhuyin?'zhuyin':'english');document.querySelector('.growth').after(milestoneSummary.element);
  const milestoneStyle=document.createElement('link');milestoneStyle.rel='stylesheet';milestoneStyle.href='/shared/typing-foundation-milestones.css?v=20261102-milestones';document.head.append(milestoneStyle);
  document.querySelector('.practice-card').inert=true;
  document.querySelector('.practice-card').setAttribute('data-google-activity','');
  document.getElementById('grade').value=grade;
  document.getElementById('grade').disabled=true;
  window.foundationConfig={grade,courseId,lessonKey:new URLSearchParams(location.search).get('lesson')||(zhuyin?'zhuyin-home-v1':'english-home-row-v1'),getSession:() => session,onProgress:records=>milestoneSummary.update(records)};
  if(zhuyin)await import('/shared/zhuyin-foundation-app.js?v=20261102-map-icons');
  else await import('/prototypes/typing-foundation/level1/app.js?v=20261103-speed-text');
} catch {
  initNavbarAuth();
  document.getElementById('foundation-root').textContent='練習介面暫時無法讀取，請重新整理。';
}
