import { initTypingChallenge } from '../../shared/typing-challenge.js?v=20261120-identity';
import { initTypingTools } from '../../shared/typing-tools.js?v=20261119-zhuyin';
import { renderTypingErrorLocator, trackTypingComposition } from '../../shared/typing-error-locator.mjs?v=20261113-locator';
import { challenges, courseId, weekCode } from './week12-typing-content.mjs?v=20261120';

const challenge = challenges[document.body.dataset.challenge || 'regular'];
const root = document.getElementById('typing-levels-container');
const status = document.getElementById('progress-status');
const complete = challenge.boss
    ? '第 12 週魔王已完成，獲得一朵花。'
    : '第 12 週六關已完成，合計一葉一花。';
const saved = challenge.boss
    ? '第 12 週魔王完成紀錄已儲存，獲得一朵花。'
    : '第 12 週六關完成紀錄已儲存，合計一葉一花。';

let active;
const tools = initTypingTools({
    keyboardGuide: true,
    getKeyboardTarget() {
        if (!active) return challenge.levels[0].main.lines[0];
        const { input, question } = active;
        const line = input.value.slice(0, input.selectionStart).split('\n').length - 1;
        return question().lines[line] ?? '';
    }
});

function trackGuide(input, question) {
    for (const event of ['focus', 'input', 'click', 'keyup', 'select']) {
        input.addEventListener(event, () => {
            active = { input, question };
            tools.refreshKeyboardGuide();
        });
    }
}

const controls = challenge.levels.map(({ id, title, main, replays }, index) => {
    const article = document.createElement('article');
    article.id = `block-level${id}`;
    article.className = index ? 'typing-level hidden' : 'typing-level';
    article.innerHTML = `
        <h3 class="typing-title"></h3>
        <p class="source formal-source"></p>
        <div class="typing-grid">
            <div><p class="typing-label">照著題目逐字輸入</p><pre class="typing-target select-none pointer-events-none"></pre></div>
            <div>
                <label class="typing-label" for="input-level${id}">我的輸入</label>
                <textarea id="input-level${id}" class="typing-input" rows="5" spellcheck="false" autocapitalize="off" autocomplete="off" onpaste="return false;" ondrop="return false;" disabled></textarea>
                <button id="check-${id}" type="button" class="typing-check" onclick="checkLevel(${id})" disabled>檢查答案</button>
                <div id="msg-level${id}" class="typing-message" role="status"></div>
            </div>
        </div>
        <div class="actions replay-actions" hidden>
            <button class="btn btn-secondary start-replay" type="button">再練習一次</button>
        </div>
        <section class="replay-area" hidden>
            <h4>換題練習</h4>
            <p class="source replay-source"></p>
            <pre class="typing-target select-none pointer-events-none"></pre>
            <label class="typing-label" for="replay-level${id}">我的練習</label>
            <textarea id="replay-level${id}" class="typing-input" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off" onpaste="return false;" ondrop="return false;"></textarea>
            <button class="typing-check replay-check" type="button">檢查練習</button>
            <div class="typing-message replay-message" role="status"></div>
        </section>`;
    article.querySelector('h3').textContent = challenge.boss ? title : `第 ${id} 關｜${title}`;
    article.querySelector('.formal-source').textContent = main.source;
    article.querySelector('.typing-target').textContent = main.ans;
    const input = article.querySelector('.typing-grid textarea');
    const actions = article.querySelector('.replay-actions');
    const replayButton = actions.querySelector('button');
    const area = article.querySelector('.replay-area');
    const practice = area.querySelector('textarea');
    const check = area.querySelector('.replay-check');
    const message = area.querySelector('.replay-message');
    const prompts = [...replays, main];
    let current = -1;
    const available = () => input.readOnly && !input.disabled && (
        id < challenge.levels.length
            ? !document.getElementById(`block-level${id + 1}`)?.classList.contains('hidden')
            : progress.isCompleted()
    );
    trackGuide(input, () => main);
    trackGuide(practice, () => prompts[current]);
    trackTypingComposition(practice);

    replayButton.addEventListener('click', () => {
        if (!available() || replayButton.disabled) return;
        current = (current + 1) % prompts.length;
        const question = prompts[current];
        area.querySelector('.replay-source').textContent = question.source;
        area.querySelector('.typing-target').textContent = question.ans;
        practice.value = '';
        practice.readOnly = false;
        check.disabled = false;
        replayButton.disabled = true;
        message.replaceChildren();
        area.hidden = false;
        practice.focus();
    });

    check.addEventListener('click', () => {
        if (!available() || current < 0 || practice.readOnly) return;
        const answer = prompts[current].ans;
        if (practice.value.split('\n').map(line => line.trim()).join('\n') !== answer) {
            renderTypingErrorLocator(message, practice, answer);
            return;
        }
        practice.readOnly = true;
        check.disabled = true;
        replayButton.disabled = false;
        message.textContent = '練習正確，已保存的進度和獎勵會保留。';
    });

    root.append(article);
    return () => {
        const ready = available();
        actions.hidden = !ready;
        if (!ready && !area.hidden) {
            area.hidden = true;
            current = -1;
            practice.value = '';
            message.replaceChildren();
            replayButton.disabled = false;
            if (active?.input === practice) {
                active = { input, question: () => main };
                tools.refreshKeyboardGuide();
            }
        }
    };
});

const refreshReplays = () => controls.forEach(sync => sync());
const observer = new MutationObserver(refreshReplays);
observer.observe(root, { attributes: true, subtree: true, attributeFilter: ['readonly', 'disabled', 'class'] });
observer.observe(status, { childList: true, characterData: true, subtree: true });

const encouragements = [
    '你把第一句的選字和標點都核對好了。',
    '你留意了英文的大小寫、空白和問號。',
    '你依照題目換行，也仔細選對了文言文的用字。',
    '你逐行檢查問答，把縮寫和時間打準了。',
    '你用局部修正完成前五關，已累積一片葉子。',
    '你依序完成中文與英文，保留一葉，再開一朵花。'
];

const progress = initTypingChallenge({
    courseId, weekCode, activityKey: challenge.key,
    levelsData: challenge.levels.map(({ id, main }) => ({ id, ans: main.ans })),
    draftOptions: { enabled: true },
    errorLocator: true,
    lockOnLoadError: true,
    levelEncouragements: Object.fromEntries(challenge.levels.map(({ id }) => [
        id, challenge.boss ? '你耐心逐行核對，完成了這篇長文。' : encouragements[id - 1]
    ])),
    progressMessages: {
        completed: complete,
        saveCompleted: saved,
        unauthenticated: '請先登入學校 Google 帳號，才能開始並儲存自己的進度。',
        loadError: '進度暫時讀取不到，闖關先暫停。已有輸入可先按「儲存草稿」，再重新整理重試。',
        resetConfirm: '要重設這個第 12 週活動嗎？這會清除此活動的進度、草稿與獎勵。'
    },
    celebrationContent: {
        title: challenge.boss ? '第 12 週魔王開花了！' : '第 12 週中英打六關完成！',
        message: saved,
        buttonText: '看看我的努力樹',
        buttonHref: '/my-tree.html?course=grade6-115-1'
    }
});
