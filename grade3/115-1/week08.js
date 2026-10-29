import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initGoogleCourseAuth, createGoogleCourseProgress } from '../../shared/grade3-google-course.js?v=20261028-drafts';
import { initTypingChallenge } from '../../shared/typing-challenge.js?v=20261028-drafts';
import { initTypingTools } from '../../shared/typing-tools.js?v=20261028-keyboard';

// Source: 康軒國語三上第一課〈字的小旅行〉課文與「我會認字」。
const levelsData = [
    { id: 1, ans: '心情' }, { id: 2, ans: '心的小船' }, { id: 3, ans: '心是一葉舟' },
    { id: 4, ans: '小船上要什麼呢？' }, { id: 5, ans: '心的小船上，還是讓我載著你，\n讓你變成您，一起去看美麗新世界！' }
];
// Key-guide pronunciations, one syllable per character (一 typed as first tone).
const levelZhuyin = {
    1: 'ㄒㄧㄣ ㄑㄧㄥˊ', 2: 'ㄒㄧㄣ ㄉㄜ˙ ㄒㄧㄠˇ ㄔㄨㄢˊ', 3: 'ㄒㄧㄣ ㄕˋ ㄧ ㄧㄝˋ ㄓㄡ',
    4: 'ㄒㄧㄠˇ ㄔㄨㄢˊ ㄕㄤˋ ㄧㄠˋ ㄕㄣˊ ㄇㄜ˙ ㄋㄜ˙', 5: 'ㄒㄧㄣ ㄉㄜ˙ ㄒㄧㄠˇ ㄔㄨㄢˊ ㄕㄤˋ ㄏㄞˊ ㄕˋ ㄖㄤˋ ㄨㄛˇ ㄗㄞˋ ㄓㄜ˙ ㄋㄧˇ ㄖㄤˋ ㄋㄧˇ ㄅㄧㄢˋ ㄔㄥˊ ㄋㄧㄣˊ ㄧ ㄑㄧˇ ㄑㄩˋ ㄎㄢˋ ㄇㄟˇ ㄌㄧˋ ㄒㄧㄣ ㄕˋ ㄐㄧㄝˋ'
};
let keyboardTarget = null;
let tools = null;

// Warm-up is practice only: no login, nothing saved (no progress table, no localStorage).
const warmupSets = [
    [
        { answer: '小', zhuyin: 'ㄒㄧㄠˇ', hint: 'ㄒ → ㄧ → ㄠ，再按三聲 ˇ，按 Enter 確認。' },
        { answer: '星', zhuyin: 'ㄒㄧㄥ', hint: 'ㄒ → ㄧ → ㄥ，一聲按空白鍵。不是「星」就按 ↓ 選字。' },
        { answer: '小星星', zhuyin: 'ㄒㄧㄠˇ ㄒㄧㄥ ㄒㄧㄥ', hint: '三個字連著打：ㄒㄧㄠˇ、ㄒㄧㄥ、ㄒㄧㄥ，最後檢查有沒有選對。' },
        { answer: '心', zhuyin: 'ㄒㄧㄣ', hint: 'ㄒ → ㄧ → ㄣ，一聲按空白鍵。' }
    ],
    [
        { answer: '舟', zhuyin: 'ㄓㄡ', hint: 'ㄓ → ㄡ，一聲按空白鍵。出現「周」就按 ↓ 換成「舟」。' },
        { answer: '小船', zhuyin: 'ㄒㄧㄠˇ ㄔㄨㄢˊ', hint: 'ㄒㄧㄠˇ、ㄔㄨㄢˊ。二聲鍵 ˊ 在數字 6。' },
        { answer: '心情', zhuyin: 'ㄒㄧㄣ ㄑㄧㄥˊ', hint: 'ㄒㄧㄣ、ㄑㄧㄥˊ，兩個字打完再按 Enter。' },
        { answer: '輕舟', zhuyin: 'ㄑㄧㄥ ㄓㄡ', hint: 'ㄑㄧㄥ、ㄓㄡ，兩個都是一聲。「舟」選錯就按 ↓。' }
    ]
];

function describeMismatch(answer, value) {
    if (/[A-Za-z]/.test(value)) return '出現英文字母了：按一下 Shift 切到「中」，擦掉再打。';
    let index = 0;
    while (index < value.length && index < answer.length && value[index] === answer[index]) index++;
    if (answer[index] === '\n') return '第一行打完了：按 Enter 換到第二行，再接著打。';
    const missing = answer.slice(index).replace(/\n/g, '').length;
    if (index === value.length && value.length < answer.length) return `前面都對，還少 ${missing} 個字，接著打完。`;
    if (index === answer.length && value.length > answer.length) return `多了 ${value.length - answer.length} 個字，用 Backspace 擦掉多的。`;
    const prefix = answer.slice(0, index);
    const where = answer.includes('\n')
        ? `第 ${prefix.split('\n').length} 行第 ${prefix.length - prefix.lastIndexOf('\n')} 個字`
        : `第 ${index + 1} 個字`;
    return `${where}不一樣：還有虛線就按 ↓ 換字；已確認的用 Backspace 擦掉重打。`;
}

function setupWarmup() {
    const input = document.getElementById('warmup-input');
    const checkButton = document.getElementById('warmup-check');
    const nextSetButton = document.getElementById('warmup-next-set');
    const target = document.getElementById('warmup-target');
    const step = document.getElementById('warmup-step');
    const hint = document.getElementById('warmup-hint');
    const feedback = document.getElementById('warmup-feedback');
    const progress = document.querySelector('.warmup-progress');
    let setIndex = 0;
    let current = 0;
    let finished = false;
    const setWarmupTarget = () => {
        const task = warmupSets[setIndex][current];
        keyboardTarget = { text: task.answer, zhuyin: task.zhuyin };
        tools?.refreshKeyboardGuide?.();
    };
    input.addEventListener('focus', setWarmupTarget);

    const render = () => {
        const tasks = warmupSets[setIndex];
        const task = tasks[current];
        target.textContent = task.answer;
        step.textContent = `第 ${current + 1} 題（共 ${tasks.length} 題）`;
        hint.textContent = task.hint;
        input.value = '';
        input.readOnly = false;
        checkButton.disabled = false;
        setWarmupTarget();
        progress.innerHTML = tasks.map((item, index) =>
            `<span class="${index < current ? 'done' : index === current ? 'current' : ''}">${item.answer}</span>`).join('');
    };
    const celebrate = () => {
        target.classList.remove('celebrate');
        void target.offsetWidth;
        target.classList.add('celebrate');
    };
    const check = () => {
        if (finished) return;
        const tasks = warmupSets[setIndex];
        const answer = tasks[current].answer;
        const value = input.value.trim();
        if (value !== answer) {
            feedback.classList.remove('success');
            feedback.textContent = value ? describeMismatch(answer, value) : '先在輸入框打字，再按檢查。';
            return;
        }
        celebrate();
        feedback.classList.add('success');
        if (current < tasks.length - 1) {
            feedback.textContent = `答對了！「${answer}」選字正確，接著下一題。`;
            current += 1;
            render();
            input.focus();
            return;
        }
        finished = true;
        input.readOnly = true;
        checkButton.disabled = true;
        nextSetButton.disabled = false;
        progress.querySelectorAll('span').forEach(item => { item.className = 'done'; });
        feedback.textContent = '這一組完成了！你會切換注音、按聲調，也會用 ↓ 選字。可以換一組新的詞再練。';
    };
    checkButton.addEventListener('click', check);
    input.addEventListener('keydown', event => {
        // Enter while composing confirms the IME candidate; only a plain Enter checks.
        if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); check(); }
    });
    input.addEventListener('input', () => { if (!finished) feedback.classList.remove('success'); });
    nextSetButton.addEventListener('click', () => {
        if (!finished) return;
        setIndex = (setIndex + 1) % warmupSets.length;
        current = 0;
        finished = false;
        nextSetButton.disabled = true;
        feedback.classList.remove('success');
        feedback.textContent = '新的一組開始了，第 1 題。';
        render();
        input.focus();
    });
    render();
    feedback.textContent = '點一下輸入框，切到「中」，開始打第 1 題。';
}

tools = initTypingTools({ getZhuyinTarget: () => keyboardTarget });
setupWarmup();
document.querySelectorAll('[id^="input-level"]').forEach(input => {
    const level = Number(input.id.replace('input-level', ''));
    input.addEventListener('focus', () => {
        keyboardTarget = { text: levelsData.find(item => item.id === level).ans, zhuyin: levelZhuyin[level] };
        tools?.refreshKeyboardGuide?.();
    });
});

initNavbarAuth();
const auth = await initGoogleCourseAuth({ courseId: 'grade3-115-1' }).catch(error => {
    console.warn('Course identity unavailable', error);
    const message = '網站登入暫時無法確認，請告訴老師；課本練習和暖身仍可以做。';
    document.getElementById('course-identity-status').textContent = message;
    return { hasIdentity: () => false, getIdentity: () => null, getIdentityError: () => message };
});
const store = createGoogleCourseProgress({ courseId: 'grade3-115-1', weekCode: '08',
    activityKey: 'typing_task_5', total: 5, getIdentity: auth.getIdentity });
const container = document.getElementById('typing-levels-container');
container.inert = !auth.hasIdentity();
container.querySelectorAll('input,textarea,button').forEach(el => { el.disabled = !auth.hasIdentity(); });
initTypingChallenge({ draftOptions: { enabled: true, getSession: () => auth.getDraftSession?.() }, courseId: 'grade3-115-1', weekCode: '08', activityKey: 'typing_task_5', levelsData,
    // The UI is gated by the verified roster/import controller; the adapter calls
    // authenticated, student-safe RPCs, never the classroom guest RPCs.
    progressAdapter: store,
    levelEncouragements: {
        1: '你切到注音，把兩個字都選對了。', 2: '你記得輕聲的打法，四個字一個一個檢查完成。',
        3: '你看到選錯的字，用 ↓ 換成正確的字，這就是選字的方法。', 4: '你連問號也用中文模式打出來，句子很完整。',
        5: '你耐心打完課文最後一整段，記得用 Enter 換行，也一邊檢查選字和標點。'
    },
    progressMessages: { guestReady: auth.hasIdentity() ? '已接回本人身分，可以開始第一課闖關。' : auth.getIdentityError() || '請先登入學校 Google 帳號並接回舊成果，才可以闖關。',
        loadError: '進度暫時讀取不到，請重新整理或告訴老師。' },
    getWrongAnswerHtml: ({ levelIndex: level, userVal: value }) => {
        const answer = levelsData.find(item => item.id === level)?.ans || '';
        return `${describeMismatch(answer, value)}標點也要用中文模式打。`;
    },
    celebrationContent: { title: '心的小船，順利出航', message: '你一個字一個字選對，努力樹也會記住今天的成果：四片葉、一朵花。',
        buttonText: '看看我的努力樹', buttonHref: '/my-tree.html?course=grade3-115-1&returnTo=%2Fgrade3%2F115-1%2Fweek08.html' }
});
document.querySelectorAll('[data-replay]').forEach(button => {
    button.addEventListener('click', () => {
        if (!auth.hasIdentity()) return;
        const input = document.getElementById(`input-level${button.dataset.replay}`);
        input.readOnly = false; input.value = ''; input.focus();
        document.getElementById(`msg-level${button.dataset.replay}`).textContent = '再練一次，成果不會重複增加。';
    });
});
