// UI bridge only: validation/persistence/reset remain in initTypingChallenge.
export function connectTypingUI({ total, onComplete = () => {}, isReady = () => true }) {
    let current = 1, checking = false, awaitingNext = false, progressReady = false;
    const container = document.getElementById('typing-levels-container');
    container.inert = true;
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'secondary hidden'; retry.textContent = '重新讀取進度';
    retry.addEventListener('click', () => window.location.reload());
    container.before(retry);
    const show = (id) => {
        current = id;
        container.querySelectorAll('.stage').forEach((stage) => stage.classList.toggle('current', stage.id === `block-level${id}`));
        // Never focus the input: choosing the field is the lesson.
    };
    const sync = () => {
        const status = document.getElementById('progress-status').cloneNode(true);
        status.querySelectorAll('rt').forEach(rt => rt.remove());
        const message = status.textContent;
        if (message === typingMessages.unauthenticated || message === typingMessages.loadError) progressReady = false;
        else if (message === typingMessages.firstLogin || message === typingMessages.completed || message === typingMessages.saveCompleted || message.includes('不用登入 Google') || message.includes('課堂身分卡') || message.startsWith('第 ') || message.startsWith('接回進度：') || message.startsWith('進度已保存。')) progressReady = true;
        const canInteract = progressReady && isReady();
        container.inert = !canInteract;
        if (!canInteract) {
            container.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
        }
        retry.classList.toggle('hidden', message !== typingMessages.loadError);
        onComplete(canInteract && document.getElementById(`input-level${total}`)?.readOnly === true && !checking);
        if (checking || awaitingNext) return;
        const unlocked = [...container.querySelectorAll('.stage:not(.hidden)')];
        const active = unlocked.find(stage => !stage.querySelector('[id^="input-level"]').readOnly);
        if (active) show(Number(active.dataset.level));
        else if (unlocked.length) show(total);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById('progress-status'), { childList: true, subtree: true, characterData: true });
    const original = window.checkLevel;
    window.checkLevel = async (id) => {
        if (checking || !progressReady || !isReady() || id !== current) return;
        const input = document.getElementById(`input-level${id}`);
        if (input.disabled) return;
        if (!input.readOnly && !/^[0-9]+(?:\n[0-9]+)*$/.test(input.value)) {
            document.getElementById(`msg-level${id}`).textContent = input.value ? '請只輸入數字。用 Backspace 修正空格或其他文字，再試一次。' : '先點框，找到小直線，再輸入上面的數字。';
            return;
        }
        checking = true;
        const button = document.getElementById(`check-${id}`); button.disabled = true;
        try {
            await original(id);
            const input = document.getElementById(`input-level${id}`);
            if (input.readOnly && id < total) {
                awaitingNext = true;
                document.getElementById(`next-${id}`).classList.remove('hidden');
            }
        } finally {
            checking = false;
            button.disabled = document.getElementById(`input-level${id}`).disabled;
            sync();
        }
    };
    container.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
        awaitingNext = false; show(Number(button.dataset.next));
    }));
    show(1);
    sync();
}

export function digitHint(value, target) {
    if (!/^[0-9\n]*$/.test(value)) return '出現了其他文字。先用 Backspace 修正，再確認數字鍵與 Num Lock。';
    if (value.length < target.length) return '少了數字。對照上面的代碼，把缺少的數字補回來。';
    if (value.length > target.length) return '多了數字。用 Backspace 刪掉多的數字，再檢查。';
    const index = [...target].findIndex((char, i) => char !== value[i]);
    return `第 ${index + 1} 個位置不一樣。對照代碼，修好再試。`;
}

export const typingMessages = {
    unauthenticated: '請先登入 Google，才能開始打字闖關並記錄進度。',
    firstLogin: '已登入，先找到框，按一下左鍵。',
    resumed: level => `接回進度：從第 ${level} 關繼續。`,
    saveNextLevel: level => `進度已保存。準備好後，按下一關前往第 ${level} 關。`,
    saveCompleted: '全部完成，進度已保存。',
    completed: '已完成這組練習，進度已接回。',
    saveError: '進度尚未存好，請再按一次檢查。',
    loadError: '進度讀取失敗，請重新讀取後再開始，避免蓋掉先前的練習。',
    resetConfirm: '要重新開始這組數字練習嗎？',
    resetNoSession: '請先登入，再重新練習。'
};

export function randomDigits(length = 3) {
    return [...crypto.getRandomValues(new Uint32Array(length))].map(n => n % 10).join('');
}
