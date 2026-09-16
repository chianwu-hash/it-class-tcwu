import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initClassCardAuth } from '../../shared/class-card-auth.js';
import { createClassCardProgress } from '../../shared/class-card-progress.js';
import { initQuizModule } from '../../shared/quiz-module.js';
import { initTypingChallenge } from '../../shared/typing-challenge.js';
import { initTypingTools } from '../../shared/typing-tools.js';
import { initQuizReadingAid } from './week03-reading.js?v=20260916-3';

const COURSE_ID = 'grade3-115-1';
const WEEK_CODE = '03';
const classCardAuth = initClassCardAuth({ courseId: COURSE_ID, mode: 'required' });
initNavbarAuth();
initTypingTools({ showPunctuation: false, showKeyboard: true });

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

const quiz = initQuizModule({
    mode: 'practice',
    optionLabelMode: 'display-order',
    questions: [
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
    ],
    selectors: { lock: 'quiz-lock', content: 'quiz-content', container: 'quiz-container', statusBanner: 'quiz-status-banner', statusText: 'quiz-status-text' },
    loadGuestProgress: async () => {
        const saved = await quizStore.load();
        return saved;
    },
    saveGuestProgress: score => quizStore.save(score),
    getCurrentUser: () => null,
    requireAuth: false,
    onAfterSubmit: ({ correct, total }) => {
        const banner = document.getElementById('quiz-status-banner');
        banner?.classList.toggle('hidden', correct === 0);
        document.getElementById('quiz-status-text').textContent = correct === total
            ? `影片闖關完成：${correct} / ${total} 題`
            : `影片闖關進度：${correct} / ${total} 題`;
    },
    messages: {
        complete: '5 題完成！請抬頭看遠方，輕輕轉動肩膀。',
        saveError: '進度還沒存好，請再按一次剛才的答案。'
    }
});
initQuizReadingAid();

const levelsData = [
    { id: 1, ans: 'mia' }, { id: 2, ans: 'hat' }, { id: 3, ans: 'fish' },
    { id: 4, ans: 'name' }, { id: 5, ans: 'fine' }, { id: 6, ans: 'goat' }
];

function typingHint(value, target) {
    if (!value) return '先點輸入框，看到閃爍的小直線，再開始輸入。';
    const index = [...target].findIndex((char, i) => char !== value[i]);
    if (value.length < target.length) return `可能少了字母，從「${target.slice(Math.max(0, index - 1), index + 2)}」附近再看一次。`;
    if (value.length > target.length) return '可能多打了字母，檢查句尾再試一次。';
    return `第 ${index + 1} 個字母附近不一樣，請對照上面的單字。`;
}

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
    guestProgress: { load: () => typingStore.load(), save: progress => typingStore.save(progress) },
    celebrationContent: { title: '英文小打字完成！', message: '你學會先點框、看字母、慢慢檢查。', buttonText: '回到本頁' }
});

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
    const keyLocations = document.getElementById('letter-key-locations');
    const guideKeys = [...document.querySelectorAll('.mini-keyboard [data-key]')];
    if (!input || !button || !feedback || !label || !letterGuide || !keyLocations) return;
    const tasks = [
        { answer: '123', inputMode: 'numeric', label: '第 1 題，照著打', intro: '第 1 題：點一下輸入框，看到小直線後，使用右邊的數字鍵輸入 123。' },
        { answer: '508', inputMode: 'numeric', label: '第 2 題，照著打', intro: '第 2 題：先點輸入框，找到小直線；數字中間有 0，慢慢照順序輸入 508。' },
        { answer: 'abc', inputMode: 'text', label: '第 3 題，照著打', intro: '第 3 題：先看按鍵位置，再點輸入框找到小直線，依序輸入小寫 abc。', locations: '<b>A 在中間排左邊</b>、<b>C 在下排左邊</b>、<b>B 在下排中間</b>' },
        { answer: 'dog', inputMode: 'text', label: '第 4 題，照著打', intro: '第 4 題：先找 D、O、G，再點輸入框找到小直線，依序輸入小寫 dog。', locations: '<b>D、G 在中間排</b>，<b>O 在最上排右邊</b>' }
    ];
    let current = 0;
    const renderTask = () => {
        const task = tasks[current];
        label.innerHTML = `<span>${task.label.replace('，照著打', '｜照著輸入')}</span><strong>${task.answer}</strong>`;
        input.value = '';
        input.blur();
        input.inputMode = task.inputMode;
        input.maxLength = task.answer.length;
        button.textContent = `檢查第 ${current + 1} 題`;
        letterGuide.classList.toggle('hidden', current < 2);
        guideKeys.forEach(key => key.classList.toggle('target-key', task.answer.includes(key.dataset.key)));
        if (task.locations) keyLocations.innerHTML = `找法：${task.locations}。看清楚範例後，再照順序輸入。`;
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
    button.addEventListener('click', check);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') check(); });
}

function setupMoveTask() {
    const arena = document.querySelector('[data-move-arena]');
    const feedback = document.getElementById('move-feedback');
    const nextButton = document.getElementById('move-next');
    const progress = [...document.querySelectorAll('.move-progress span')];
    if (!arena || !feedback || !nextButton) return;
    const rounds = [
        { word: 'fish', image: '../images/week03/fish-v2.webp', home: '魚的珊瑚洞', homeImage: '../images/week03/fish-home-v2.webp', direction: 'move-diagonal', arrow: '↘', instruction: '把 fish 往右下方拖到魚的珊瑚洞。' },
        { word: 'hat', image: '../images/week03/hat-v2.webp', home: '帽子的衣帽間', homeImage: '../images/week03/hat-home-v2.webp', direction: 'move-horizontal', arrow: '←', instruction: '把 hat 從右邊水平拖到左邊的衣帽間。' },
        { word: 'goat', image: '../images/week03/goat-v2.webp', home: '山羊的草地小屋', homeImage: '../images/week03/goat-home-v2.webp', direction: 'move-reverse', arrow: '↖', instruction: '把 goat 從右下方拖到左上方的草地小屋。' }
    ];
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
                nextButton.textContent = '再練習一次';
                nextButton.classList.remove('hidden');
                return;
            }
            nextButton.textContent = `前往第 ${current + 2} 關`;
            nextButton.classList.remove('hidden');
            feedback.textContent = `第 ${current + 1} 關完成！按「下一關」繼續。`;
        });
    };
    nextButton.addEventListener('click', () => {
        current = current >= rounds.length - 1 ? 0 : current + 1;
        renderRound();
    });
    renderRound();
}

function setupSelectionTask(arena, wanted, feedbackId, mode) {
    const feedback = document.getElementById(feedbackId);
    const items = [...arena.querySelectorAll('.select-card-item')];
    const target = arena.querySelector('.selection-target');
    const selected = new Set();
    const wantedSet = new Set(wanted);
    let completed = false;
    let pointerDrag = null;
    let dragPreview = null;
    let selecting = false; let startX = 0; let startY = 0;
    const rect = arena.querySelector('.selection-rect');
    const update = item => {
        item.classList.toggle('selected', selected.has(item.dataset.item));
        item.setAttribute('aria-selected', String(selected.has(item.dataset.item)));
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
            items.filter(card => selected.has(card.dataset.item)).forEach(card => dragPreview.append(card.cloneNode(true)));
            document.body.append(dragPreview);
            arena.classList.add('group-dragging');
        }
        dragPreview.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
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
    };
    items.forEach(item => item.addEventListener('click', event => {
        if (completed || mode !== 'ctrl' || !event.ctrlKey) return;
        const key = item.dataset.item;
        selected.has(key) ? selected.delete(key) : selected.add(key);
        update(item);
        feedback.textContent = `已選 ${selected.size} 個；按住 Ctrl 繼續選，再把整群拖到目標區。`;
    }));
    if (mode === 'box') {
        arena.addEventListener('pointerdown', event => {
            if (completed || event.button !== 0 || event.target.closest('.select-card-item,.selection-target')) return;
            selecting = true; const bounds = arena.getBoundingClientRect(); startX = event.clientX - bounds.left; startY = event.clientY - bounds.top;
            rect.hidden = false; rect.style.left = `${startX}px`; rect.style.top = `${startY}px`; rect.style.width = '0'; rect.style.height = '0'; arena.setPointerCapture(event.pointerId);
        });
        arena.addEventListener('pointermove', event => {
            if (!selecting) return; const bounds = arena.getBoundingClientRect(); const x = event.clientX - bounds.left; const y = event.clientY - bounds.top; const left = Math.min(startX, x); const top = Math.min(startY, y); const width = Math.abs(x - startX); const height = Math.abs(y - startY); rect.style.left = `${left}px`; rect.style.top = `${top}px`; rect.style.width = `${width}px`; rect.style.height = `${height}px`;
            items.forEach(item => { const b = item.getBoundingClientRect(); const i = { left: b.left - bounds.left, top: b.top - bounds.top, right: b.right - bounds.left, bottom: b.bottom - bounds.top }; const inside = i.left >= left && i.right <= left + width && i.top >= top && i.bottom <= top + height; if (inside) selected.add(item.dataset.item); else selected.delete(item.dataset.item); update(item); });
        });
        arena.addEventListener('pointerup', event => { if (!selecting) return; selecting = false; rect.hidden = true; arena.releasePointerCapture(event.pointerId); feedback.textContent = `已框選 ${selected.size} 個；從其中一張已選卡片拖到目標區。`; });
    }
    items.forEach(item => {
        item.draggable = false;
        item.addEventListener('pointerdown', event => {
            if (completed || event.button !== 0 || event.ctrlKey || !selected.has(item.dataset.item)) return;
            pointerDrag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
            item.setPointerCapture(event.pointerId);
        });
        item.addEventListener('pointermove', event => {
            if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
            if (!pointerDrag.active && Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) >= 6) pointerDrag.active = true;
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
}

setupMoveTask();
setupWarmup();
setupSelectionTask(document.querySelector('[data-selection-arena="box"]'), ['mia', 'abu', 'fine'], 'box-feedback', 'box');
setupSelectionTask(document.querySelector('[data-selection-arena="ctrl"]'), ['mia', 'fish', 'name'], 'ctrl-feedback', 'ctrl');

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
