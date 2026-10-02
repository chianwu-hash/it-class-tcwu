import { renderEnglishKeyboardGuide } from '../../../shared/typing-tools.js?v=20260922';
import { generateExercise } from './exercises.mjs?v=20261002-course';
import { getPolicy, evaluateAttempt, createClock } from './grading.mjs?v=20261002-course';
import { createTypingFingerGuide, fingerLabel, physicalKey, needsShift } from '../../../shared/typing-finger-guide.mjs?v=20261002-course';
import {getLesson,lessons} from '../../../shared/typing-foundation-curriculum.mjs';

// Discussion prototype only: no auth, persistence, official progress or rewards.
const originalStages = [
  { title: '食指定位', keys: 'F · J · 空白', hint: '摸到小凸點了嗎？F 用左手食指，J 用右手食指。' },
  { title: '中指加入', keys: 'D · K', hint: 'D 用左手中指，K 用右手中指。食指繼續守住 F、J。' },
  { title: '無名指加入', keys: 'S · L', hint: 'S 用左手無名指，L 用右手無名指，按完輕輕放回原位。' },
  { title: '小指加入', keys: 'A · ;', hint: 'A 用左手小指，分號 ; 用右手小指，不需要按 Shift。' },
  { title: '食指伸展', keys: 'G · H', hint: '左手食指從 F 伸向 G，右手食指從 J 伸向 H，按完回家。' },
  { title: '基準列挑戰', keys: '整列混合', hint: '讓每根手指負責自己的按鍵。慢慢打，不必搶快。' },
];
const lesson=getLesson(new URLSearchParams(location.search).get('lesson')||undefined);
const stages=lesson.number===1?originalStages:lesson.stages;
const lessonName=`第 ${lesson.number} 關`;
document.title=`${lessonName}・${lesson.title}｜英打基礎練習`;
const fingers = { f:'左手食指', g:'左手食指', j:'右手食指', h:'右手食指', d:'左手中指', k:'右手中指', s:'左手無名指', l:'右手無名指', a:'左手小指', ';':'右手小指', ' ':'選慣用的拇指' };
const $ = id => document.getElementById(id);
document.querySelector('.heading h1').textContent=lesson.title;
document.querySelector('.heading .eyebrow').textContent=`小小打字探險家 · 第 ${lesson.number} / 12 關`;
document.querySelector('.subtitle').textContent=lesson.description;
document.querySelector('.journey > .eyebrow').textContent=`${lessonName}的 6 個小步驟`;
document.querySelector('.overline').textContent='照順序輸入，注意大小寫；␣ 代表空白鍵';
document.querySelector('.keyboard-heading small').textContent='依題目大小寫輸入；Shift 用另一手';
document.querySelector('.badge').textContent=window.foundationConfig?'英打十二關':'十二關本機試玩';
$('tree-note').textContent=`完成${lessonName}，長出一片葉子。`;
if(lesson.number>1){
 document.querySelector('.intro-symbol').textContent=String(lesson.number).padStart(2,'0');
 document.querySelector('#intro h2').textContent=lesson.title;
 document.querySelector('#intro p').textContent=lesson.description+' 左手食指回 F，右手食指回 J，準備好再開始。';
}
const fingerGuide = createTypingFingerGuide($('finger-guide'));
$('show-fingers').addEventListener('change', () => {
  updateFingerVisibility();
  // Keep native checkbox keyboard behavior: Tab returns to the exercise.
});
let stage = 0, row = 0, position = 0, correct = 0, errors = 0, streak = 0;
const previousExercises = new Map();
let mode = 'intro', rows = [], wrongKeys = {}, missed = false;
let policy = getPolicy('3'), confirmations = 0, interrupted = false;
let clock = createClock(), ticker = null, bestWpm = 0;
const isChallenge = () => stage === stages.length - 1;
let fingerGuideStage = null;
function updateFingerVisibility() {
  const visible=$('show-fingers').checked;
  $('finger-guide').hidden=!visible;
  $('target-line').hidden=isChallenge() && !visible;
}
const speedText = value => (Math.floor(value * 10) / 10).toFixed(1);
const cloudConfig = window.foundationConfig;
let cloud = null, cloudStarted = false, transitioning = false, savedCheckpoint = 0, savedCompleted = false;
let reviewing = false, saving = false, switchDialog = false;
let courseRecords=[];
const courseMap=document.createElement('details');courseMap.className='course-map';
courseMap.innerHTML='<summary>十二關學習地圖（選擇關卡）</summary><div class="course-links"></div><p>依序解鎖；已過關可重練。每關一片葉子，不重複領取。</p>';
document.querySelector('.layout').before(courseMap);
function renderCourseMap(){
  const container=courseMap.querySelector('.course-links');container.replaceChildren();
  lessons.forEach((item,index)=>{
    const done=courseRecords.some(r=>r.lesson_key===item.key&&r.completed);
    const unlocked=!cloudConfig||lessons.slice(0,index).every(l=>courseRecords.some(r=>r.lesson_key===l.key&&r.completed));
    const button=document.createElement('button');button.type='button';button.className='quiet';
    button.textContent=`${done?'✓':unlocked?'':'🔒'} ${item.number}. ${item.title}`;
    button.disabled=!unlocked||saving||transitioning;
    if(item.key===lesson.key)button.setAttribute('aria-current','page');
    button.onclick=async()=>{if(!await canSwitchPractice())return;const url=new URL(location.href);url.searchParams.set('lesson',item.key);location.href=url.href;};
    container.append(button);
  });
}
renderCourseMap();
const currentStage = () => Math.min(savedCheckpoint, stages.length - 1);
const isUnlocked = i => savedCompleted || i < savedCheckpoint;
const cloudStatus = message => { if (cloudConfig) $('cloud-status').textContent=message; };
function earnLeaf() {
  $('tree-title').textContent=`${lessonName}的葉子，長出來了`;
  $('tree-note').textContent='重練可以進步，這片葉子只領一次。';
  document.querySelector('.growth').classList.add('earned');
  document.querySelector('.growth svg').setAttribute('aria-label',`完成${lessonName}，樹苗長出新葉`);
}

function updatePolicy() {
  policy = getPolicy($('grade').value, $('grade').value === '6' && $('starter').checked,lesson);
  $('starter-label').hidden = $('grade').value !== '6';
  $('starter-label').lastChild.textContent=` 初學起步：${lesson.starterSpeed} WPM`;
  $('goal-rule').textContent = `初練 90% · 過關 95%＋${policy.speed} WPM，連續兩次`;
  $('policy-note').textContent = `初練不限速度；綜合挑戰 95%＋${policy.speed} WPM，連續兩組新題達標。精進目標：95%＋${policy.stretchSpeed} WPM。`;
}
function assessment() {
  return evaluateAttempt({correct, errors, elapsedMs:clock.elapsed(), challenge:isChallenge(), interrupted, policy});
}
function timing() {
  const elapsed = clock.elapsed();
  const seconds = Math.floor(elapsed / 1000);
  $('time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;
  $('speed').textContent = elapsed > 0 && correct ? speedText(assessment().wpm) : '—';
}
function startTicker() { clearInterval(ticker); ticker = setInterval(timing, 250); }
$('grade').addEventListener('change', updatePolicy);
$('starter').addEventListener('change', updatePolicy);
updatePolicy();

renderEnglishKeyboardGuide($('keyboard'), { target: 'fj' });
const keyboardRows = $('keyboard').querySelectorAll('.typing-letter-row');
const semicolon = document.createElement('kbd');
semicolon.className = 'typing-letter-key'; semicolon.dataset.key = ';';
semicolon.innerHTML = '<span>;</span><small>;</small>';
keyboardRows[1].append(semicolon);
const space = document.createElement('kbd');
space.className = 'typing-letter-key space-key'; space.dataset.key = ' ';
space.textContent = '空白鍵';
$('keyboard').querySelector('.typing-letter-keyboard').append(space);
const keyboardRoot=$('keyboard').querySelector('.typing-letter-keyboard');
const addKey=(row,key,label=key)=>{const el=document.createElement('kbd');el.className='typing-letter-key';el.dataset.key=key;el.textContent=label;row.append(el);};
const numberRow=document.createElement('div');numberRow.className='typing-letter-row';
for(const key of '`1234567890-=')addKey(numberRow,key);
keyboardRoot.prepend(numberRow);
for(const key of '[]\\')addKey(keyboardRows[0],key);
addKey(keyboardRows[1],"'");
for(const key of ',./')addKey(keyboardRows[2],key);
const shiftRow=document.createElement('div');shiftRow.className='typing-letter-row';
addKey(shiftRow,'ShiftLeft','左 Shift');addKey(shiftRow,'ShiftRight','右 Shift');keyboardRoot.append(shiftRow);
const keyElements = [...$('keyboard').querySelectorAll('[data-key]')];
keyElements.forEach(el => {
  el.classList.toggle('home-key', 'asdfghjkl;'.includes(el.dataset.key));
  el.classList.toggle('anchor-key', ['f','j'].includes(el.dataset.key));
});

function accuracy() { return correct + errors ? correct / (correct + errors) * 100 : 0; }
function show(section) {
  ['intro','exercise','result','paused'].forEach(id => { $(id).hidden = id !== section; });
}
function steps() {
  renderCourseMap();
  $('steps').innerHTML = stages.map((s, i) => `<li class="${isUnlocked(i) ? 'done ' : ''}${i === stage ? 'current' : ''}" ${i === stage ? 'aria-current="step"' : ''}><button type="button" class="step-link" data-stage="${i}" ${!isUnlocked(i) || saving || transitioning ? 'disabled' : ''} aria-label="${s.title}，${isUnlocked(i) ? '已過關，重新練習' : '尚未過關'}"><span class="step-number">${isUnlocked(i) ? '✓' : String(i + 1).padStart(2,'0')}</span><span><strong>${s.title}</strong><small>${s.keys}</small></span></button></li>`).join('');
  $('stage-label').textContent = `${String(stage + 1).padStart(2,'0')} · ${stages[stage].title}${reviewing ? ' · 重練' : ''}`;
  $('return-progress').hidden = !reviewing;
}
async function canSwitchPractice() {
  if (saving || transitioning || (cloudConfig && !cloud)) return false;
  if (!['playing','paused'].includes(mode) || !(correct + errors)) return true;
  const wasPlaying=mode==='playing';
  clock.pause(); switchDialog=true;
  const dialog=$('switch-practice');
  const accepted=await new Promise(resolve=>{
    const close=()=>{dialog.removeEventListener('close',close);resolve(dialog.returnValue==='switch');};
    dialog.returnValue='cancel';dialog.addEventListener('close',close);dialog.showModal();
  });
  switchDialog=false;
  if (wasPlaying) clock.resume();
  if (!accepted && wasPlaying) $('typing-area').focus();
  return accepted;
}
$('steps').addEventListener('click', async e => {
  const button=e.target.closest('button[data-stage]');
  if (!button) return;
  const next=Number(button.dataset.stage);
  if (!isUnlocked(next) || !await canSwitchPractice()) return;
  reviewing=true; stage=next; begin();
});
$('return-progress').addEventListener('click', async () => {
  if (!await canSwitchPractice()) return;
  reviewing=false; stage=currentStage(); begin();
});
function setFeedback(message, error = false) {
  $('feedback').textContent = message; $('feedback').classList.toggle('error', error);
}
function displayKey(key) { return key === ' ' ? '空白鍵' : key; }
function draw() {
  const text = rows[row];
  const groups = [];
  let group = document.createElement('div');
  group.className = 'prompt-group';
  [...text].forEach((char, i) => {
    const el = document.createElement('span'); el.textContent = char === ' ' ? '␣' : char;
    el.className = i < position ? 'typed' : i === position ? `active${missed ? ' missed' : ''}` : '';
    group.append(el);
    if (char === ' ' || i === text.length - 1) {
      groups.push(group);
      group = document.createElement('div');
      group.className = 'prompt-group';
    }
  });
  $('prompt').replaceChildren(...groups);
  const key = text[position];
  $('target').textContent = key === ' ' ? '␣' : key.toUpperCase();
  $('finger').textContent = fingerLabel(key);
  fingerGuide.update(key,fingerLabel(key));
  $('finger-note').textContent=key===' ' ? '兩個拇指擇一，不必同時按。' : key==='g' ? '左手食指伸向 G，按完回到 F。' : key==='h' ? '右手食指伸向 H，按完回到 J。' : '亮起的手指負責這個鍵。';
  if(needsShift(key))$('finger-note').textContent='兩手配合：另一手小指按住 Shift，再按目標鍵。';
  keyElements.forEach(el => el.classList.toggle('is-target', !isChallenge() && (el.dataset.key === physicalKey(key)||needsShift(key)&&el.dataset.key===(fingerLabel(key).startsWith('左')?'ShiftRight':'ShiftLeft'))));
  const total = rows.reduce((n, r) => n + r.length, 0);
  $('progress').style.width = `${correct / total * 100}%`;
  $('count').textContent = `第 ${row + 1} / ${rows.length} 行 · ${correct} / ${total} 鍵`;
  $('accuracy').textContent = correct + errors ? `${Math.floor(accuracy())}%` : '—';
  $('streak').textContent = streak;
  timing();
}
async function begin() {
  if (transitioning) return;
  if (cloudConfig && !cloud) return;
  transitioning=true;
  if (cloud && !cloudStarted && !reviewing) {
    $('start').disabled=true;
    try {
      const saved = await cloud.start($('starter').checked);
      cloudStarted=true;
      $('starter').checked=saved.starter; updatePolicy();
      savedCheckpoint=saved.checkpoint; savedCompleted=saved.completed;
      stage=Math.min(saved.checkpoint,5);
      cloudStatus('已連線，完成小關後會自動儲存。');
    } catch(error) { cloudStatus(error.message); $('start').disabled=false; transitioning=false; return; }
  }
  rows = generateExercise(stage, previousExercises.get(stage),Math.random,lesson.key);
  previousExercises.set(stage, rows);
  row = position = correct = errors = streak = 0; wrongKeys = {}; missed = false;
  clock = createClock(); interrupted = false;
  $('grade').disabled = $('starter').disabled = true;
  if (fingerGuideStage !== stage) {
    $('show-fingers').checked = !isChallenge();
    fingerGuideStage = stage;
  }
  $('finger-controls').hidden = false;
  $('finger-controls-note').textContent = isChallenge() ? '挑戰預設不提示，需要時可開啟。' : '從自己上方看雙手';
  updateFingerVisibility();
  $('attempt-rule').textContent = isChallenge()
    ? `過關挑戰：95%＋${policy.speed} WPM · 連續達標 ${confirmations}/2。按第一個字開始計時，暫停或切分頁後本次只作練習。`
    : '初練：正確率達 90% 即可前進，速度只供參考。按第一個字開始計時。';
  mode = 'playing'; show('exercise'); draw();
  startTicker();
  setFeedback(isChallenge() ? '依題目順序打字，讓每根手指負責自己的按鍵。' : stages[stage].hint); $('typing-area').focus();
  transitioning=false;
  steps();
}
function finish() {
  clock.pause(); clearInterval(ticker); timing();
  const score = assessment();
  if (reviewing) {
    mode='review-result';
    $('progress').style.width='100%'; $('count').textContent='重練完成';
    $('result-icon').textContent=score.passed ? '✓' : '↻';
    $('result-title').textContent=`${stages[stage].title}，重練完成！`;
    $('result-text').textContent='原本的過關成果保留；本次重練不改變進度，也不重複領取努力樹成果。';
    $('result-stats').textContent=`本次：正確 ${correct} 次 · 按錯 ${errors} 次 · 正確率 ${Math.floor(score.accuracy)}% · ${speedText(score.wpm)} WPM · ${$('time').textContent}`;
    $('continue').textContent='再練一次 →'; $('retry').hidden=false; $('retry').textContent='回到目前進度';
    $('continue').disabled=$('retry').disabled=false;
    steps(); show('result'); $('continue').focus(); return;
  }
  if (isChallenge()) confirmations = score.passed ? confirmations + 1 : 0;
  const final = isChallenge() && confirmations >= policy.confirmations;
  const passed = score.passed;
  mode = final || (!isChallenge() && passed) ? 'passed' : passed ? 'confirm' : 'retry';
  if (isChallenge() && score.eligible && score.accuracyPassed) bestWpm = Math.max(bestWpm, score.wpm);
  $('progress').style.width = '100%';
  $('count').textContent = passed ? '本段完成' : '完成練習 · 再試一次';
  const weakest = Object.entries(wrongKeys).sort((a,b) => b[1]-a[1])[0]?.[0];
  $('result-icon').textContent = passed ? '✓' : '↻';
  $('result-title').textContent = final ? `${lessonName}過關，打得準也打得順！` : isChallenge() && passed ? '第一次達標！再換一組確認' : passed ? `${stages[stage].title}，完成！` : '練習完成，換一組再試';
  const reasons = [];
  if (!score.accuracyPassed) reasons.push(`正確率還需要達到 ${isChallenge() ? 95 : 90}%。${weakest ? `先練練 ${displayKey(weakest)}。` : ''}`);
  if (!score.speedPassed) reasons.push(`速度目標為 ${policy.speed} WPM；這次是 ${speedText(score.wpm)} WPM。`);
  if (!score.eligible) reasons.push('這次曾暫停或離開頁面，保留練習結果，下一組重新做速度確認。');
  $('result-text').textContent = final
    ? `兩組不同題目都達到 95%＋${policy.speed} WPM，這片葉子記下你的努力。${score.wpm >= policy.stretchSpeed ? '也達到精進目標了！' : `接著可以朝 ${policy.stretchSpeed} WPM 精進。`}`
    : isChallenge() && passed ? '已連續達標 1/2。再完成一組不同題目，就能確認本關過關。'
    : passed ? '你仔細跟著按鍵前進，現在準備讓下一組手指加入。' : `${reasons.join(' ')}${isChallenge() ? '連續達標重新從 0/2 開始，只重練綜合挑戰。' : '只重練這一段就好。'}`;
  $('result-stats').textContent = `本次：正確 ${correct} 次 · 按錯 ${errors} 次 · 正確率 ${Math.floor(score.accuracy)}% · ${speedText(score.wpm)} WPM · ${$('time').textContent}${isChallenge() ? ` · 連續達標 ${confirmations}/2${bestWpm ? ` · 95%以上最佳速度 ${speedText(bestWpm)} WPM` : ''}` : ''}`;
  $('continue').textContent = final ? (lesson.number<12?'前往下一關 →':'十二關完成，繼續精進 →') : isChallenge() ? '換一組綜合題 →' : passed ? `下一段：${stages[stage + 1].title} →` : '換新題，再試一次 →';
  $('retry').hidden = !passed || isChallenge();
  $('retry').textContent='再練這一段';
  if (!cloud && passed) {
    if (!isChallenge()) savedCheckpoint=Math.max(savedCheckpoint,stage+1);
    if (final) savedCompleted=true;
  }
  if (final) {
    if (!cloud) earnLeaf();
    steps();
  }
  show('result'); $('continue').focus();
  if (cloud) {
    const attempt={event_id:crypto.randomUUID(),stage:stage+1,correct,errors,elapsed_ms:clock.elapsed(),interrupted,
      fingerprint:rows.join('|')};
    // Fingerprint is a digest, never store generated practice text or credentials in events.
    const save = async () => {
      saving=true; steps();
      $('continue').disabled=$('retry').disabled=true;
      $('cloud-retry').hidden=true; cloudStatus('正在儲存，請先不要關閉頁面…');
      try {
        if (attempt.fingerprint.length!==64) {
          const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(attempt.fingerprint));
          attempt.fingerprint=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
        }
        const saved=await cloud.save(attempt);
        savedCheckpoint=saved.checkpoint; savedCompleted=saved.completed;
        courseRecords=courseRecords.filter(r=>r.lesson_key!==lesson.key).concat({...saved,lesson_key:lesson.key});
        saving=false;
        if (savedCompleted) earnLeaf();
        steps(); cloudStatus('已儲存，可下次接續。');
        $('continue').disabled=$('retry').disabled=false; $('continue').focus();
      } catch(error) {
        cloudStatus(`尚未儲存：${error.message}`); $('cloud-retry').hidden=false;
        $('cloud-retry').onclick=save; $('cloud-retry').focus();
      }
    };
    save();
  }
}
function pause() {
  if (mode !== 'playing' || switchDialog) return;
  interrupted = true; clock.pause(); clearInterval(ticker);
  $('pause-note').textContent = isChallenge() ? '可以繼續完成這組練習，但本次不列入速度確認。完成後換一組新題再挑戰。' : '進度留在這裡。準備好後再繼續。';
  mode = 'paused'; show('paused'); $('resume').focus();
}
$('start').addEventListener('click', () => {if(savedCompleted)reviewing=true;begin();});
$('continue').addEventListener('click', () => {
  if (reviewing) { begin(); return; }
  if(mode==='passed'&&isChallenge()&&lesson.number<12){const url=new URL(location.href);url.searchParams.set('lesson',lessons[lesson.number].key);location.href=url.href;return;}
  if (mode === 'passed' && stage < stages.length - 1) { stage++; }
  else if (mode === 'passed') { stage = 0; confirmations = 0; }
  begin();
});
$('retry').addEventListener('click', () => {
  if (reviewing) { reviewing=false; stage=currentStage(); }
  begin();
});
// Keep native Tab / Enter / Space behavior; arrows only move result-button focus.
$('result').addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return;
  const buttons = [$('continue'), $('retry')].filter(button => !button.hidden && !button.disabled);
  const index = buttons.indexOf(e.target);
  if (index < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const direction = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1;
  buttons[(index + direction + buttons.length) % buttons.length].focus();
});
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', () => { mode='playing'; clock.resume(); startTicker(); show('exercise'); $('typing-area').focus(); });
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('typing-area').addEventListener('click', () => $('typing-area').focus());
$('typing-area').addEventListener('blur', () => { if (mode === 'playing') setFeedback('點一下題目區，或用 Tab 回到題目區，就可以繼續。'); });
for (const event of ['paste','drop','contextmenu']) $('typing-area').addEventListener(event, e => e.preventDefault());
$('typing-area').addEventListener('keydown', e => {
  if (mode !== 'playing' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { e.preventDefault(); pause(); return; }
  if (e.isComposing || e.key === 'Process' || e.key === 'Unidentified') {
    setFeedback('請先切到英文輸入模式，再繼續。', true); return;
  }
  if (e.key === 'Tab' || ['Shift','CapsLock','Control','Alt','Meta'].includes(e.key)) return;
  e.preventDefault();
  if (e.key === 'Backspace') { setFeedback('打錯時會停在原位，直接按正確的鍵就好。'); return; }
  if (e.key.length !== 1) return;
  if (e.code?.startsWith('Numpad')) {setFeedback('請使用鍵盤上方數字列，練習正確指法。',true);return;}
  if (e.getModifierState('CapsLock')) {setFeedback('請關閉 Caps Lock；大寫請使用 Shift。',true);return;}
  clock.start();
  const expected = rows[row][position];
  if (e.key !== expected) {
    errors++; streak = 0; missed = true; wrongKeys[expected] = (wrongKeys[expected] || 0) + 1;
    setFeedback(isChallenge() ? `剛才按了 ${displayKey(e.key)}，請再看一下目前反白的字。` : `剛才按了 ${displayKey(e.key)}。試試 ${displayKey(expected)}，用${fingerLabel(expected)}。`, true);
    draw(); return;
  }
  if ($('show-fingers').checked) fingerGuide.press(expected);
  correct++; streak++; position++; missed = false;
  setFeedback(streak >= 5 ? `連續 ${streak} 次按對，保持這個步調。` : '按對了，繼續下一個。');
  if (position === rows[row].length) {
    row++; position = 0;
    if (row === rows.length) { finish(); return; }
    setFeedback('這一行完成了，接著練下一行。');
  }
  draw();
});
steps();
if (cloudConfig) {
  const connect=async () => {
    $('cloud-retry').hidden=true;
    try {
      const {initTypingChallenge}=await import('../../../shared/typing-challenge.js?v=20261002-course');
      cloud=await initTypingChallenge({foundation:cloudConfig});
      const records=await cloud.list();courseRecords=Array.isArray(records)?records:[];renderCourseMap();
      const saved=await cloud.load();
      savedCheckpoint=saved?.checkpoint || 0; savedCompleted=Boolean(saved?.completed);
      stage=Math.min(savedCheckpoint,5);
      if (saved) { $('starter').checked=saved.starter; $('starter').disabled=savedCheckpoint>0 || savedCompleted; updatePolicy(); }
      if (savedCompleted) earnLeaf();
      steps();
      $('start').textContent=savedCompleted ? `${lessonName}已過關，繼續精進 →` : savedCheckpoint ? `接續：${stages[stage].title} →` : '手指就位，開始練習 →';
      cloudStatus(savedCompleted ? `已接回${lessonName}過關成果。` : savedCheckpoint ? `已接回 ${savedCheckpoint}/5 小關，從${stages[stage].title}繼續。` : '身分已確認，可以開始；本練習不屬於任何週次作業。');
      document.querySelector('.practice-card').inert=false;
    } catch(error) {
      cloud=null; cloudStatus(error.message); $('cloud-retry').hidden=false;
      $('cloud-retry').onclick=connect;
    }
  };
  connect();
}
