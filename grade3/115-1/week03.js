import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initClassCardAuth } from '../../shared/class-card-auth.js?v=20260916-1';
import { createClassCardProgress } from '../../shared/class-card-progress.js';
import { initQuizModule } from '../../shared/quiz-module.js?v=20260916-1';
import { initTypingChallenge } from '../../shared/typing-challenge.js';
import { initTypingTools, renderEnglishKeyboardGuide } from '../../shared/typing-tools.js?v=20260916-1';
import { initQuizReadingAid } from './week03-reading.js?v=20260916-3';

const COURSE_ID = 'grade3-115-1';
const WEEK_CODE = '03';
const classCardAuth = initClassCardAuth({ courseId: COURSE_ID, mode: 'required' });
initNavbarAuth();
initTypingTools({
    showPunctuation: false,
    showKeyboard: true,
    keyboardGuide: true,
    getKeyboardTarget: () => {
        const visibleStages = [...document.querySelectorAll('.typing-stage:not(.hidden)')];
        return visibleStages.at(-1)?.querySelector('.word')?.textContent?.trim() ?? '';
    }
});

const progressStore = (activityKey, total) => createClassCardProgress({
    courseId: COURSE_ID,
    weekCode: WEEK_CODE,
    activityKey,
    total,
    getIdentity: () => classCardAuth.getIdentity()
});

const quizStore = progressStore('quiz_device_safety_5', 5);
const typingStore = progressStore('typing_task_6', 6);

const question = (id, title, options, correct, hint) => ({
    id,
    questionHtml: title,
    options: options.map((text, index) => ({ text, correct: index === correct })),
    hint,
    feedback: hint
});

const quizQuestions = [
        question(1, '影片提醒，使用手機或平板時，哪一種情況最需要避免？', [
            '在教室裡使用，旁邊有明亮的燈光',
            '在很暗的房間裡使用，只看著螢幕的亮光',
            '白天坐在窗戶旁邊使用，房間裡有自然光'
        ], 1, '再想想影片一開始的畫面：昏暗環境容易讓眼睛受傷。'),
        question(2, '影片提醒「不要邊走邊用手機」。下列哪一種情況是要避免的？', [
            '坐在椅子上看手機',
            '停下腳步站好，再看手機',
            '一邊走路一邊低頭看手機，可能撞到東西'
        ], 2, '對，影片提醒要避免一邊走路一邊看手機，因為可能沒有注意前面的路。'),
        question(3, '影片提醒「不要低頭使用」的主要原因是什麼？', [
            '低頭久了，肩膀和脖子可能會痛',
            '低頭時，手機的聲音會變小',
            '低頭時，手機電池會充電變快'
        ], 0, '影片畫面指出低頭容易造成肩頸疼痛。'),
        question(4, '影片中的休息提醒，哪一個說法最完整？', [
            '使用 30 分鐘後，休息一下，大約 1 分鐘',
            '使用 30 分鐘後，至少休息 5～10 分鐘',
            '使用 30 分鐘後，只要閉眼幾秒鐘就可以'
        ], 1, '影片寫的是至少休息 5～10 分鐘，不是短短休息一下。'),
        question(5, '下列哪一組做法完整符合影片的四項提醒？', [
            '在有光線的地方坐著使用，不低頭，使用 30 分鐘後休息 5～10 分鐘',
            '在有光線的地方使用，邊走邊看，使用 30 分鐘後休息 5～10 分鐘',
            '坐著使用但一直低頭，使用 30 分鐘後休息 5～10 分鐘'
    ], 0, '四項提醒都要做到：有光線、不邊走邊看、不低頭，使用 30 分鐘後休息 5～10 分鐘。')
];

const replayQuizQuestions = [
    question(101, '房間有點暗，小安準備用平板看影片。他應該先怎麼做？', [
        '把螢幕調到最亮，其他燈都不開',
        '先打開房間的燈，讓周圍有足夠光線',
        '躲進棉被裡，只看平板的光'
    ], 1, '影片提醒不要在昏暗的環境使用，先讓周圍有足夠光線。'),
    question(102, '走路時收到新訊息，怎麼做比較符合影片提醒？', [
        '先停在安全的地方，再拿出手機查看',
        '繼續走路，只看一下就好',
        '一邊跑步一邊快速回覆'
    ], 0, '先停下來再看，才不會因為低頭而撞到人或物品。'),
    question(103, '小美看平板時一直低著頭。哪一個調整比較好？', [
        '把平板放得更低，頭再低一點',
        '維持原來姿勢，只縮短一次眨眼時間',
        '把平板抬高一些，讓頭和脖子比較自然'
    ], 2, '影片提醒不要長時間低頭，可以把裝置抬高到較舒服的位置。'),
    question(104, '已經連續使用平板 30 分鐘，接下來怎麼做最適合？', [
        '換一個遊戲，繼續使用 30 分鐘',
        '離開螢幕，休息大約 5～10 分鐘',
        '閉眼數到三，立刻繼續使用'
    ], 1, '連續使用 30 分鐘後，要離開螢幕休息大約 5～10 分鐘。'),
    question(105, '阿明在明亮的房間坐著看手機，但已低頭看了 40 分鐘。他還要調整什麼？', [
        '把燈關掉，讓畫面更明顯',
        '站起來邊走邊看，活動一下',
        '抬高手機並先休息 5～10 分鐘'
    ], 2, '環境明亮和坐著還不夠，也要避免低頭，並在使用 30 分鐘後休息。')
];

const quizQuestionSets = [quizQuestions, replayQuizQuestions];
let quizQuestionSetIndex = 0;

const quizReplayButton = document.getElementById('quiz-replay');
let quiz;

function celebratePerfectQuiz() {
    const result = document.getElementById('quiz-result');
    result?.classList.remove('perfect-celebration');
    void result?.offsetWidth;
    result?.classList.add('perfect-celebration');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof window.confetti !== 'function') return;
    const colors = ['#f59e0b', '#f43f5e', '#14b8a6', '#3b82f6', '#a855f7'];
    const burst = (particleRatio, options) => window.confetti({
        particleCount: Math.floor(120 * particleRatio),
        spread: 75,
        startVelocity: 42,
        gravity: 0.9,
        ticks: 180,
        scalar: 1.05,
        colors,
        zIndex: 120,
        origin: { y: 0.62 },
        ...options
    });
    burst(0.45, { spread: 55 });
    burst(0.3, { spread: 100, decay: 0.91, scalar: 0.85 });
    burst(0.25, { spread: 120, startVelocity: 28, decay: 0.92 });
}

function createQuiz(isReplay = false) {
    const currentQuestions = quizQuestionSets[quizQuestionSetIndex];
    return initQuizModule({
        mode: 'assessment',
        optionLabelMode: 'display-order',
        questions: currentQuestions,
        selectors: { lock: 'quiz-lock', content: 'quiz-content', container: 'quiz-container', statusBanner: 'quiz-status-banner', statusText: 'quiz-status-text' },
        loadGuestProgress: () => isReplay ? Promise.resolve(null) : quizStore.load(),
        saveGuestProgress: score => isReplay && score < currentQuestions.length ? Promise.resolve(true) : quizStore.save(score),
        getCurrentUser: () => null,
        requireAuth: false,
        onAfterGrade: ({ correct, total }) => {
            if (correct === total) celebratePerfectQuiz();
        },
        onAfterSubmit: ({ correct, total }) => {
            const banner = document.getElementById('quiz-status-banner');
            banner?.classList.remove('hidden');
            document.getElementById('quiz-status-text').textContent = `影片闖關完成：答對 ${correct} / ${total} 題。`;
            quizReplayButton?.classList.remove('hidden');
        },
        messages: {
            questionLabel: index => `第 ${index} 題`,
            submitButton: '送出五題答案',
            submittedButton: '已送出答案',
            unansweredAlert: remaining => `還有 ${remaining} 題沒有作答，請先完成再送出。`,
            scoreLabel: (correct, total) => `答對 ${correct} / ${total} 題`,
            resultMessages: {
                perfect: ['🏆', '五題全對！你有把影片重點看清楚。'],
                great: ['🌟', '很接近全對，再看看答錯的選項。'],
                good: ['👍', '已完成闖關，請對照正確答案再複習一次。'],
                retry: ['💪', '先看看正確答案，再按「再練習一次」。']
            },
            completedBanner: (score, total) => `影片闖關已完成：答對 ${score ?? '?'} / ${total} 題。`,
            unauthenticated: '請先輸入課堂身分卡。',
            saveError: '答題結果已完成，但過關記錄尚未儲存；請重新送出一次。'
        }
    });
}

quiz = createQuiz();
window.selectOption = (questionId, button) => {
    quiz.selectOption(questionId, button);
    button.closest('[id^="opts-"]')?.querySelectorAll('.opt-btn').forEach(option => {
        option.setAttribute('aria-pressed', String(option === button));
    });
};
window.submitQuiz = () => quiz.submit();
const quizStatusBanner = document.getElementById('quiz-status-banner');
const syncQuizReplay = () => {
    const completed = !quizStatusBanner?.classList.contains('hidden')
        && document.getElementById('quiz-status-text')?.textContent.includes('完成');
    quizReplayButton?.classList.toggle('hidden', !completed);
};
if (quizStatusBanner) new MutationObserver(syncQuizReplay).observe(quizStatusBanner, { attributes: true, childList: true, subtree: true, characterData: true });
quizReplayButton?.addEventListener('click', () => {
    quizQuestionSetIndex = (quizQuestionSetIndex + 1) % quizQuestionSets.length;
    quizReplayButton.classList.add('hidden');
    document.getElementById('quiz-status-banner')?.classList.add('hidden');
    quiz = createQuiz(true);
    void quiz.handleAuthChange(null);
});
initQuizReadingAid();

const typingWordSets = [
    ['mia', 'hat', 'fish', 'name', 'fine', 'goat'],
    ['hat', 'mia', 'goat', 'fine', 'name', 'fish']
];
const pageParams = new URLSearchParams(window.location.search);
const typingSetIndex = Number(pageParams.get('typingSet')) === 1 ? 1 : 0;
const levelsData = typingWordSets[typingSetIndex].map((ans, index) => ({ id: index + 1, ans }));
levelsData.forEach(({ id, ans }) => {
    const word = document.querySelector(`#block-level${id} .word`);
    if (word) word.textContent = ans;
});

function typingHint(value, target) {
    if (!value) return '先點輸入框，看到閃爍的小直線，再開始輸入。';
    const index = [...target].findIndex((char, i) => char !== value[i]);
    if (value.length < target.length) return `可能少了字母，從「${target.slice(Math.max(0, index - 1), index + 2)}」附近再看一次。`;
    if (value.length > target.length) return '可能多打了字母，檢查句尾再試一次。';
    return `第 ${index + 1} 個字母附近不一樣，請對照上面的單字。`;
}

const typingPracticeMode = pageParams.get('typingPractice') === '1';

initTypingChallenge({
    courseId: COURSE_ID,
    weekCode: WEEK_CODE,
    activityKey: 'typing_task_6',
    levelsData,
    levelEncouragements: {
        1: '第一關先練習小寫 mia；你先看清楚字母，再慢慢輸入。',
        2: '你有對照範例修正字母，繼續保持檢查的習慣。',
        3: '單字變長了，你仍然一步一步完成。',
        4: '你先找輸入位置，再開始打字，方法越來越穩。',
        5: '你願意回頭檢查並修正，這讓輸入更精準。',
        6: '六關都完成了，你把耐心和檢查變成自己的方法。'
    },
    buildHint: typingHint,
    getWrongAnswerHtml: ({ hint }) => `❌ 再對照一次單字。<br>${hint}`,
    progressMessages: {
        completed: '六關完成，英文單字輸入進度已接回。',
        firstLogin: '已確認課堂身分卡，先點輸入框再開始。',
        resumed: level => `接回進度：從第 ${level} 關繼續。`,
        unauthenticated: '請先在右上角輸入課堂身分卡，再開始闖關。',
        guestReady: '已確認課堂身分卡，先點輸入框再開始。',
        saveNextLevel: level => `進度已保存，準備好後前往第 ${level} 關。`,
        saveCompleted: '六關完成，進度已保存。'
    },
    requireAuth: false,
    guestProgress: {
        load: () => typingPracticeMode ? Promise.resolve(null) : typingStore.load(),
        save: progress => typingPracticeMode && !progress.completed ? Promise.resolve(true) : typingStore.save(progress)
    },
    celebrationContent: { title: '英文小打字完成！', message: '你學會先點框、看字母、慢慢檢查。', buttonText: '回到本頁' }
});

function setupTypingReplay() {
    const button = document.getElementById('typing-replay');
    const status = document.getElementById('progress-status');
    if (!button || !status) return;
    const sync = () => button.classList.toggle('hidden', !status.textContent.includes('六關完成'));
    new MutationObserver(sync).observe(status, { childList: true, subtree: true, characterData: true });
    button.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('typingPractice', '1');
        url.searchParams.set('typingSet', String((typingSetIndex + 1) % typingWordSets.length));
        url.hash = 'typing-task';
        window.location.assign(url);
    });
    sync();
}

setupTypingReplay();

function moveCardIntoTarget(card, target) {
    const placeholder = document.createElement('div');
    placeholder.className = 'moved-card-slot';
    placeholder.style.minHeight = `${card.getBoundingClientRect().height}px`;
    placeholder.setAttribute('aria-hidden', 'true');
    card.replaceWith(placeholder);
    card.draggable = false;
    card.classList.remove('dragging', 'selected');
    target.append(card);
}

function setupWarmup() {
    const input = document.getElementById('warmup-input');
    const button = document.getElementById('warmup-check');
    const feedback = document.getElementById('warmup-feedback');
    const label = document.getElementById('warmup-label');
    const progress = [...document.querySelectorAll('.warmup-progress span')];
    const letterGuide = document.getElementById('letter-key-guide');
    const stageBadge = document.getElementById('warmup-stage-badge');
    const replayButton = document.getElementById('warmup-replay');
    if (!input || !button || !feedback || !label || !letterGuide) return;
    const taskSets = [
        [
            { answer: '123', inputMode: 'numeric', label: '第 1 題，照著打', intro: '第 1 題：點一下輸入框，看到小直線後，使用右邊的數字鍵輸入 123。' },
            { answer: '508', inputMode: 'numeric', label: '第 2 題，照著打', intro: '第 2 題：先點輸入框，找到小直線；數字中間有 0，慢慢照順序輸入 508。' },
            { answer: 'abc', inputMode: 'text', label: '第 3 題，照著打', intro: '第 3 題：先看按鍵位置，再點輸入框找到小直線，依序輸入小寫 abc。' },
            { answer: 'dog', inputMode: 'text', label: '第 4 題，照著打', intro: '第 4 題：先找 D、O、G，再點輸入框找到小直線，依序輸入小寫 dog。' }
        ],
        [
            { answer: '246', inputMode: 'numeric', label: '第 1 題，照著打', intro: '新題第 1 題：先點輸入框，再照順序輸入 246。' },
            { answer: '701', inputMode: 'numeric', label: '第 2 題，照著打', intro: '新題第 2 題：中間有 0，請慢慢照順序輸入 701。' },
            { answer: 'xyz', inputMode: 'text', label: '第 3 題，照著打', intro: '新題第 3 題：先找 X、Y、Z 的位置，再輸入小寫 xyz。' },
            { answer: 'cat', inputMode: 'text', label: '第 4 題，照著打', intro: '新題第 4 題：先找 C、A、T，再依序輸入小寫 cat。' }
        ]
    ];
    let taskSetIndex = 0;
    let tasks = taskSets[taskSetIndex];
    let current = 0;
    const renderTask = () => {
        const task = tasks[current];
        label.innerHTML = `<span>${task.label.replace('，照著打', '｜照著輸入')}</span><strong>${task.answer}</strong>`;
        input.value = '';
        input.blur();
        input.inputMode = task.inputMode;
        input.maxLength = task.answer.length;
        button.textContent = `檢查第 ${current + 1} 題`;
        if (stageBadge) stageBadge.textContent = `第 ${current + 1} 題`;
        letterGuide.classList.toggle('hidden', current < 2);
        if (current >= 2) renderEnglishKeyboardGuide(letterGuide, { target: task.answer });
        progress.forEach((item, index) => {
            item.classList.toggle('current', index === current);
            item.classList.toggle('done', index < current);
        });
        feedback.textContent = task.intro;
    };
    const check = () => {
        const task = tasks[current];
        if (input.value === task.answer) {
            progress[current]?.classList.remove('current');
            progress[current]?.classList.add('done');
            if (current < tasks.length - 1) {
                current += 1;
                renderTask();
                return;
            }
            input.readOnly = true;
            button.disabled = true;
            letterGuide.classList.add('hidden');
            feedback.textContent = '四題暖身完成！你先複習數字，也找到英文字母的位置了。';
            feedback.classList.add('success');
            replayButton?.classList.remove('hidden');
            return;
        }
        if (current >= 2 && input.value === task.answer.toUpperCase()) {
            feedback.textContent = `位置找對了！請把輸入框清空，再照著 ${task.answer} 慢慢輸入。`;
            return;
        }
        const kind = current < 2 ? '數字' : '字母';
        feedback.textContent = input.value.length < task.answer.length
            ? `還少${kind}，請對照 ${task.answer} 再檢查。`
            : `${kind}或順序不一樣，請對照 ${task.answer} 再試一次。`;
    };
    replayButton?.addEventListener('click', () => {
        taskSetIndex = (taskSetIndex + 1) % taskSets.length;
        tasks = taskSets[taskSetIndex];
        current = 0;
        input.readOnly = false;
        input.disabled = !classCardAuth.hasIdentity();
        button.disabled = !classCardAuth.hasIdentity();
        feedback.classList.remove('success');
        replayButton.classList.add('hidden');
        renderTask();
    });
    button.addEventListener('click', check);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') check(); });
}

function setupMoveTask() {
    const arena = document.querySelector('[data-move-arena]');
    const feedback = document.getElementById('move-feedback');
    const nextButton = document.getElementById('move-next');
    const stageBadge = document.getElementById('move-stage-badge');
    const progress = [...document.querySelectorAll('.move-progress span')];
    if (!arena || !feedback || !nextButton) return;
    const roundSets = [
        [
            { word: 'fish', image: '../images/week03/fish-v2.webp', home: '魚的珊瑚洞', homeImage: '../images/week03/fish-home-v2.webp', direction: 'move-diagonal', arrow: '↘', instruction: '把 fish 往右下方拖到魚的珊瑚洞。' },
            { word: 'hat', image: '../images/week03/hat-v2.webp', home: '帽子的衣帽間', homeImage: '../images/week03/hat-home-v2.webp', direction: 'move-horizontal', arrow: '←', instruction: '把 hat 從右邊水平拖到左邊的衣帽間。' },
            { word: 'goat', image: '../images/week03/goat-v2.webp', home: '山羊的草地小屋', homeImage: '../images/week03/goat-home-v2.webp', direction: 'move-reverse', arrow: '↖', instruction: '把 goat 從右下方拖到左上方的草地小屋。' }
        ],
        [
            { word: 'goat', image: '../images/week03/goat-v2.webp', home: '山羊的草地小屋', homeImage: '../images/week03/goat-home-v2.webp', direction: 'move-diagonal', arrow: '↘', instruction: '新題：把 goat 往右下方拖到草地小屋。' },
            { word: 'fish', image: '../images/week03/fish-v2.webp', home: '魚的珊瑚洞', homeImage: '../images/week03/fish-home-v2.webp', direction: 'move-horizontal', arrow: '←', instruction: '新題：把 fish 從右邊水平拖到左邊的珊瑚洞。' },
            { word: 'hat', image: '../images/week03/hat-v2.webp', home: '帽子的衣帽間', homeImage: '../images/week03/hat-home-v2.webp', direction: 'move-reverse', arrow: '↖', instruction: '新題：把 hat 從右下方拖到左上方的衣帽間。' }
        ]
    ];
    let roundSetIndex = 0;
    let rounds = roundSets[roundSetIndex];
    let current = 0;
    let draggedCard = null;
    const updateProgress = completed => progress.forEach((item, index) => {
        item.classList.toggle('current', !completed && index === current);
        item.classList.toggle('done', index < current || (completed && index === current));
    });
    const renderRound = () => {
        const round = rounds[current];
        draggedCard = null;
        arena.className = `move-arena move-stage ${round.direction}`;
        arena.setAttribute('aria-label', `第 ${current + 1} 關：${round.instruction}`);
        arena.innerHTML = `<div class="move-card" draggable="true" data-word="${round.word}"><img class="move-illustration" src="${round.image}" alt="" draggable="false"><strong>${round.word}</strong></div><div class="move-path-hint" aria-hidden="true">${round.arrow}</div><div class="drop-target" data-drop-word="${round.word}"><img class="move-home-image" src="${round.homeImage}" alt="" draggable="false"><span>${round.home}</span></div>`;
        const card = arena.querySelector('.move-card');
        const target = arena.querySelector('.drop-target');
        nextButton.classList.add('hidden');
        if (stageBadge) stageBadge.textContent = `第 ${current + 1} 關`;
        feedback.textContent = `第 ${current + 1} 關：${round.instruction}`;
        updateProgress(false);
        card.addEventListener('dragstart', event => {
            event.dataTransfer.setData('text/plain', card.dataset.word);
            draggedCard = card;
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedCard = null;
        });
        target.addEventListener('dragover', event => event.preventDefault());
        target.addEventListener('drop', event => {
            event.preventDefault();
            if (target.classList.contains('done')) return;
            if (!draggedCard || draggedCard.dataset.word !== target.dataset.dropWord) {
                feedback.textContent = '還沒到圖片的家，請按住卡片再拖一次。';
                return;
            }
            target.replaceChildren(draggedCard);
            draggedCard.draggable = false;
            draggedCard.classList.remove('dragging');
            draggedCard = null;
            target.classList.add('done');
            updateProgress(true);
            if (current === rounds.length - 1) {
                feedback.textContent = '三關完成！你會往不同方向拖曳了。';
                nextButton.textContent = '換方向再練習';
                nextButton.classList.remove('hidden');
                return;
            }
            nextButton.textContent = `前往第 ${current + 2} 關`;
            nextButton.classList.remove('hidden');
            feedback.textContent = `第 ${current + 1} 關完成！按「下一關」繼續。`;
        });
    };
    nextButton.addEventListener('click', () => {
        if (current >= rounds.length - 1) {
            roundSetIndex = (roundSetIndex + 1) % roundSets.length;
            rounds = roundSets[roundSetIndex];
            current = 0;
        } else {
            current += 1;
        }
        renderRound();
    });
    renderRound();
}

function setupSelectionTask(arena, variants, feedbackId, mode) {
    const feedback = document.getElementById(feedbackId);
    const items = [...arena.querySelectorAll('.select-card-item')];
    const target = arena.querySelector('.selection-target');
    const replayButton = document.getElementById(`${mode}-replay`);
    const initialTargetText = target.textContent;
    const selected = new Set();
    let variantIndex = 0;
    let wanted = variants[variantIndex].wanted;
    let wantedSet = new Set(wanted);
    let completed = false;
    let pointerDrag = null;
    let dragPreview = null;
    let selecting = false; let selectionMoved = false; let selectionAdditive = false; let selectionBase = new Set(); let startX = 0; let startY = 0;
    const rect = arena.querySelector('.selection-rect');
    const applyVariant = () => {
        const variant = variants[variantIndex];
        wanted = variant.wanted;
        wantedSet = new Set(wanted);
        feedback.textContent = variant.feedback;
        document.getElementById(`${mode}-challenge-title`).textContent = variant.title;
        if (mode === 'box') {
            document.getElementById('box-instruction').innerHTML = variant.instruction;
            const orderedKeys = variant.order ?? [...wanted, ...items.map(item => item.dataset.item).filter(key => !wantedSet.has(key))];
            orderedKeys.forEach(key => arena.insertBefore(items.find(item => item.dataset.item === key), target));
        } else {
            document.getElementById('ctrl-target-instruction').innerHTML = `<i class="fa-solid fa-bullseye"></i> 本題請選 <strong>${wanted.join('、')}</strong>。`;
        }
    };
    const update = item => {
        item.classList.toggle('selected', selected.has(item.dataset.item));
        item.setAttribute('aria-selected', String(selected.has(item.dataset.item)));
    };
    const clearSelection = () => {
        selected.clear();
        items.forEach(update);
        feedback.textContent = '已取消選取。請從空白處重新按住、拖曳、放開。';
    };
    const removeDragPreview = () => {
        dragPreview?.remove();
        dragPreview = null;
        arena.classList.remove('group-dragging');
    };
    const showDragPreview = (x, y) => {
        if (!dragPreview) {
            dragPreview = document.createElement('div');
            dragPreview.className = 'selection-drag-preview';
            dragPreview.setAttribute('aria-hidden', 'true');
            const selectedCards = items.filter(card => selected.has(card.dataset.item));
            selectedCards.forEach(card => dragPreview.append(card.cloneNode(true)));
            document.body.append(dragPreview);
            const anchorCard = dragPreview.children[pointerDrag.anchorIndex];
            const previewBounds = dragPreview.getBoundingClientRect();
            const anchorBounds = anchorCard.getBoundingClientRect();
            pointerDrag.offsetX = anchorBounds.left - previewBounds.left + anchorBounds.width * pointerDrag.grabRatioX;
            pointerDrag.offsetY = anchorBounds.top - previewBounds.top + anchorBounds.height * pointerDrag.grabRatioY;
            arena.classList.add('group-dragging');
        }
        dragPreview.style.left = `${x - pointerDrag.offsetX}px`;
        dragPreview.style.top = `${y - pointerDrag.offsetY}px`;
    };
    const finishGroupMove = (x, y) => {
        const targetBounds = target.getBoundingClientRect();
        const overTarget = x >= targetBounds.left && x <= targetBounds.right && y >= targetBounds.top && y <= targetBounds.bottom;
        if (!overTarget) {
            feedback.textContent = '還沒到目標區，請從黃色卡片再拖一次。';
            return;
        }
        const complete = selected.size === wantedSet.size && wanted.every(key => selected.has(key));
        if (!complete) {
            const extra = [...selected].filter(key => !wantedSet.has(key));
            const missing = wanted.filter(key => !selected.has(key));
            const details = [extra.length ? `多選了 ${extra.join('、')}` : '', missing.length ? `還少 ${missing.join('、')}` : ''].filter(Boolean).join('；');
            feedback.textContent = `${details}。${mode === 'box' ? '請從空白處重新框選' : '請按住 Ctrl 調整選取'}，再拖曳。`;
            return;
        }
        completed = true;
        target.textContent = '';
        items.filter(card => selected.has(card.dataset.item)).forEach(card => moveCardIntoTarget(card, target));
        selected.clear();
        target.classList.add('done');
        feedback.textContent = '選取正確，整群拖曳完成！';
        replayButton?.classList.remove('hidden');
    };
    items.forEach(item => item.addEventListener('click', event => {
        if (completed || mode !== 'ctrl') return;
        const key = item.dataset.item;
        if (event.ctrlKey) {
            selected.has(key) ? selected.delete(key) : selected.add(key);
        } else {
            selected.clear();
            selected.add(key);
        }
        items.forEach(update);
        feedback.textContent = `已選 ${selected.size} 個；不按 Ctrl 是單選，按住 Ctrl 可增加或取消。`;
    }));
    if (mode === 'box' || mode === 'ctrl') {
        arena.addEventListener('pointerdown', event => {
            if (completed || event.button !== 0 || event.target.closest('.select-card-item,.selection-target')) return;
            selecting = true; selectionMoved = false; selectionAdditive = mode === 'ctrl' && event.ctrlKey; selectionBase = new Set(selectionAdditive ? selected : []); const bounds = arena.getBoundingClientRect(); startX = event.clientX - bounds.left; startY = event.clientY - bounds.top;
            rect.hidden = false; rect.style.left = `${startX}px`; rect.style.top = `${startY}px`; rect.style.width = '0'; rect.style.height = '0'; arena.setPointerCapture(event.pointerId);
        });
        arena.addEventListener('pointermove', event => {
            if (!selecting) return; const bounds = arena.getBoundingClientRect(); const x = event.clientX - bounds.left; const y = event.clientY - bounds.top; const left = Math.min(startX, x); const top = Math.min(startY, y); const width = Math.abs(x - startX); const height = Math.abs(y - startY);
            if (!selectionMoved && Math.hypot(x - startX, y - startY) < 6) return;
            selectionMoved = true; rect.style.left = `${left}px`; rect.style.top = `${top}px`; rect.style.width = `${width}px`; rect.style.height = `${height}px`;
            const enclosed = new Set();
            items.forEach(item => { const b = item.getBoundingClientRect(); const i = { left: b.left - bounds.left, top: b.top - bounds.top, right: b.right - bounds.left, bottom: b.bottom - bounds.top }; if (i.left >= left && i.right <= left + width && i.top >= top && i.bottom <= top + height) enclosed.add(item.dataset.item); });
            selected.clear();
            if (selectionAdditive) selectionBase.forEach(key => selected.add(key));
            enclosed.forEach(key => selected.add(key));
            items.forEach(update);
        });
        arena.addEventListener('pointerup', event => {
            if (!selecting) return;
            selecting = false;
            rect.hidden = true;
            arena.releasePointerCapture(event.pointerId);
            if (!selectionMoved) {
                clearSelection();
                return;
            }
            feedback.textContent = `已拖曳選取 ${selected.size} 個；可再調整，或從其中一張黃色卡片拖到目標區。`;
        });
    }
    items.forEach(item => {
        item.draggable = false;
        item.addEventListener('pointerdown', event => {
            if (completed || event.button !== 0 || event.ctrlKey || !selected.has(item.dataset.item)) return;
            const selectedCards = items.filter(card => selected.has(card.dataset.item));
            const itemBounds = item.getBoundingClientRect();
            pointerDrag = {
                id: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                active: false,
                anchorIndex: selectedCards.indexOf(item),
                grabRatioX: (event.clientX - itemBounds.left) / itemBounds.width,
                grabRatioY: (event.clientY - itemBounds.top) / itemBounds.height,
                offsetX: 0,
                offsetY: 0
            };
            item.setPointerCapture(event.pointerId);
        });
        item.addEventListener('pointermove', event => {
            if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
            if (!pointerDrag.active && Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) >= 6) {
                pointerDrag.active = true;
                if (rect) rect.hidden = true;
            }
            if (pointerDrag.active) showDragPreview(event.clientX, event.clientY);
        });
        item.addEventListener('pointerup', event => {
            if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
            const wasDragging = pointerDrag.active;
            pointerDrag = null;
            if (item.hasPointerCapture(event.pointerId)) item.releasePointerCapture(event.pointerId);
            removeDragPreview();
            if (wasDragging) {
                event.preventDefault();
                finishGroupMove(event.clientX, event.clientY);
            }
        });
        item.addEventListener('pointercancel', () => {
            pointerDrag = null;
            removeDragPreview();
        });
    });
    replayButton?.addEventListener('click', () => {
        completed = false;
        selecting = false;
        pointerDrag = null;
        removeDragPreview();
        if (rect) rect.hidden = true;
        items.forEach(item => {
            const placeholder = item.parentElement === target ? arena.querySelector('.moved-card-slot') : null;
            if (placeholder) {
                placeholder.replaceWith(item);
            }
            item.classList.remove('selected');
            item.setAttribute('aria-selected', 'false');
        });
        selected.clear();
        target.classList.remove('done');
        target.textContent = initialTargetText;
        variantIndex = (variantIndex + 1) % variants.length;
        applyVariant();
        replayButton.classList.add('hidden');
    });
    applyVariant();
}

setupMoveTask();
setupWarmup();
setupSelectionTask(document.querySelector('[data-selection-arena="box"]'), [
    {
        wanted: ['mia', 'abu', 'fine'],
        order: ['mia', 'abu', 'fine', 'name', 'team'],
        title: '只選 mia、abu、fine',
        instruction: '從空白處按住左鍵，框住 <strong>mia、abu、fine</strong> 三張卡。放開完成框選後，再從黃色卡片拖到目標區。',
        feedback: '只選 mia、abu、fine，共 3 張；不要選到 name、team，再把整群拖進目標區。'
    },
    {
        wanted: ['name', 'team'],
        order: ['mia', 'abu', 'fine', 'name', 'team'],
        title: '新題：只框右邊 2 張',
        instruction: '新題：從卡片<strong>右邊的空白處</strong>開始，往左框住 <strong>name、team</strong> 兩張卡。',
        feedback: '從右邊往左，只框 name、team，共 2 張；不要框到 fine。'
    },
    {
        wanted: ['abu', 'fine', 'name', 'team'],
        order: ['mia', 'abu', 'fine', 'name', 'team'],
        title: '新題：從右邊框 4 張',
        instruction: '新題：從卡片<strong>右邊的空白處</strong>開始，往左框住 <strong>abu、fine、name、team</strong>。',
        feedback: '從右邊往左框 4 張；只留下 mia 不要選。'
    },
    {
        wanted: ['mia', 'abu', 'fine', 'name', 'team'],
        order: ['mia', 'abu', 'fine', 'name', 'team'],
        title: '新題：一次框住全部 5 張',
        instruction: '新題：從卡片<strong>右邊的空白處</strong>開始，往左框住全部 5 張卡。',
        feedback: '這次要一次框住全部 5 張，再把整群拖到目標區。'
    }
], 'box-feedback', 'box');
setupSelectionTask(document.querySelector('[data-selection-arena="ctrl"]'), [
    { wanted: ['mia', 'fish', 'name'], title: '只選 mia、fish、name', feedback: '按住 Ctrl，只選 mia、fish、name；放開 Ctrl 後再拖曳。' },
    { wanted: ['mia', 'hat', 'goat'], title: '新題：只選 mia、hat、goat', feedback: '新題：按住 Ctrl，只選 mia、hat、goat；放開 Ctrl 後再拖曳。' }
], 'ctrl-feedback', 'ctrl');

function refreshIdentity() {
    const ready = classCardAuth.hasIdentity();
    document.body.classList.toggle('class-card-not-ready', !ready);
    document.body.classList.toggle('class-card-ready', ready);
    const typingContainer = document.getElementById('typing-levels-container');
    const warmupInput = document.getElementById('warmup-input');
    const warmupButton = document.getElementById('warmup-check');
    if (warmupInput && !warmupInput.readOnly) warmupInput.disabled = !ready;
    if (warmupButton && !warmupInput?.readOnly) warmupButton.disabled = !ready;
    typingContainer?.toggleAttribute('inert', !ready);
    if (!ready) typingContainer?.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    document.getElementById('quiz-lock').classList.toggle('hidden', ready);
    document.getElementById('quiz-content').classList.toggle('hidden', !ready);
    if (ready) void quiz.handleAuthChange(null);
}

refreshIdentity();
window.addEventListener('class-card:identity-changed', () => window.location.reload());
document.getElementById('boot-status').hidden = true;
