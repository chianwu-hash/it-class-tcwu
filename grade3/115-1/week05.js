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
  ? '這是你的學校帳號。一個一個看、一個一個打；過關後還能按「再練習一次」。'
  : classCardAuth.hasIdentity()
    ? '現在找不到你的帳號，請告訴老師；不要猜別人的帳號。'
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

const warmupBanks = {
  caps: [
    { ans:'ABC', context:'試試看：ABC，三個字母都大寫。' },
    { ans:'DOG', context:'換你打：DOG，三個字母都大寫。' },
    { ans:'VIP', context:'換你打：VIP，三個字母都大寫。' }
  ],
  shift: [
    { ans:'Amy', context:'試試看：Amy，只有 A 大寫。' },
    { ans:'Tom', context:'換你打：Tom，只有 T 大寫。' },
    { ans:'Lily', context:'換你打：Lily，只有 L 大寫。' }
  ],
  confusion: [
    { ans:'lone', context:'像帳號的練習題：lone。第一個是小寫 l，第二個是小寫 o。' },
    { ans:'login', context:'電腦上常看到 login。第一個是小寫 l，第二個是小寫 o。' },
    { ans:'lone01', context:'像帳號的練習題：lone01。最後兩個是數字 0、1。' }
  ]
};

function warmupKeyHint(kind, character) {
  if (!character) return kind === 'caps' ? '打完啦！再按一次 Caps Lock，回到小寫。' : '打完啦！按「檢查練習」看看對不對。';
  if (/\d/.test(character)) return `下一個是數字 ${character}，找最上面那排的 ${character} 鍵。`;
  const key = character.toUpperCase();
  if (kind === 'caps') return `下一個是大寫 ${key}。先按 A 左邊的 Caps Lock，再按 ${key}。打完記得再按一次 Caps Lock。`;
  if (character === key) return `下一個是大寫 ${key}。按住最下面一排的 Shift，再按 ${key}，然後放開 Shift。`;
  if (character === 'l') return '下一個是小寫 l。按字母 L，不是數字 1。';
  if (character === 'o') return '下一個是小寫 o。按字母 O，不是數字 0。';
  return `下一個是小寫 ${character}。直接按字母 ${key}；如果打出大寫，先關掉 Caps Lock。`;
}

function updateWarmupKeyGuide(kind, target, value, task) {
  let position = 0;
  while (position < Math.min(value.length, target.length) && value[position] === target[position]) position += 1;
  const nextCharacter = target[position];
  const message = warmupKeyHint(kind, nextCharacter);
  task.querySelector('[data-warmup-key-hint]').textContent = message;
  document.getElementById('keyboard-hint-status').textContent = `找按鍵：${message}`;
  document.querySelectorAll('.key-map kbd[data-key]').forEach(key => {
    key.classList.remove('is-next-key', 'is-next-modifier');
    if (!nextCharacter) return;
    const keyName = /\d/.test(nextCharacter) ? nextCharacter : nextCharacter.toLowerCase();
    key.classList.toggle('is-next-key', key.dataset.key === keyName);
    const modifier = kind === 'caps' ? 'caps' : nextCharacter !== nextCharacter.toLowerCase() ? 'shift' : '';
    key.classList.toggle('is-next-modifier', Boolean(modifier) && key.dataset.key === modifier);
  });
}

function initWarmupTask(task) {
  const kind = task.dataset.warmup;
  const bank = warmupBanks[kind];
  const input = task.querySelector('[data-warmup-input]');
  const feedback = task.querySelector('[data-warmup-feedback]');
  let questionIndex = 0;
  const current = () => bank[questionIndex];
  const showQuestion = () => {
    task.querySelector('[data-warmup-context]').textContent = current().context;
    task.querySelector('[data-warmup-target]').textContent = current().ans;
    input.value = '';
    input.maxLength = current().ans.length;
    feedback.textContent = '';
    updateWarmupKeyGuide(kind, current().ans, '', task);
    activeKeyboardTarget = current().ans;
    typingTools?.refreshKeyboardGuide?.();
  };
  preventCopyInput(input);
  input.addEventListener('focus', () => {
    activeKeyboardTarget = current().ans;
    typingTools?.refreshKeyboardGuide?.();
    updateWarmupKeyGuide(kind, current().ans, input.value, task);
  });
  input.addEventListener('input', () => updateWarmupKeyGuide(kind, current().ans, input.value, task));
  task.querySelector('[data-warmup-check]').addEventListener('click', () => {
    const target = current().ans;
    if (input.value === target) {
      feedback.textContent = kind === 'caps'
        ? '打對了！再按一次 Caps Lock，回到小寫。'
        : kind === 'shift'
          ? '打對了！只有第一個字母大寫，後面都是小寫。'
          : '打對了！你分清字母和數字了。想挑戰就按「換一題」。';
      return;
    }
    let position = 0;
    while (position < Math.min(input.value.length, target.length) && input.value[position] === target[position]) position += 1;
    feedback.textContent = position === target.length
      ? '後面多打了，按 Backspace 刪掉再試一次。'
      : `第 ${position + 1} 個再看一看。${warmupKeyHint(kind, target[position])}`;
  });
  task.querySelector('[data-warmup-next]').addEventListener('click', () => {
    questionIndex = (questionIndex + 1) % bank.length;
    showQuestion();
    input.focus();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      task.querySelector('[data-warmup-check]').click();
    }
  });
}

document.querySelectorAll('[data-warmup]').forEach(initWarmupTask);

const typingStore = createClassCardProgress({
  courseId: COURSE_ID,
  weekCode: WEEK_CODE,
  activityKey: ACTIVITY_KEY,
  total: levelsData.length,
  getIdentity: () => classCardAuth.getIdentity()
});

function characterName(character) {
  if (character === undefined) return '沒有下一個字了';
  if (/\d/.test(character)) return `數字 ${character}（在最上面那排）`;
  if (character === character.toUpperCase()) return `大寫 ${character}（按住 Shift，再按 ${character}）`;
  if (character === 'l') return '小寫 l（按字母 L，不是數字 1）';
  if (character === 'o') return '小寫 o（按字母 O，不是數字 0）';
  return `小寫 ${character}（按字母 ${character.toUpperCase()}）`;
}

function buildHint(value, target) {
  if (!value) return '先點一下輸入框，再照著題目一個一個打。';
  let position = 0;
  while (position < Math.min(value.length, target.length) && value[position] === target[position]) position += 1;
  if (position === target.length && value.length > target.length) return `後面多打了 ${value.length - target.length} 個，按 Backspace 刪掉。`;
  if (position === value.length && value.length < target.length) return `還少第 ${position + 1} 個：${characterName(target[position])}。`;
  return `第 ${position + 1} 個應該是${characterName(target[position])}。找對按鍵，再用 Backspace 改好。`;
}

function refreshIdentityLock() {
  const ready = classCardAuth.hasIdentity();
  document.body.classList.toggle('class-card-ready', ready);
  document.body.classList.toggle('class-card-not-ready', !ready);
  document.querySelectorAll('#warmup-uppercase, #warmup-confusion').forEach(warmup => {
    warmup.inert = !ready;
    warmup.querySelectorAll('input, button').forEach(control => { control.disabled = !ready; });
  });
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
    1: '做得好！你分清楚字母和數字了。',
    2: '做得好！你用 Shift 打出一個大寫字母。',
    3: '你看清楚大寫、小寫和數字，打錯也會用 Backspace 改好。',
    4: '你自己打對學校帳號了！可以再練一次，把按鍵記得更熟。',
    5: '你打對了這道大寫字母加數字的練習題。',
    6: '你完成了小寫字母加數字的練習。以後新密碼要自己想，也要自己保管。'
  },
  buildHint,
  getWrongAnswerHtml: ({ hint }) => `再看一看。${hint}`,
  progressMessages: {
    firstLogin: '準備好了！從第 1 關開始。',
    resumed: level => `上次做到第 ${level} 關，從這裡繼續。`,
    unauthenticated: '先輸入課堂身分卡，再開始鍵盤與帳號練習。',
    guestReady: classCardAuth.hasIdentity() ? '準備好了！從第 1 關開始。' : '先輸入課堂身分卡，再開始鍵盤與帳號練習。',
    guestNextLevel: level => `這一關已經記下來了，接著玩第 ${level} 關。`,
    guestCompleted: '六關都完成了！下週拿到紙條，再學怎麼登入。',
    saveCompleted: '六關都完成了！下週拿到紙條，再學怎麼登入。'
  },
  celebrationContent: {
    title: '鍵盤辨字偵探完成！',
    message: '你打過自己的帳號，也練過兩種密碼長相。下週拿到紙條，再學真的登入。',
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
      <p>再打一次：<strong class="replay-target" data-replay-target></strong></p>
      <label>在這裡再打一次<input type="text" data-replay-input autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <button type="button" data-replay-check>檢查</button>
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
    feedback.textContent = level === 4 ? '再打一次自己的帳號。已過的關卡不會消失。' : '再練一次，已過的關卡不會消失。';
    task.classList.remove('hidden');
    input.focus();
  });
  zone.querySelector('[data-replay-check]').addEventListener('click', () => {
    if (!classCardAuth.hasIdentity() || !officialInput.readOnly) return;
    feedback.textContent = input.value === currentTarget
      ? level === 4
        ? '你又打對自己的帳號了！可以再練一次，或玩下一關。'
        : '你又打對了！可以再換題，或玩下一關。'
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
