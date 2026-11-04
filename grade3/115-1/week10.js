import { initGoogleCourseAuth, createGoogleCourseProgress } from '../../shared/grade3-google-course.js?v=20261028-drafts';
import { initTypingChallenge } from '../../shared/typing-challenge.js?v=20261028-drafts';
import { initTypingTools } from '../../shared/typing-tools.js?v=20261028-keyboard';
import { WEEK10_LEVELS, describeWeek10Mismatch } from './week10-content.mjs?v=20261102-week10';

const levelsData = WEEK10_LEVELS.map(({ id, ans }) => ({ id, ans }));
const container = document.getElementById('typing-levels-container');
let focusedLevel = 1;
const tools = initTypingTools({ keyboardGuide: true, getKeyboardTarget: () => {
    const input = document.getElementById(`input-level${focusedLevel}`);
    const line = (input?.value.slice(0, input.selectionStart ?? 0).match(/\n/g) || []).length;
    const text = levelsData[focusedLevel - 1].ans.split('\n')[line] ?? '';
    return /[\u4e00-\u9fff]/.test(text) ? { lang: 'zh', text } : text;
} });
function refreshGuide() { tools?.refreshKeyboardGuide?.(); }
container.querySelectorAll('input,textarea').forEach(input => {
    for (const event of ['focus', 'input', 'click', 'keyup']) input.addEventListener(event, () => {
        focusedLevel = Number(input.id.replace('input-level', ''));
        refreshGuide();
    });
});

// initGoogleCourseAuth initializes the shared initNavbarAuth event controller once.
const auth = await initGoogleCourseAuth({ courseId: 'grade3-115-1' }).catch(() => {
    const message = '網站身分暫時無法確認，請告訴老師；也可依老師指示使用下方離線題卡。';
    document.getElementById('course-identity-status').textContent = message;
    return { hasIdentity: () => false, getIdentity: () => null, getIdentityError: () => message };
});
const store = createGoogleCourseProgress({ courseId: 'grade3-115-1', weekCode: '10', activityKey: 'typing_task_5', total: 5, getIdentity: auth.getIdentity });
let savedScore = 0;
function syncControls() {
    levelsData.forEach(({ id }) => {
        const input = document.getElementById(`input-level${id}`);
        const saved = auth.hasIdentity() && !container.inert && savedScore >= id;
        document.querySelector(`[data-replay="${id}"]`).disabled = !saved || !input.readOnly;
        const next = document.querySelector(`[data-next="${id + 1}"]`);
        if (next) { next.hidden = !saved; next.disabled = !saved; }
    });
}
const progressAdapter = {
    async load() {
        if (!auth.hasIdentity()) return null;
        const progress = await store.load();
        if (!auth.hasIdentity()) return null;
        savedScore = progress?.completed ? 5 : Math.max(0, Number(progress?.score ?? Number(progress?.current_level || 1) - 1));
        container.inert = false;
        container.querySelectorAll('input,textarea,button[onclick]').forEach(el => { el.disabled = false; });
        setTimeout(syncControls, 0);
        return progress;
    },
    async save(value) {
        if (!auth.hasIdentity() || container.inert) return false;
        const score = value.completed ? 5 : Number(value.current_level) - 1;
        if (score <= savedScore) return true; // Replaying a saved level never writes or regresses progress.
        const saved = await store.save(value);
        if (saved) { savedScore = score; setTimeout(syncControls, 0); }
        return saved;
    }
};
container.querySelectorAll('input,textarea,button').forEach(el => { el.disabled = true; });
initTypingChallenge({
    courseId: 'grade3-115-1', weekCode: '10', activityKey: 'typing_task_5', levelsData, progressAdapter,
    autoScrollNext: false,
    draftOptions: { enabled: true, getSession: () => auth.getDraftSession?.() },
    levelEncouragements: {
        1: '你把字和句號都檢查過了，短句也能練出細心。',
        2: '你留意大寫、空白和句點，英文句子更完整了。',
        3: '你把成對引號找齊，也耐心檢查了對話標點。',
        4: '你用換行整理問答，也檢查了縮寫與問號。',
        5: '你靠著逐行檢查、切換輸入法與修正完成魔王關，這些方法下次也用得上。'
    },
    progressMessages: {
        guestReady: auth.hasIdentity() ? '本人身分已確認，正在接回第 10 週進度。' : auth.getIdentityError() || '請先登入學校 Google 帳號，才能開始打字闖關並記錄進度。',
        guestNextLevel: level => `已記下你的成果，下次可以從第 ${level} 關繼續。`,
        loadError: '進度暫時讀取不到，請告訴老師；依指示改做下方離線練習。'
    },
    getWrongAnswerHtml: ({ levelIndex, userVal }) => describeWeek10Mismatch(levelsData[levelIndex - 1].ans, userVal),
    celebrationContent: {
        title: '標點魔王關，靠方法完成！',
        message: '你用檢查、修正與耐心完成五關。努力樹記下自己的學習：四片葉、一朵花。',
        buttonText: '看看我的努力樹',
        buttonHref: '/my-tree.html?course=grade3-115-1&returnTo=%2Fgrade3%2F115-1%2Fweek10.html'
    }
});
new MutationObserver(syncControls).observe(container, { subtree: true, attributes: true, attributeFilter: ['readonly', 'class', 'inert'] });

document.querySelectorAll('[data-replay]').forEach(button => button.addEventListener('click', () => {
    const id = Number(button.dataset.replay);
    const input = document.getElementById(`input-level${id}`);
    if (button.disabled || container.inert || !auth.hasIdentity() || savedScore < id) return;
    const original = WEEK10_LEVELS[id - 1];
    const alternate = levelsData[id - 1].ans === original.ans;
    levelsData[id - 1].ans = alternate ? original.replay : original.ans;
    document.getElementById(`target-level${id}`).textContent = levelsData[id - 1].ans;
    document.getElementById(`source-level${id}`).textContent = alternate ? original.replaySource : original.source;
    document.querySelector(`#block-level${id} > p`).textContent = alternate
        ? '換一題同課內容，照新題目逐字輸入；成果已保存，不會重複增加。' : original.hint;
    input.value = ''; input.readOnly = false;
    input.className = '';
    const message = document.getElementById(`msg-level${id}`);
    message.className = 'level-message'; message.textContent = '換一題再練，使用剛才的方法慢慢檢查。';
    focusedLevel = id; refreshGuide(); input.focus(); syncControls();
}));
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled || container.inert || !auth.hasIdentity()) return;
    const input = document.getElementById(`input-level${button.dataset.next}`);
    if (!input?.disabled && !input.closest('.hidden')) { input.scrollIntoView({ block: 'center' }); input.focus({ preventScroll: true }); }
}));
