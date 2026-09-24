import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initClassCardAuth } from '../../shared/class-card-auth.js?v=20260916-1';
import { createClassCardProgress } from '../../shared/class-card-progress.js';
import { initTypingChallenge } from '../../shared/typing-challenge.js?v=20260923-1';
import { initTypingTools, renderBackspaceKeyHint, renderCapsLockKeyHint, renderShiftKeyHint } from '../../shared/typing-tools.js?v=20260924-1';

const COURSE_ID = 'grade3-115-1';
const WEEK_CODE = '04';
const ACTIVITY_KEY = 'typing_task_6';

const classCardAuth = initClassCardAuth({ courseId: COURSE_ID, mode: 'required' });
initNavbarAuth();

const TREASURE_GROUPS = [
    { expression: '光精靈 ＋ 火精靈 ＝ ？', answer: 6 },
    { expression: '樹精靈 － 火精靈 ＝ ？', answer: 12 },
    { expression: '海精靈 ＋ 光精靈 ＝ ？', answer: 10 },
    { expression: '火精靈 × 海精靈 ＝ ？', answer: 32 },
    { expression: '樹精靈 － 光精靈 ＝ ？', answer: 14 }
];

const identity = classCardAuth.getIdentity();
const seatNo = Number.parseInt(identity?.seatNo, 10);
const treasureGroupIndex = Number.isFinite(seatNo) && seatNo > 0
    ? (seatNo - 1) % TREASURE_GROUPS.length
    : 0;
let activeTreasureGroupIndex = treasureGroupIndex;
let treasureGroup = TREASURE_GROUPS[activeTreasureGroupIndex];
let treasureRetryRound = 0;

const levelsData = [
    { id: 1, ans: 'Leo' },
    { id: 2, ans: String(treasureGroup.answer) },
    { id: 3, ans: 'Abu' },
    { id: 4, ans: 'MIA' },
    { id: 5, ans: 'Mia, Abu' },
    { id: 6, ans: 'My name is Mia.' }
];

const PRACTICE_BANKS = {
    1: ['Leo', 'Ben'],
    3: ['Abu', 'Mia'],
    4: ['MIA', 'ABU'],
    5: ['Mia, Abu', 'Abu, Mia'],
    6: ['My name is Mia.', 'My name is Abu.']
};
const practiceBankIndices = new Map(Object.keys(PRACTICE_BANKS).map(level => [Number(level), 0]));
const retryingLevels = new Set();
let activeKeyboardTarget;

const typingTools = initTypingTools({
    showPunctuation: false,
    showKeyboard: true,
    keyboardGuide: true,
    getKeyboardTarget: () => {
        if (activeKeyboardTarget !== undefined) return activeKeyboardTarget;
        const visibleLevels = [...document.querySelectorAll('.typing-level:not(.hidden)')];
        const currentLevel = visibleLevels.at(-1);
        if (currentLevel?.id === 'block-level2') return '';
        return currentLevel?.querySelector('.word')?.textContent?.trim() ?? 'Leo';
    }
});

function setActiveKeyboardTarget(target) {
    activeKeyboardTarget = target;
    typingTools?.refreshKeyboardGuide?.();
}

function connectInputToKeyboardGuide(input, getTarget) {
    if (!input) return;
    input.addEventListener('focus', () => {
        const target = typeof getTarget === 'function' ? getTarget() : getTarget;
        setActiveKeyboardTarget(target ?? '');
    });
}

levelsData.forEach(({ id }, index) => {
    const block = document.getElementById(`block-level${id}`);
    const getTarget = () => index === 1 ? '' : levelsData[index]?.ans ?? '';
    connectInputToKeyboardGuide(
        document.getElementById(`input-level${id}`),
        getTarget
    );
    if (block) {
        new MutationObserver(() => {
            if (!block.classList.contains('hidden')) {
                setActiveKeyboardTarget(getTarget());
            }
        }).observe(block, { attributes: true, attributeFilter: ['class'] });
    }
});

document.querySelectorAll('.caps-lock-key-hint').forEach(container => {
    renderCapsLockKeyHint(container);
});

document.querySelectorAll('.shift-key-hint').forEach(container => {
    renderShiftKeyHint(container);
});

function renderTreasureAssignment() {
    const groupLabel = document.getElementById('treasure-group-label');
    const expression = document.getElementById('treasure-expression');
    if (!groupLabel || !expression) return;

    if (!identity) {
        groupLabel.textContent = '完成課堂身分卡後取得線索';
        expression.textContent = '先完成第 1 關 Leo';
        return;
    }

    groupLabel.textContent = treasureRetryRound > 0
        ? `再練習第 ${treasureRetryRound} 題｜第 ${activeTreasureGroupIndex + 1} 組線索`
        : `第 ${treasureGroupIndex + 1} 組線索｜座號 ${identity.seatLabel ?? seatNo}`;
    expression.textContent = treasureGroup.expression;
}

const typingStore = createClassCardProgress({
    courseId: COURSE_ID,
    weekCode: WEEK_CODE,
    activityKey: ACTIVITY_KEY,
    total: levelsData.length,
    getIdentity: () => classCardAuth.getIdentity()
});

function describeCharacter(character) {
    if (character === undefined) return '沒有字元';
    if (character === ' ') return '空格';
    if (character === ',') return '英文逗號 ,';
    if (character === '.') return '英文句點 .';
    return `「${character}」`;
}

function buildTypingHint(value, target, levelIndex) {
    if (levelIndex === 2) {
        return value
            ? '數字答案還不正確。請回到藏寶圖重新確認與計算。'
            : '請先在白色輸入框輸入算式答案的數字。';
    }

    if (!value) return '先點輸入框，看到閃爍的小直線，再開始逐字輸入。';

    const maxLength = Math.max(value.length, target.length);
    let differenceIndex = 0;
    while (differenceIndex < maxLength && value[differenceIndex] === target[differenceIndex]) {
        differenceIndex += 1;
    }

    if (differenceIndex >= target.length && value.length > target.length) {
        return `答案後面多了 ${value.length - target.length} 個字元，請從句尾用 Backspace 檢查。`;
    }
    if (differenceIndex >= value.length && value.length < target.length) {
        return `第 ${differenceIndex + 1} 個位置還少了${describeCharacter(target[differenceIndex])}，請接著完成。`;
    }

    const expected = target[differenceIndex];
    const actual = value[differenceIndex];
    if (expected?.toLowerCase() === actual?.toLowerCase() && expected !== actual) {
        return `第 ${differenceIndex + 1} 個字母大小寫不同：應該是${describeCharacter(expected)}，請檢查 Caps Lock。`;
    }
    return `第 ${differenceIndex + 1} 個位置不同：應該是${describeCharacter(expected)}，目前是${describeCharacter(actual)}。`;
}

function getTypingWrongAnswerHtml({ levelIndex, hint }) {
    return levelIndex === 2
        ? `❌ ${hint}<br>這一關只輸入算式答案的數字。`
        : `❌ 還有一個地方需要檢查。<br>${hint}`;
}

initTypingChallenge({
    courseId: COURSE_ID,
    weekCode: WEEK_CODE,
    activityKey: ACTIVITY_KEY,
    levelsData,
    levelEncouragements: {
        1: '你把剛才練習 Mia 的方法換到新姓名 Leo，也解鎖了尋寶任務。',
        2: '你把網頁線索帶到真正的 Windows，靠操作、計算與檢查找回了通關密語。',
        3: '你把同一個大小寫方法換到 Abu，表示你正在掌握姓名首字大寫。',
        4: '你先開啟大寫、完成代碼，再記得關閉，操作很有步驟。',
        5: '你耐心留意逗號後的空格，也把兩個姓名都打對了。',
        6: '你靠逐字對照和回頭檢查完成整句，這套方法下次也能繼續用。'
    },
    buildHint: buildTypingHint,
    getWrongAnswerHtml: getTypingWrongAnswerHtml,
    progressMessages: {
        completed: '六關已完成；可以重新看任務路線，並確認 Caps Lock 已關閉。',
        firstLogin: '已確認課堂身分卡，先練習 Mia，再從第 1 關 Leo 開始。',
        resumed: level => `已接回進度，從第 ${level} 關繼續。`,
        unauthenticated: '請先在右上角輸入課堂身分卡，才可以闖關。',
        guestReady: classCardAuth.hasIdentity()
            ? '已確認課堂身分卡，先練習 Mia，再從第 1 關 Leo 開始。'
            : '請先在右上角輸入課堂身分卡，才可以闖關。',
        guestNextLevel: level => `進度已保存，準備好後挑戰第 ${level} 關。`,
        guestCompleted: '六關完成，進度已保存；最後確認 Caps Lock 已關閉。',
        saveNextLevel: level => `進度已保存，準備好後挑戰第 ${level} 關。`,
        saveCompleted: '六關完成，進度已保存；最後確認 Caps Lock 已關閉。'
    },
    requireAuth: false,
    guestProgress: {
        load: () => typingStore.load(),
        save: progress => typingStore.save(progress)
    },
    celebrationContent: {
        title: '彩虹精靈任務完成！',
        message: '你取得姓名通行證、找到彩虹密語，也完成了四個快手任務；離開前記得關閉 Caps Lock。',
        buttonText: '回到本週課程'
    },
    autoScrollNext: false
});

function changeToNextPracticeQuestion(levelIndex) {
    if (levelIndex === 2) {
        activeTreasureGroupIndex = (activeTreasureGroupIndex + 1) % TREASURE_GROUPS.length;
        treasureGroup = TREASURE_GROUPS[activeTreasureGroupIndex];
        treasureRetryRound += 1;
        levelsData[1].ans = String(treasureGroup.answer);
        renderTreasureAssignment();
        return;
    }

    const bank = PRACTICE_BANKS[levelIndex];
    if (!bank?.length) return;
    const nextIndex = ((practiceBankIndices.get(levelIndex) ?? 0) + 1) % bank.length;
    practiceBankIndices.set(levelIndex, nextIndex);
    const nextAnswer = bank[nextIndex];
    levelsData[levelIndex - 1].ans = nextAnswer;
    const prompt = document.querySelector(`#block-level${levelIndex} .typing-prompt .word`);
    const input = document.getElementById(`input-level${levelIndex}`);
    if (prompt) prompt.textContent = nextAnswer;
    if (input) input.placeholder = `逐字輸入 ${nextAnswer}`;
}

function startLevelRetry(levelIndex) {
    const input = document.getElementById(`input-level${levelIndex}`);
    const message = document.getElementById(`msg-level${levelIndex}`);
    const checkButton = document.getElementById(`check-${levelIndex}`);
    if (!input || !message || !checkButton) return;

    changeToNextPracticeQuestion(levelIndex);
    retryingLevels.add(levelIndex);
    input.value = '';
    input.readOnly = false;
    input.disabled = false;
    input.classList.remove('border-green-400', 'bg-green-50', 'text-green-800', 'border-red-500', 'border-amber-400', 'bg-amber-50', 'text-amber-800', 'shake');
    checkButton.disabled = false;
    checkButton.style.display = '';
    message.textContent = levelIndex === 2
        ? '已換成不同的精靈算式。請再看一次藏寶圖，算好後只輸入數字。'
        : '已換成不同題目。請看新題目，再練習一次。';
    message.className = 'level-message text-indigo-700';
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
    typingTools?.refreshKeyboardGuide?.();
}

function setupLevelPracticeActions() {
    const savedCheckLevel = window.checkLevel;
    if (typeof savedCheckLevel !== 'function') return;

    window.checkLevel = async levelIndex => {
        if (!retryingLevels.has(levelIndex)) {
            return savedCheckLevel(levelIndex);
        }

        const input = document.getElementById(`input-level${levelIndex}`);
        const message = document.getElementById(`msg-level${levelIndex}`);
        const target = levelsData[levelIndex - 1]?.ans;
        if (!input || !message || typeof target !== 'string') return;
        const value = input.value.trim();

        if (value === target) {
            retryingLevels.delete(levelIndex);
            input.readOnly = true;
            input.classList.remove('shake', 'border-red-500');
            input.classList.add('border-green-400', 'bg-green-50', 'text-green-800');
            message.textContent = '再練習完成！這次是不同題目，正式過關進度不會倒退。';
            message.className = 'level-message text-emerald-700';
            window.confetti?.({ particleCount: 35, spread: 50, origin: { y: 0.78 } });
            return;
        }

        const hint = buildTypingHint(value, target, levelIndex);
        message.innerHTML = getTypingWrongAnswerHtml({ levelIndex, hint });
        message.className = 'level-message text-red-500';
        input.classList.remove('shake', 'border-green-400', 'bg-green-50', 'text-green-800');
        void input.offsetWidth;
        input.classList.add('shake', 'border-red-500');
    };

    levelsData.forEach(({ id: levelIndex }) => {
        const input = document.getElementById(`input-level${levelIndex}`);
        const message = document.getElementById(`msg-level${levelIndex}`);
        const nextBlock = document.getElementById(`block-level${levelIndex + 1}`);
        if (!input || !message) return;

        const actions = document.createElement('div');
        actions.id = `practice-actions-level${levelIndex}`;
        actions.className = 'level-practice-actions hidden';
        actions.innerHTML = `
            <button id="retry-level${levelIndex}" type="button" class="level-retry-button"><i class="fa-solid fa-rotate-right mr-2"></i>再練習一次</button>
            ${levelIndex < levelsData.length ? `<button id="next-level${levelIndex}" type="button" class="level-next-button">前往第 ${levelIndex + 1} 關<i class="fa-solid fa-arrow-down ml-2"></i></button>` : ''}
        `;
        message.insertAdjacentElement('afterend', actions);

        actions.querySelector(`#retry-level${levelIndex}`)?.addEventListener('click', () => startLevelRetry(levelIndex));
        actions.querySelector(`#next-level${levelIndex}`)?.addEventListener('click', () => {
            nextBlock?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const nextInput = document.getElementById(`input-level${levelIndex + 1}`);
            if (nextInput && !nextInput.disabled && !nextInput.readOnly) {
                nextInput.focus({ preventScroll: true });
            }
        });

        const sync = () => {
            const nextReady = levelIndex === levelsData.length || !nextBlock?.classList.contains('hidden');
            actions.classList.toggle('hidden', !input.readOnly || !nextReady);
        };
        new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ['readonly'] });
        if (nextBlock) new MutationObserver(sync).observe(nextBlock, { attributes: true, attributeFilter: ['class'] });
        sync();
    });
}

function setupWarmup() {
    const input = document.getElementById('warmup-input');
    const button = document.getElementById('warmup-check');
    const feedback = document.getElementById('warmup-feedback');
    const stageLabel = document.getElementById('warmup-stage-label');
    const title = document.getElementById('warmup-title');
    const instruction = document.getElementById('warmup-instruction');
    const progress1 = document.getElementById('warmup-progress-1');
    const progress2 = document.getElementById('warmup-progress-2');
    if (!input || !button || !feedback || !stageLabel || !title || !instruction || !progress1 || !progress2) return;

    let stage = 1;
    let correctionStep = 0;
    let correctionPathValid = true;
    connectInputToKeyboardGuide(input, () => stage === 1 ? 'mia' : 'Abu');

    input.addEventListener('keydown', event => {
        if (stage !== 2) return;
        if (event.key === 'Backspace') {
            const deletesOnlyWrongLetter = correctionStep === 0
                && input.value === 'Abw'
                && input.selectionStart === input.value.length
                && input.selectionEnd === input.value.length;
            correctionPathValid = correctionPathValid && deletesOnlyWrongLetter;
            if (deletesOnlyWrongLetter) correctionStep = 1;
            return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const typesReplacement = correctionStep === 1 && input.value === 'Ab' && event.key === 'u';
            correctionPathValid = correctionPathValid && typesReplacement;
            if (typesReplacement) correctionStep = 2;
            return;
        }
        if (event.key === 'Delete') correctionPathValid = false;
    });

    input.addEventListener('input', () => {
        if (stage !== 2) return;
        const expectedValue = ['Abw', 'Ab', 'Abu'][correctionStep];
        if (input.value !== expectedValue) correctionPathValid = false;
    });

    function showError(message) {
        feedback.textContent = message;
        feedback.className = 'warmup-feedback error';
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
        input.focus();
    }

    function openSecondStage() {
        stage = 2;
        correctionStep = 0;
        correctionPathValid = true;
        stageLabel.textContent = '暖身第 2 關';
        title.textContent = '把錯字 Abw 修正成 Abu';
        instruction.innerHTML = '輸入框裡故意放了一個錯字 <strong>Abw</strong>。游標已在最後面，請按一次 <span id="warmup-backspace-hint"></span> 刪掉 <strong>w</strong>，再輸入 <strong>u</strong>。';
        renderBackspaceKeyHint(document.getElementById('warmup-backspace-hint'));
        progress1.classList.remove('current');
        progress1.classList.add('done');
        progress2.classList.add('current');
        input.value = 'Abw';
        input.placeholder = '';
        button.innerHTML = '<i class="fa-solid fa-check mr-2"></i>檢查第 2 關';
        feedback.textContent = '第 1 關完成。現在不要整個清空：用 Backspace 把 Abw 改成 Abu。';
        feedback.className = 'warmup-feedback';
        setActiveKeyboardTarget('Abu');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }

    function restartSecondStage(message) {
        correctionStep = 0;
        correctionPathValid = true;
        input.value = 'Abw';
        showError(message);
        input.setSelectionRange(input.value.length, input.value.length);
    }

    button.addEventListener('click', () => {
        if (stage === 1 && input.value.trim() === 'mia') {
            openSecondStage();
            return;
        }

        if (stage === 1) {
            showError(input.value.trim().toLowerCase() === 'mia'
                ? '第 1 關要三個小寫字母。請檢查 Caps Lock 是否關閉。'
                : '請對照 mia 的三個字母與順序，再修正一次。');
            return;
        }

        if (input.value === 'Abu' && correctionPathValid && correctionStep === 2) {
            feedback.textContent = '兩關暖身完成：你先輸入了 mia，也用 Backspace 把 Abw 修正成 Abu。接著看著步驟練習 Mia，再用新姓名 Leo 正式過關。';
            feedback.className = 'warmup-feedback success';
            progress2.classList.remove('current');
            progress2.classList.add('done');
            input.readOnly = true;
            button.disabled = true;
            return;
        }

        if (!correctionPathValid || input.value === 'Abu') {
            restartSecondStage('這一關要保留 Ab，只刪掉最後的 w。已幫你放回 Abw，請按一次 Backspace，再輸入 u。');
            return;
        }

        showError('請保留前面的 Ab，按 Backspace 刪掉最後的 w，再輸入 u，讓答案變成 Abu。');
    });
}

function setupCapsPractice() {
    const input = document.getElementById('caps-practice-input');
    const button = document.getElementById('caps-practice-check');
    const feedback = document.getElementById('caps-practice-feedback');
    const jumpButton = document.getElementById('mia-input-jump');
    if (!input || !button || !feedback || !jumpButton) return;

    let completed = false;
    connectInputToKeyboardGuide(input, 'Mia');

    function setFeedback(message, state = '') {
        feedback.textContent = message;
        feedback.className = `caps-practice-feedback${state ? ` ${state}` : ''}`;
    }

    function resetPractice() {
        completed = false;
        input.readOnly = false;
        input.value = '';
        input.classList.remove('practice-correct');
        jumpButton.classList.add('hidden');
        button.innerHTML = '<i class="fa-solid fa-check mr-2"></i>檢查 Mia';
        setFeedback('再看一次四步驟，慢慢輸入 Mia。');
        input.focus();
    }

    button.addEventListener('click', () => {
        if (completed) {
            resetPractice();
            return;
        }

        const value = input.value.trim();
        if (value === 'Mia') {
            completed = true;
            input.readOnly = true;
            input.classList.remove('shake');
            input.classList.add('practice-correct');
            jumpButton.classList.remove('hidden');
            button.innerHTML = '<i class="fa-solid fa-rotate-right mr-2"></i>再練習一次';
            setFeedback('成功！你完成了「開大寫、打一字、關大寫、接著打小寫」。下一關請把方法換到 Leo。', 'success');
            return;
        }

        if (!value) {
            setFeedback('先點白色輸入框，看到閃爍的小直線，再輸入 Mia。', 'error');
        } else if (value === 'mia') {
            setFeedback('第一個字母還是小寫。先按 Caps Lock，再輸入 M。', 'error');
        } else if (value === 'MIA') {
            setFeedback('M 已經大寫，但 ia 也變成大寫了。輸入 M 後要再按一次 Caps Lock 關閉大寫。', 'error');
        } else if (value.toLowerCase() === 'mia') {
            setFeedback('請檢查大小寫：只有第一個 M 大寫，後面的 ia 要小寫。', 'error');
        } else {
            setFeedback('請逐字對照 Mia 的三個字母與順序，再試一次。', 'error');
        }
        input.classList.remove('practice-correct');
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
        input.focus();
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !button.disabled) button.click();
    });
}

function refreshIdentityLock() {
    const ready = classCardAuth.hasIdentity();
    document.body.classList.toggle('class-card-ready', ready);
    document.body.classList.toggle('class-card-not-ready', !ready);

    const typingContainer = document.getElementById('typing-levels-container');
    typingContainer?.toggleAttribute('inert', !ready);
    if (!ready) {
        typingContainer?.querySelectorAll('input, button').forEach(control => {
            control.disabled = true;
        });
    }

    const warmupInput = document.getElementById('warmup-input');
    const warmupButton = document.getElementById('warmup-check');
    if (warmupInput && !warmupInput.readOnly) warmupInput.disabled = !ready;
    if (warmupButton && !warmupInput?.readOnly) warmupButton.disabled = !ready;
    if (ready && document.getElementById('warmup-feedback')?.textContent.includes('先輸入課堂身分卡')) {
        document.getElementById('warmup-feedback').textContent = '第 1 關：先照著輸入三個小寫字母 mia。';
    }

    const capsPracticeInput = document.getElementById('caps-practice-input');
    const capsPracticeButton = document.getElementById('caps-practice-check');
    const capsPracticeFeedback = document.getElementById('caps-practice-feedback');
    if (capsPracticeInput && !capsPracticeInput.readOnly) capsPracticeInput.disabled = !ready;
    if (capsPracticeButton) capsPracticeButton.disabled = !ready;
    if (!ready && capsPracticeFeedback) {
        capsPracticeFeedback.textContent = '先在右上角輸入課堂身分卡，再使用這個練習框。';
    } else if (ready && capsPracticeFeedback?.textContent.includes('先在右上角')) {
        capsPracticeFeedback.textContent = '可以一邊看四步驟，一邊輸入；完成後再換一個姓名正式過關。';
    }
}

function setupProgressNotices() {
    const firstInput = document.getElementById('input-level1');
    const secondInput = document.getElementById('input-level2');
    const status = document.getElementById('progress-status');
    const unlockNotice = document.getElementById('treasure-unlocked');
    const completeNotice = document.getElementById('mainline-complete');
    const secondBlock = document.getElementById('block-level2');
    const thirdBlock = document.getElementById('block-level3');
    if (!firstInput || !secondInput || !status || !unlockNotice || !completeNotice || !secondBlock || !thirdBlock) return;

    const sync = () => {
        const hasPassedFirstLevel = firstInput.readOnly
            || !secondBlock.classList.contains('hidden')
            || status.textContent.includes('六關已完成')
            || status.textContent.includes('六關完成');
        const hasPassedSecondLevel = secondInput.readOnly
            || !thirdBlock.classList.contains('hidden')
            || status.textContent.includes('六關已完成')
            || status.textContent.includes('六關完成');
        unlockNotice.classList.toggle('hidden', !hasPassedFirstLevel || hasPassedSecondLevel);
        completeNotice.classList.toggle('hidden', !hasPassedSecondLevel);
    };

    new MutationObserver(sync).observe(firstInput, { attributes: true, attributeFilter: ['readonly', 'class'] });
    new MutationObserver(sync).observe(secondInput, { attributes: true, attributeFilter: ['readonly', 'class'] });
    new MutationObserver(sync).observe(status, { childList: true, subtree: true, characterData: true });
    new MutationObserver(sync).observe(secondBlock, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(sync).observe(thirdBlock, { attributes: true, attributeFilter: ['class'] });
    sync();
}

function setupMiaInputJump() {
    const jumpButton = document.getElementById('mia-input-jump');
    const levelBlock = document.getElementById('block-level1');
    const levelInput = document.getElementById('input-level1');
    if (!jumpButton || !levelBlock || !levelInput) return;

    jumpButton.addEventListener('click', () => {
        levelBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!levelInput.disabled && !levelInput.readOnly) {
            levelInput.focus({ preventScroll: true });
        }
    });
}

setupWarmup();
setupCapsPractice();
renderTreasureAssignment();
refreshIdentityLock();
setupProgressNotices();
setupMiaInputJump();
setupLevelPracticeActions();
window.addEventListener('class-card:identity-changed', () => window.location.reload());
document.getElementById('boot-status').hidden = true;
