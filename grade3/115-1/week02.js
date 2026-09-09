import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initTypingChallenge } from '../../shared/typing-challenge.js';
import { initQuizModule } from '../../shared/quiz-module.js';
import { createActivityProgress } from '../../shared/activity-progress.js';
import { connectTypingUI, digitHint, typingMessages, randomDigits } from './week02-typing-ui.js?v=20260909';
import { initReadingAid } from './week02-reading.js?v=20260909';
import { initWindowPractice } from './week02-window.js?v=20260909';

const COURSE_ID = 'grade3-115-1';
const TEMP_PROGRESS_KEY = `${COURSE_ID}:week02:local-practice:v1`;
const defaultTempProgress = {
    levelsData: null,
    typingLevel: 1,
    typingCompleted: false,
    quizScore: 0,
    quizCompleted: false,
    windowScore: 0,
    windowCompleted: false
};
let tempProgress = loadTempProgress();
let session = null, typingDone = Boolean(tempProgress.typingCompleted), quizDone = Boolean(tempProgress.quizCompleted), windowsDone = Boolean(tempProgress.windowCompleted);

function loadTempProgress() {
    try {
        const raw = window.localStorage?.getItem(TEMP_PROGRESS_KEY);
        if (!raw) return { ...defaultTempProgress };
        const parsed = JSON.parse(raw);
        return { ...defaultTempProgress, ...parsed };
    } catch (error) {
        console.warn('week02 temp progress load failed', error);
        return { ...defaultTempProgress };
    }
}

function saveTempProgress(patch) {
    tempProgress = { ...defaultTempProgress, ...tempProgress, ...patch };
    try {
        window.localStorage?.setItem(TEMP_PROGRESS_KEY, JSON.stringify(tempProgress));
        return true;
    } catch (error) {
        console.warn('week02 temp progress save failed', error);
        return false;
    }
}

function isSavedLevelsData(value) {
    return Array.isArray(value)
        && value.length === 4
        && value.every((level, index) => level?.id === index + 1 && /^[0-9]{3}$/.test(String(level?.ans || '')));
}

function restoreTypingTempProgress(levelsData) {
    const completed = Boolean(tempProgress.typingCompleted);
    const savedLevel = Math.max(1, Math.min(levelsData.length, Number(tempProgress.typingLevel) || 1));
    const completedThrough = completed ? levelsData.length : savedLevel - 1;
    for (let id = 1; id <= levelsData.length; id += 1) {
        const block = document.getElementById(`block-level${id}`);
        const input = document.getElementById(`input-level${id}`);
        const msg = document.getElementById(`msg-level${id}`);
        if (!block || !input || !msg) continue;
        if (id <= savedLevel || completed) block.classList.remove('hidden');
        block.classList.toggle('current', id === savedLevel && !completed);
        if (id <= completedThrough) {
            input.value = levelsData[id - 1].ans;
            input.readOnly = true;
            input.disabled = false;
            input.classList.add('bg-green-50', 'text-green-800');
            msg.textContent = id === levelsData.length ? '四關完成！' : '這一關完成了。';
            msg.className = 'level-message text-emerald-600';
        }
    }
    typingDone = completed;
    updateUnlock();
}

function getTypingGuestProgress() {
    if (!tempProgress.typingCompleted && (Number(tempProgress.typingLevel) || 1) <= 1) return null;
    return {
        current_level: tempProgress.typingCompleted ? levelsData.length : Math.max(1, Math.min(levelsData.length, Number(tempProgress.typingLevel) || 1)),
        completed: Boolean(tempProgress.typingCompleted)
    };
}

function saveTypingGuestProgress(progress) {
    const currentLevel = Math.max(1, Math.min(levelsData.length, Number(progress?.current_level) || 1));
    typingDone = Boolean(progress?.completed);
    const saved = saveTempProgress({ typingLevel: currentLevel, typingCompleted: typingDone });
    updateUnlock();
    return saved;
}

function loadQuizGuestProgress() {
    return { score: Number(tempProgress.quizScore) || 0, completed: Boolean(tempProgress.quizCompleted) };
}

function saveQuizGuestProgress(score) {
    const nextScore = Math.max(0, Math.min(5, Number(score) || 0));
    quizDone = nextScore >= 5;
    const saved = saveTempProgress({ quizScore: nextScore, quizCompleted: quizDone });
    updateUnlock();
    return saved;
}

function loadWindowGuestProgress() {
    return { score: Number(tempProgress.windowScore) || 0, completed: Boolean(tempProgress.windowCompleted) };
}

function saveWindowGuestProgress(score) {
    const nextScore = Math.max(0, Math.min(5, Number(score) || 0));
    windowsDone = nextScore >= 5;
    const saved = saveTempProgress({ windowScore: nextScore, windowCompleted: windowsDone });
    updateUnlock();
    return saved;
}

function updateUnlock() {
    const typingScore = tempProgress.typingCompleted ? 4 : Math.max(0, Math.min(4, (Number(tempProgress.typingLevel) || 1) - 1));
    const quizScore = Math.max(0, Math.min(5, Number(tempProgress.quizScore) || 0));
    const windowScore = Math.max(0, Math.min(5, Number(tempProgress.windowScore) || 0));
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

const progress = (activityKey, total) => createActivityProgress({ courseId: COURSE_ID, weekCode: '02', activityKey, total, getSession: () => session });
const quizStore = progress('quiz_posture_5', 5);
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
    loadProgress: quizStore.load, saveProgress: quizStore.save,
    loadGuestProgress: loadQuizGuestProgress, saveGuestProgress: saveQuizGuestProgress,
    getCurrentUser: () => session?.user,
    requireAuth: false,
    onAfterSubmit: ({ correct, total }) => { quizDone = correct === total; updateUnlock(); }
});
initNumLockLight();
const windows = initWindowPractice({
    store: progress('window_practice_5', 5),
    requireAuth: false,
    loadGuestProgress: loadWindowGuestProgress,
    saveGuestProgress: saveWindowGuestProgress,
    onComplete: done => {
        if (done) {
            windowsDone = true;
            saveTempProgress({ windowCompleted: true, windowScore: 5 });
        } else {
            windowsDone = Boolean(tempProgress.windowCompleted);
        }
        updateUnlock();
    }
});
initNavbarAuth({ onSessionResolved: next => {
    if (session?.user && session.user.id !== next?.user?.id) { window.location.reload(); return; }
    const changed = session?.user?.id !== next?.user?.id;
    session = next;
    document.getElementById('repair-input').disabled = false;
    if (changed || !next) {
        if (!next?.user) {
            quizDone = Boolean(tempProgress.quizCompleted);
            windowsDone = Boolean(tempProgress.windowCompleted);
        } else {
            quizDone = false;
            windowsDone = false;
        }
        // No await inside the auth event callback; same-user refocus does not reload.
        void quiz.handleAuthChange(next); void windows.handleSession(next);
    }
    updateUnlock();
} });

const savedLevelsData = isSavedLevelsData(tempProgress.levelsData) ? tempProgress.levelsData : null;
const levelsData = savedLevelsData || Array.from({ length: 4 }, (_, i) => ({ id: i + 1, ans: randomDigits() }));
if (!savedLevelsData) saveTempProgress({ levelsData });
document.getElementById('typing-levels-container').innerHTML = levelsData.map(({ id, ans }) => `
    <div id="block-level${id}" class="stage ${id > 1 ? 'hidden' : 'current'}" data-level="${id}">
      <div class="stage-top"><strong>第 ${id} 關 / 4</strong><span>本關代碼</span><span class="code">${ans}</span></div>
      <div class="arena"><div class="target pos-${id}"><label for="input-level${id}">${id <= 2 ? '↘ 點這個框，找小直線' : '輸入代碼'}</label><input id="input-level${id}" type="text" inputmode="numeric" disabled aria-label="第 ${id} 關數字輸入框"></div></div>
      <button id="check-${id}" onclick="checkLevel(${id})" disabled>檢查數字</button>
      <button id="next-${id}" data-next="${id + 1}" class="secondary hidden">下一關 →</button>
      <p id="msg-level${id}" class="level-message" role="status"></p>
    </div>`).join('');
initTypingChallenge({ courseId: COURSE_ID, weekCode: '02', activityKey: 'typing_task_4', levelsData,
    levelEncouragements: { 1: '你先找到框，再把數字放進去了。', 2: '位置換了，你仍記得先點框。', 3: '少了提示，你也能自己找位置。', 4: '你用先點再打的方法，完成了四關。努力正在累積！' },
    buildHint: digitHint, getWrongAnswerHtml: ({ hint }) => hint,
    progressMessages: {
        ...typingMessages,
        unauthenticated: '先練會「點框、找直線、再打字」；今天不用登入 Google。',
        guestReady: '今天先在課堂練習，不用登入 Google。',
        guestNextLevel: level => `第 ${level - 1} 關完成，往下一關前進。`,
        guestCompleted: '四關完成！今天不用登入 Google，請舉手讓老師看看。'
    },
    requireAuth: false,
    guestProgress: { load: getTypingGuestProgress, save: saveTypingGuestProgress },
    celebrationContent: { title: '四關完成！', message: '你學會先點再打。接著跟老師一起看影片。', buttonText: '回到課程' }
});
restoreTypingTempProgress(levelsData);
connectTypingUI({ total: 4, onComplete: done => { typingDone = done; saveTempProgress({ typingCompleted: done, typingLevel: done ? 4 : Number(tempProgress.typingLevel) || 1 }); updateUnlock(); } });
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


