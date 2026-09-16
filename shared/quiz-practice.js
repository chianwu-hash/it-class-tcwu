// Optional, sequential mastery practice. The default scored quiz stays unchanged.
export function initQuizPractice({ questions, selectors, messages = {}, loadProgress, saveProgress, loadGuestProgress = null, saveGuestProgress = null, getCurrentUser, onAfterSubmit, requireAuth = true, optionLabelMode = 'stored' }) {
    const el = (key) => typeof selectors[key] === 'string' ? document.getElementById(selectors[key]) : selectors[key];
    let userId = null, count = 0, busy = false, ready = false, generation = 0;
    const container = el('container');
    const say = (text) => { const target = container.querySelector('[role="status"]'); if (target) target.textContent = text; };
    function render() {
        container.replaceChildren();
        if (!ready) return;
        if (count >= questions.length) {
            container.innerHTML = '<p role="status"></p>';
            say(messages.complete || '五題完成！眼睛離開螢幕，看看遠處，再調整坐姿。');
            return;
        }
        const question = questions[count];
        const questionRow = document.createElement('div');
        questionRow.className = 'quiz-question-row';
        const readingScope = document.createElement('div');
        readingScope.className = 'quiz-reading-scope';
        const title = document.createElement('h3');
        title.innerHTML = `${count + 1} / ${questions.length}　${question.questionHtml}`;
        readingScope.append(title);
        const options = document.createElement('div'); options.className = 'practice-options';
        question.options.forEach((option, optionIndex) => {
            const button = document.createElement('button'); button.type = 'button'; button.innerHTML = option.text;
            if (optionLabelMode === 'display-order') {
                const label = document.createElement('span');
                label.className = 'practice-option-label';
                label.textContent = ['A', 'B', 'C', 'D', 'E', 'F'][optionIndex] || String(optionIndex + 1);
                label.setAttribute('aria-hidden', 'true');
                const text = document.createElement('span');
                text.className = 'practice-option-text';
                text.innerHTML = option.text;
                button.replaceChildren(label, text);
                button.setAttribute('aria-label', `${label.textContent}，${text.textContent}`);
            }
            button.addEventListener('click', () => choose(option)); options.append(button);
        });
        readingScope.append(options);
        questionRow.append(readingScope);
        container.append(questionRow);
        document.dispatchEvent(new CustomEvent('quiz-practice:rendered', { detail: { container } }));
        const status = document.createElement('p'); status.setAttribute('role', 'status'); container.append(status);
    }
    async function choose(option) {
        if (busy || !ready || (requireAuth && !userId)) return;
        const epoch = generation;
        if (count >= questions.length) return;
        if (!option.correct) { say(questions[count].hint || '再看看題目，想一想再選。'); return; }
        busy = true;
        container.querySelectorAll('button').forEach(b => b.disabled = true);
        try {
            const user = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
            if (requireAuth && !user) throw new Error('save');
            if (user && await saveProgress(count + 1) === false) throw new Error('save');
            if (!user && !requireAuth && typeof saveGuestProgress === 'function') {
                const saved = await saveGuestProgress(count + 1);
                if (saved === false) throw new Error('save');
            }
            if (epoch !== generation) return;
            const feedback = questions[count].feedback;
            count += 1;
            say(feedback || '你有仔細觀察。');
            const next = document.createElement('button'); next.type = 'button';
            next.textContent = count === questions.length ? '完成，調整坐姿' : '下一題';
            next.addEventListener('click', () => { render(); });
            container.append(next);
            await onAfterSubmit?.({ correct: count, total: questions.length });
        } catch {
            if (epoch !== generation) return;
            say(messages.saveError || '進度尚未存好，請再按一次剛才的答案。');
            container.querySelectorAll('button').forEach(b => b.disabled = false);
        } finally { if (epoch === generation) busy = false; }
    }
    async function handleAuthChange(session) {
        const id = session?.user?.id || null;
        if (id === userId && ready) return;
        const epoch = ++generation; userId = id; ready = false; busy = false; count = 0;
        const canPractice = !requireAuth || !!id;
        el('lock')?.classList.toggle('hidden', canPractice);
        el('content')?.classList.toggle('hidden', !canPractice);
        container.replaceChildren();
        if (!canPractice) return;
        try {
            const progress = id ? await loadProgress?.() : (typeof loadGuestProgress === 'function' ? await loadGuestProgress() : null);
            if (epoch !== generation) return;
            count = progress?.completed ? questions.length : Math.max(0, Math.min(questions.length, Number(progress?.score) || 0));
            ready = true; render();
            await onAfterSubmit?.({ correct: count, total: questions.length });
        } catch {
            if (epoch !== generation) return;
            const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '進度讀取失敗，按這裡重試';
            retry.addEventListener('click', () => handleAuthChange(session)); container.append(retry);
        }
    }
    return { handleAuthChange, render };
}
