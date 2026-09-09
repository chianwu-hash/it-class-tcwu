export function initWindowPractice({ store, onComplete, requireAuth = true, loadGuestProgress = null, saveGuestProgress = null }) {
    const $ = id => document.getElementById(id);
    const actions = ['maximize', 'restore', 'minimize', 'find', 'close'];
    const instructions = [
        '畫面太小，把視窗變大！',
        '讓視窗回到剛才的大小！',
        '等一下還要用，先把視窗收起來！',
        '從工作列，把剛才的視窗找回來！',
        '已經用完了，結束這個視窗！'
    ];
    const stateBefore = ['normal', 'maximized', 'normal', 'minimized', 'normal', 'normal'];
    let step = 0, state = 'normal', user = null, ready = false, busy = false, epoch = 0, pending = false;

    function draw() {
        $('practice-window').classList.toggle('hidden', ['minimized', 'closed'].includes(state));
        $('practice-window').classList.toggle('maximized', state === 'maximized');
        $('win-size').textContent = state === 'maximized' ? '❐' : '□';
        $('win-size').setAttribute('title', state === 'maximized' ? '還原大小' : '最大化');
        $('win-size').setAttribute('aria-label', state === 'maximized' ? '還原大小' : '最大化');
        $('win-taskbar').classList.toggle('hidden', state === 'closed');
        $('win-reopen').classList.toggle('hidden', state !== 'closed' || step >= actions.length);
        ['win-min', 'win-size', 'win-close', 'win-taskbar', 'win-reopen'].forEach(id => $(id).disabled = !ready || busy || pending || step >= actions.length);
    }

    function prompt() {
        $('window-instruction').textContent = step < actions.length ? (step + 1) + ' / ' + actions.length + '　' + instructions[step] : '五步完成！接著跟老師操作真正的檔案總管。';
        draw();
    }

    async function act(action) {
        if ((requireAuth && !user) || !ready || busy || pending || step >= actions.length) return;
        const expected = actions[step];
        const prior = state;
        state = ({ maximize: 'maximized', restore: 'normal', minimize: 'minimized', find: 'normal', close: 'closed', reopen: 'normal' })[action];
        if (action !== expected) {
            $('window-feedback').textContent = action === 'close' ? '提早關掉了。按重新開啟，再照這一步試一次。' : '先看任務說什麼，再選對的視窗按鈕。';
            if (action === 'reopen') state = stateBefore[step] === 'minimized' ? 'minimized' : 'normal';
            if (expected === 'maximize') state = 'normal';
            if (expected === 'restore') state = 'maximized';
            draw();
            return;
        }
        busy = true;
        draw();
        const version = epoch;
        try {
            if (user && await store.save(step + 1) === false) throw new Error('save');
            if (!user && !requireAuth && typeof saveGuestProgress === 'function') {
                const saved = await saveGuestProgress(step + 1);
                if (saved === false) throw new Error('save');
            }
            if (version !== epoch) return;
            step++;
            pending = true;
            $('window-feedback').textContent = action === 'minimize' ? '它還開著，只是先收在工作列。' : action === 'find' ? '你從工作列把同一個視窗找回來了。' : action === 'close' ? '這次是關閉，用完才關掉。' : (user ? '進度已保存。' : '做對了，準備下一步。');
            $('window-next').textContent = step === actions.length ? '完成視窗練習' : '下一個任務';
            $('window-next').classList.remove('hidden');
            onComplete(step === actions.length);
        } catch {
            if (version !== epoch) return;
            state = prior;
            $('window-feedback').textContent = '進度尚未存好，請再做一次剛才的操作。';
        } finally {
            if (version === epoch) {
                busy = false;
                draw();
            }
        }
    }

    $('win-min').onclick = () => act('minimize');
    $('win-size').onclick = () => act(state === 'maximized' ? 'restore' : 'maximize');
    $('win-close').onclick = () => act('close');
    $('win-taskbar').onclick = () => act('find');
    $('win-reopen').onclick = () => act('reopen');
    $('window-next').onclick = () => {
        pending = false;
        $('window-next').classList.add('hidden');
        state = stateBefore[step] || 'closed';
        prompt();
    };

    async function handleSession(session) {
        const version = ++epoch;
        user = session?.user || null;
        const canPractice = !requireAuth || !!user;
        ready = false;
        busy = false;
        pending = false;
        step = 0;
        state = 'normal';
        $('window-lock').classList.toggle('hidden', canPractice);
        $('window-content').classList.toggle('hidden', !canPractice);
        $('window-next').classList.add('hidden');
        $('window-feedback').textContent = '';
        onComplete(false);
        draw();
        if (!canPractice) return;
        try {
            const progress = user ? await store.load() : (typeof loadGuestProgress === 'function' ? await loadGuestProgress() : null);
            if (version !== epoch) return;
            step = progress?.completed ? actions.length : Math.max(0, Math.min(actions.length, Number(progress?.score) || 0));
            state = stateBefore[step] || 'closed';
            ready = true;
            onComplete(step === actions.length);
            prompt();
        } catch {
            if (version !== epoch) return;
            $('window-instruction').textContent = '進度讀取失敗。';
            const retry = document.createElement('button');
            retry.textContent = '重新讀取進度';
            retry.onclick = () => handleSession(session);
            $('window-feedback').replaceChildren(retry);
        }
    }

    return { handleSession };
}
