import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initClassCardAuth } from '../../shared/class-card-auth.js?v=20260916-1';
import { createClassCardProgress } from '../../shared/class-card-progress.js';
import { initTypingChallenge } from '../../shared/typing-challenge.js?v=20260923-1';
import { initTypingTools } from '../../shared/typing-tools.js?v=20260924-1';
import { supabase } from '../../shared/auth.js';

const COURSE_ID = 'grade3-115-1';
const WEEK_CODE = '05';
const ACTIVITY_KEY = 'typing_task_5';

const levelsData = [
  { id: 1, ans: 'l1o0' },
  { id: 2, ans: 'Hi' },
  { id: 3, ans: 'A0o1' },
  { id: 4, ans: '\u0000' },
  { id: 5, ans: 'A123456780' },
  { id: 6, ans: 'apple1234' }
];

const replayBanks = {
  1: ['o0l1', '1l0o'],
  2: ['Ho', 'He'],
  3: ['B1l0', 'C0o1'],
  4: [],
  5: ['B807162534', 'C908172635'],
  6: ['peach5678', 'lemon2468']
};

const classCardAuth = initClassCardAuth({ courseId: COURSE_ID, mode: 'required' });
initNavbarAuth();

let practiceAccount = '';
async function loadPracticeAccount() {
  const identity = classCardAuth.getIdentity();
  if (!identity?.birthdayCode || identity.source !== 'rpc') return;
  try {
    const { data, error } = await supabase.rpc('get_class_card_practice_account', {
      p_course_id: COURSE_ID,
      p_class_code: identity.classCode,
      p_seat_no: identity.seatNo,
      p_birthday_code: identity.birthdayCode
    });
    if (!error && typeof data === 'string' && /^[a-z][a-z0-9]*$/.test(data)) {
      practiceAccount = data;
    }
  } catch {
    // Keep the personal account level unavailable when the database cannot be reached.
  }
}

await loadPracticeAccount();
levelsData[3].ans = practiceAccount || '\u0000';
replayBanks[4] = practiceAccount ? [practiceAccount] : [];
const accountBlock = document.getElementById('block-level4');
accountBlock.inert = !practiceAccount;
document.getElementById('account-target').textContent = practiceAccount;
document.getElementById('account-load-status').textContent = practiceAccount
  ? '這是你的學校帳號。看一碼、打一碼；第 4 關完成後還能按「再練習一次」。'
  : classCardAuth.hasIdentity()
    ? '目前無法取得你的帳號，請告訴老師；不要猜別人的帳號。'
    : '先輸入課堂身分卡，才會顯示自己的帳號。';
if (practiceAccount) document.getElementById('input-level4').maxLength = practiceAccount.length;

let activeKeyboardTarget = '';
const typingTools = initTypingTools({
  showPunctuation: false,
  showKeyboard: true,
  keyboardGuide: true,
  getKeyboardTarget: () => activeKeyboardTarget
});
document.querySelectorAll('input[id^="input-level"]').forEach((input, index) => {
  input.addEventListener('focus', () => {
    activeKeyboardTarget = levelsData[index].ans;
    typingTools?.refreshKeyboardGuide?.();
  });
});

const typingStore = createClassCardProgress({
  courseId: COURSE_ID,
  weekCode: WEEK_CODE,
  activityKey: ACTIVITY_KEY,
  total: levelsData.length,
  getIdentity: () => classCardAuth.getIdentity()
});

function characterName(character) {
  if (character === undefined) return '沒有字元';
  if (/\d/.test(character)) return `數字 ${character}（上排 ${character} 鍵）`;
  if (character === character.toUpperCase()) return `大寫字母 ${character}（按住 Shift，再按 ${character} 鍵）`;
  return `小寫字母 ${character}（字母 ${character.toUpperCase()} 鍵）`;
}

function buildHint(value, target) {
  if (!value) return '先點輸入框，看到閃爍的小直線，再看題目逐碼輸入。';
  let position = 0;
  while (position < Math.min(value.length, target.length) && value[position] === target[position]) position += 1;
  if (position === target.length && value.length > target.length) return `多了 ${value.length - target.length} 碼；請用 Backspace 刪除後面多出的字。`;
  if (position === value.length && value.length < target.length) return `還少第 ${position + 1} 碼：${characterName(target[position])}。`;
  return `第 ${position + 1} 碼應是${characterName(target[position])}。先找對鍵，再用 Backspace 修正。`;
}

function refreshIdentityLock() {
  const ready = classCardAuth.hasIdentity();
  document.body.classList.toggle('class-card-ready', ready);
  document.body.classList.toggle('class-card-not-ready', !ready);
  const challenge = document.getElementById('typing-levels-container');
  challenge.inert = !ready;
  challenge.querySelectorAll('input, button').forEach(control => { control.disabled = !ready; });
  accountBlock.inert = !ready || !practiceAccount;
}

initTypingChallenge({
  courseId: COURSE_ID,
  weekCode: WEEK_CODE,
  activityKey: ACTIVITY_KEY,
  levelsData,
  levelEncouragements: {
    1: '你分清楚了字母和數字，逐碼核對的習慣正在建立。',
    2: '你按住 Shift 只輸入一個大寫字母，放開後也檢查了下一碼。',
    3: '你分清大寫字母、數字與小寫字母，也會用 Backspace 修正。',
    4: '你親手輸入了自己的帳號；可以再練習一次，慢慢把鍵位記熟。',
    5: '你完成大寫字母加九個數字的虛構格式題。',
    6: '你看懂了小寫字母加數字的範例；未來設定新密碼時也要自己想、自己保管。'
  },
  buildHint,
  getWrongAnswerHtml: ({ hint }) => `還有一碼需要檢查。${hint}`,
  progressMessages: {
    firstLogin: '課堂身分已確認，從第 1 關開始。',
    resumed: level => `已接回進度，從第 ${level} 關繼續。`,
    unauthenticated: '先輸入課堂身分卡，再開始鍵盤與帳號練習。',
    guestReady: classCardAuth.hasIdentity() ? '課堂身分已確認，從第 1 關開始。' : '先輸入課堂身分卡，再開始鍵盤與帳號練習。',
    guestNextLevel: level => `本關進度已保存，接著挑戰第 ${level} 關。`,
    guestCompleted: '六關練習進度已保存；下週拿到紙條後再練習真實登入。',
    saveCompleted: '六關練習進度已保存；下週拿到紙條後再練習真實登入。'
  },
  celebrationContent: {
    title: '鍵盤辨字偵探完成！',
    message: '你練過自己的帳號，也用虛構題目預習了密碼格式。下週再練習真實登入。',
    buttonText: '回到本週課程'
  },
  requireAuth: false,
  guestProgress: { load: () => typingStore.load(), save: progress => typingStore.save(progress) },
  afterAuthUpdate: refreshIdentityLock,
  autoScrollNext: false
});

function preventCopyInput(input) {
  input.addEventListener('paste', event => event.preventDefault());
  input.addEventListener('drop', event => event.preventDefault());
  input.addEventListener('beforeinput', event => {
    if (['insertFromPaste', 'insertFromDrop'].includes(event.inputType)) event.preventDefault();
  });
}

function setupReplay(level) {
  const officialInput = document.getElementById(`input-level${level}`);
  const zone = document.querySelector(`[data-replay-zone="${level}"]`);
  const choices = replayBanks[level];
  let round = -1;
  let currentTarget = '';

  zone.innerHTML = `
    <div class="button-row">
      <button type="button" data-replay-start>${level === 4 ? '再練習一次（同一帳號）' : '再練習一次（換一題）'}</button>
      <button type="button" data-replay-next>${level < levelsData.length ? `前往第 ${level + 1} 關` : '回到本週課程'}</button>
    </div>
    <div data-replay-task class="hidden">
      <p>新的練習題：<strong class="replay-target" data-replay-target></strong></p>
      <label>在這裡重新輸入<input type="text" data-replay-input autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <button type="button" data-replay-check>檢查這次練習</button>
      <p class="replay-feedback" data-replay-feedback role="status"></p>
    </div>`;
  const task = zone.querySelector('[data-replay-task]');
  const input = zone.querySelector('[data-replay-input]');
  const feedback = zone.querySelector('[data-replay-feedback]');
  preventCopyInput(input);
  const sync = () => {
    zone.classList.toggle('hidden', !officialInput.readOnly);
    if (!officialInput.readOnly) {
      task.classList.add('hidden');
      input.value = '';
      feedback.textContent = '';
    }
  };
  new MutationObserver(sync).observe(officialInput, { attributes:true, attributeFilter:['readonly'] });
  sync();

  zone.querySelector('[data-replay-start]').addEventListener('click', () => {
    if (!classCardAuth.hasIdentity() || !officialInput.readOnly || (level === 4 && !practiceAccount)) return;
    round += 1;
    currentTarget = choices[round % choices.length];
    zone.querySelector('[data-replay-target]').textContent = currentTarget;
    input.value = '';
    input.maxLength = currentTarget.length;
    feedback.textContent = level === 4 ? '再打一遍自己的帳號；這次練習不會讓正式進度倒退。' : '這次只練習，不會讓正式進度倒退。';
    task.classList.remove('hidden');
    input.focus();
  });
  zone.querySelector('[data-replay-check]').addEventListener('click', () => {
    if (!classCardAuth.hasIdentity() || !officialInput.readOnly) return;
    feedback.textContent = input.value === currentTarget
      ? level === 4
        ? '你又親手打對自己的帳號；可以再練一次，或前往下一關。'
        : '你重新找對按鍵並完成了另一題；可以再換題，或前往下一關。'
      : buildHint(input.value, currentTarget);
  });
  zone.querySelector('[data-replay-next]').addEventListener('click', () => {
    const target = level < levelsData.length ? document.getElementById(`block-level${level + 1}`) : document.getElementById('challenge-title');
    target?.scrollIntoView({ behavior:'smooth', block:'start' });
    target?.querySelector('input:not(:disabled)')?.focus({ preventScroll:true });
  });
}

levelsData.forEach(({ id }) => setupReplay(id));
function clearAccountFromPage() {
  practiceAccount = '';
  levelsData[3].ans = '\u0000';
  replayBanks[4].length = 0;
  accountBlock.inert = true;
  document.getElementById('account-target').textContent = '';
  document.getElementById('input-level4').value = '';
  accountBlock.querySelector('[data-replay-target]').textContent = '';
  accountBlock.querySelector('[data-replay-input]').value = '';
}
window.addEventListener('class-card:identity-changed', clearAccountFromPage);
window.addEventListener('pagehide', clearAccountFromPage);
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
refreshIdentityLock();
document.getElementById('boot-status').hidden = true;
