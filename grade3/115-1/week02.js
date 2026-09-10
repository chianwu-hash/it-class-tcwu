import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initTypingChallenge } from '../../shared/typing-challenge.js?v=20260909-class-card-branch-sop';
import { initQuizModule } from '../../shared/quiz-module.js';
import { initClassCardAuth } from '../../shared/class-card-auth.js';
import { createClassCardProgress } from '../../shared/class-card-progress.js?v=20260909-class-card-branch-sop';
import { connectTypingUI, digitHint, typingMessages, randomDigits } from './week02-typing-ui.js?v=20260909-login-required';
import { initReadingAid } from './week02-reading.js?v=20260909';
import { initWindowPractice } from './week02-window.js?v=20260909';

const COURSE_ID = 'grade3-115-1';
const WEEK_CODE = '02';
const classCardAuth = initClassCardAuth({
    courseId: COURSE_ID,
    mode: 'required'
});
const defaultProgressState = {
    typingLevel: 1,
    typingCompleted: false,
    quizScore: 0,
    quizCompleted: false,
    windowScore: 0,
    windowCompleted: false
};
let progressState = { ...defaultProgressState };
let authResolvedOnce = false, typingDone = false, quizDone = false, windowsDone = false;

function clearLegacyLocalPracticeProgress() {
    try {
        const storage = window.localStorage;
        if (!storage) return;
        const staleKeys = new Set(Object.keys(storage));
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (key) staleKeys.add(key);
        }
        Array.from(staleKeys)
            .filter(key => key.startsWith(`${COURSE_ID}:week02:local-practice:`) || key.startsWith(`${COURSE_ID}:week02-mail:local-practice:`))
            .forEach(key => storage.removeItem(key));
    } catch (error) {
        console.warn('clearLegacyLocalPracticeProgress failed', error);
    }
}

clearLegacyLocalPracticeProgress();

function applyProgressPatch(patch = {}) {
    progressState = { ...defaultProgressState, ...progressState, ...patch };
    typingDone = Boolean(progressState.typingCompleted);
    quizDone = Boolean(progressState.quizCompleted);
    windowsDone = Boolean(progressState.windowCompleted);
    updateUnlock();
}

function rememberTypingProgress(progress) {
    const currentLevel = Math.max(1, Math.min(levelsData.length, Number(progress?.current_level) || 1));
    applyProgressPatch({ typingLevel: currentLevel, typingCompleted: Boolean(progress?.completed) });
    return true;
}

async function loadQuizGuestProgress() {
    const remote = await quizGuestStore.load();
    const next = remote
        ? { quizScore: Number(remote.score) || 0, quizCompleted: Boolean(remote.completed) }
        : { quizScore: 0, quizCompleted: false };
    applyProgressPatch(next);
    return { score: Number(progressState.quizScore) || 0, completed: Boolean(progressState.quizCompleted) };
}

async function saveQuizGuestProgress(score) {
    if (!classCardAuth.hasIdentity()) return false;
    const nextScore = Math.max(0, Math.min(5, Number(score) || 0));
    const saved = await quizGuestStore.save(nextScore);
    if (saved === false) return false;
    applyProgressPatch({ quizScore: nextScore, quizCompleted: nextScore >= 5 });
    return true;
}

async function loadWindowGuestProgress() {
    const remote = await windowGuestStore.load();
    const next = remote
        ? { windowScore: Number(remote.score) || 0, windowCompleted: Boolean(remote.completed) }
        : { windowScore: 0, windowCompleted: false };
    applyProgressPatch(next);
    return { score: Number(progressState.windowScore) || 0, completed: Boolean(progressState.windowCompleted) };
}

async function saveWindowGuestProgress(score) {
    if (!classCardAuth.hasIdentity()) return false;
    const nextScore = Math.max(0, Math.min(5, Number(score) || 0));
    const saved = await windowGuestStore.save(nextScore);
    if (saved === false) return false;
    applyProgressPatch({ windowScore: nextScore, windowCompleted: nextScore >= 5 });
    return true;
}

function updateUnlock() {
    const typingScore = progressState.typingCompleted ? 4 : Math.max(0, Math.min(4, (Number(progressState.typingLevel) || 1) - 1));
    const quizScore = Math.max(0, Math.min(5, Number(progressState.quizScore) || 0));
    const windowScore = Math.max(0, Math.min(5, Number(progressState.windowScore) || 0));
    const states = { typing: typingDone, quiz: quizDone, windows: windowsDone };
    const doneCount = Object.values(states).filter(Boolean).length;
    const stepCount = typingScore + quizScore + windowScore;
    const unlocked = doneCount === 3;
    document.getElementById('fast-link')?.classList.toggle('hidden', !unlocked);
    const labels = {
        typing: `找到游標 ${typingScore}/4`,
        quiz: `坐好再出發 ${quizScore}/5`,
        windows: `視窗找回來 ${windowScore}/5`
    };
    Object.entries(labels).forEach(([key, text]) => {
        const label = document.querySelector(`[data-unlock-label="${key}"]`);
        if (label) label.textContent = text;
    });
    const lock = document.getElementById('fast-lock');
    if (lock) {
        lock.classList.toggle('hidden', unlocked);
        lock.textContent = unlocked ? '三個任務完成，可以挑戰數字投遞員。' : `已完成 ${stepCount}/14 小步，還差 ${3 - doneCount} 個主要任務。`;
    }
    const fill = document.getElementById('unlock-fill');
    if (fill) fill.style.width = `${Math.round(stepCount / 14 * 100)}%`;
    Object.entries(states).forEach(([key, done]) => {
        const item = document.querySelector(`[data-unlock-item="${key}"]`);
        if (!item) return;
        item.classList.toggle('done', done);
        const icon = item.querySelector('.unlock-icon');
        if (icon) icon.textContent = done ? '✓' : '○';
    });
}

function initNumLockLight() {
    const button = document.getElementById('numlock-toggle');
    const light = document.getElementById('numlock-light');
    const text = document.getElementById('numlock-text');
    const status = document.getElementById('numlock-status');
    if (!button || !light || !text || !status) return;
    const setOn = on => {
        button.classList.toggle('active', on);
        button.setAttribute('aria-pressed', String(on));
        light.classList.toggle('on', on);
        light.classList.toggle('off', !on);
        status.classList.toggle('off', !on);
        text.textContent = on ? 'Num Lock 燈亮：可以輸入數字' : 'Num Lock 燈暗：再按一次叫醒數字鍵盤';
    };
    button.addEventListener('click', () => setOn(button.getAttribute('aria-pressed') !== 'true'));
    setOn(true);
}

const classCardProgress = (activityKey, total) => createClassCardProgress({ courseId: COURSE_ID, weekCode: WEEK_CODE, activityKey, total, getIdentity: () => classCardAuth.getIdentity() });
const quizGuestStore = classCardProgress('quiz_posture_5', 5);
const windowGuestStore = classCardProgress('window_practice_5', 5);
const question = (id, title, options, correct, feedback) => ({ id, questionHtml: title, options: options.map((text, i) => ({ text, correct: i === correct })), hint: feedback, feedback });
const quiz = initQuizModule({
    mode: 'practice',
    questions: [
        question(1, '哪一種坐法符合影片示範？', ['身體坐直，坐在椅子前緣，不靠椅背。', '身體坐直，背部靠著椅背。', '身體前傾，手肘靠桌面支撐上半身。'], 1, '除了坐直，也記得讓背部靠著椅背。'),
        question(2, '調整椅子高度時，要注意什麼？', ['小腿自然垂直，雙腳平放地面。', '雙腳稍微懸空，方便轉動椅子。', '腳尖碰到地面，腳跟抬起來。'], 0, '雙腳要能平放地面，不只是腳尖碰得到。'),
        question(3, '使用鍵盤時，手臂應該怎麼放？', ['手肘向兩側張開，方便移動雙手。', '雙手向前伸直，讓手肘保持不彎。', '手臂自然下垂，手肘大約彎成直角。'], 2, '手臂自然放鬆，手肘大約像 L 形。'),
        question(4, '影片建議眼睛離螢幕多遠？', ['大約 20～30 公分。', '大約 45～60 公分。', '看得清楚就好，不必注意距離。'], 1, '影片提醒，眼睛與螢幕保持約 45～60 公分。'),
        question(5, '看螢幕 30 分鐘後，怎麼做符合影片提醒？', ['休息 1 分鐘，伸個懶腰後繼續操作。', '停止打字，留在螢幕前看影片 5 分鐘。', '離開螢幕休息至少 5 分鐘，看看遠處。'], 2, '停止打字不等於眼睛休息，要讓視線離開螢幕。')
    ],
    selectors: { lock: 'quiz-lock', content: 'quiz-content', container: 'quiz-container' },
    loadGuestProgress: loadQuizGuestProgress, saveGuestProgress: saveQuizGuestProgress,
    getCurrentUser: () => null,
    requireAuth: false,
    onAfterSubmit: ({ correct, total }) => { quizDone = correct === total; updateUnlock(); }
});
initNumLockLight();
const windows = initWindowPractice({
    store: null,
    requireAuth: false,
    loadGuestProgress: loadWindowGuestProgress,
    saveGuestProgress: saveWindowGuestProgress,
    onComplete: done => {
        windowsDone = done || Boolean(progressState.windowCompleted);
        updateUnlock();
    }
});

function hasClassCardIdentity() {
    return classCardAuth.hasIdentity();
}

function updateClassCardReadyState() {
    document.body.classList.toggle('class-card-ready', hasClassCardIdentity());
}

function lockTasksUntilClassCard() {
    updateClassCardReadyState();
    const message = '請先在右上角輸入課堂身分卡，再開始闖關。';
    const progressStatus = document.getElementById('progress-status');
    if (progressStatus) progressStatus.textContent = message;
    const quizLock = document.getElementById('quiz-lock');
    const quizContent = document.getElementById('quiz-content');
    if (quizLock) {
        quizLock.textContent = '先輸入課堂身分卡，再開始答題。';
        quizLock.classList.remove('hidden');
    }
    quizContent?.classList.add('hidden');
    const windowLock = document.getElementById('window-lock');
    const windowContent = document.getElementById('window-content');
    if (windowLock) {
        windowLock.textContent = '先輸入課堂身分卡，再練習視窗按鈕。';
        windowLock.classList.remove('hidden');
    }
    windowContent?.classList.add('hidden');
    const typingContainer = document.getElementById('typing-levels-container');
    typingContainer?.setAttribute('inert', '');
    typingContainer?.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    // The repair station is a pre-login warmup, not a saved challenge.
    updateUnlock();
}

function initializeGuestTasks() {
    if (authResolvedOnce) return;
    authResolvedOnce = true;
    updateClassCardReadyState();
    if (!hasClassCardIdentity()) {
        lockTasksUntilClassCard();
        return;
    }
    quizDone = Boolean(progressState.quizCompleted);
    windowsDone = Boolean(progressState.windowCompleted);
    void quiz.handleAuthChange(null);
    void windows.handleSession(null);
    updateUnlock();
}

initializeGuestTasks();

initNavbarAuth({ onSessionResolved: () => {
    // Week02 uses the classroom identity card path; ignore any existing Google session.
    initializeGuestTasks();
} });

const levelsData = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, ans: randomDigits() }));
document.getElementById('typing-levels-container').innerHTML = levelsData.map(({ id, ans }) => `
    <div id="block-level${id}" class="stage ${id > 1 ? 'hidden' : 'current'}" data-level="${id}">
      <div class="stage-top"><strong>第 ${id} 關 / 4</strong><span>本關代碼</span><span class="code">${ans}</span></div>
      <div class="arena"><div class="target pos-${id}"><label for="input-level${id}">${id <= 2 ? '↘ 點這個框，找小直線' : '輸入代碼'}</label><input id="input-level${id}" type="text" inputmode="numeric" disabled aria-label="第 ${id} 關數字輸入框"></div></div>
      <button id="check-${id}" onclick="checkLevel(${id})" disabled>檢查數字</button>
      <button id="next-${id}" data-next="${id + 1}" class="secondary hidden">下一關 →</button>
      <p id="msg-level${id}" class="level-message" role="status"></p>
    </div>`).join('');
const typingGuestStore = classCardProgress('typing_task_4', 4);
async function loadTypingClassCardProgress() {
    if (!hasClassCardIdentity()) return null;
    const remote = await typingGuestStore.load();
    const next = remote
        ? { typingLevel: Number(remote.current_level) || 1, typingCompleted: Boolean(remote.completed) }
        : { typingLevel: 1, typingCompleted: false };
    applyProgressPatch(next);
    return { current_level: next.typingLevel, completed: next.typingCompleted };
}
async function saveTypingClassCardProgress(progress) {
    if (!classCardAuth.hasIdentity()) return false;
    const saved = await typingGuestStore.save(progress);
    if (saved === false) return false;
    return rememberTypingProgress(progress);
}

initTypingChallenge({ courseId: COURSE_ID, weekCode: WEEK_CODE, activityKey: 'typing_task_4', levelsData,
    levelEncouragements: { 1: '你先找到框，再把數字放進去了。', 2: '位置換了，你仍記得先點框。', 3: '少了提示，你也能自己找位置。', 4: '你用先點再打的方法，完成了四關。努力正在累積！' },
    buildHint: digitHint, getWrongAnswerHtml: ({ hint }) => hint,
    progressMessages: {
        ...typingMessages,
        unauthenticated: '請先在右上角輸入課堂身分卡，再開始闖關。',
        firstLogin: '已確認課堂身分卡，先找到框，按一下左鍵。',
        guestReady: '請先在右上角輸入課堂身分卡，再開始闖關。',
        guestNextLevel: level => `第 ${level - 1} 關完成，往下一關前進。`,
        guestCompleted: '四關完成！請確認右上角課堂身分卡是不是自己。'
    },
    requireAuth: false,
    guestProgress: { load: loadTypingClassCardProgress, save: saveTypingClassCardProgress },
    celebrationContent: { title: '四關完成！', message: '你學會先點再打。接著跟老師一起看影片。', buttonText: '回到課程' }
});
connectTypingUI({ total: 4, isReady: hasClassCardIdentity, onComplete: done => { typingDone = done || Boolean(progressState.typingCompleted); updateUnlock(); } });
updateClassCardReadyState();
if (!hasClassCardIdentity()) lockTasksUntilClassCard();
document.addEventListener('keydown', event => {
    if (!/^[0-9]$/.test(event.key)) return;
    const task = document.getElementById('cursor-task');
    const bounds = task.getBoundingClientRect();
    if (bounds.top < innerHeight && bounds.bottom > 120 && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        document.getElementById('focus-hint').textContent = '先點一下輸入框，找到閃爍的小直線，再輸入。';
    }
});
document.getElementById('typing-levels-container').addEventListener('focusin', () => document.getElementById('focus-hint').textContent = '找到框了，看看小直線在哪裡。');
initReadingAid();
document.getElementById('boot-status').hidden = true;
