import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initGoogleCourseAuth, createGoogleCourseProgress } from '../../shared/grade3-google-course.js?v=20261007-identity';
import { initTypingChallenge } from '../../shared/typing-challenge.js?v=20261006';
import { initTypingTools, renderEnglishKeyboardGuide, renderZhuyinKeyboardGuide } from '../../shared/typing-tools.js?v=20261019-zhuyin-2';

// Verified: 康軒國語三上 L2 p.18–19; 翰林 Here We Go 1 U2 p.26,34.
const levelsData = [
    { id: 1, ans: '窗戶' },
    { id: 2, ans: 'eight' },
    { id: 3, ans: '霧裡看花' },
    { id: 4, ans: 'How old are you?' },
    { id: 5, ans: '上課要專心一點，才能有收穫。' },
    { id: 6, ans: "How old are you?\nI'm eight years old." }
];
const replayAnswers = ['黑板', 'seven', '專心一點', "I'm ten.", '雖然他張大了眼睛看著黑板，可是怎麼也找不到答案。', "How old are you?\nI'm ten years old."];
const originalAnswers = levelsData.map(level => level.ans);
const originalSources = levelsData.map(level => document.getElementById(`source-level${level.id}`).textContent);
const originalHints = levelsData.map(level => document.querySelector(`#block-level${level.id} > p`).textContent);
const zhuyin = {
    '窗戶': 'ㄔㄨㄤ ㄏㄨˋ', '黑板': 'ㄏㄟ ㄅㄢˇ',
    '霧裡看花': 'ㄨˋ ㄌㄧˇ ㄎㄢˋ ㄏㄨㄚ', '專心一點': 'ㄓㄨㄢ ㄒㄧㄣ ㄧ ㄉㄧㄢˇ',
    '上課要專心一點，才能有收穫。': 'ㄕㄤˋ ㄎㄜˋ ㄧㄠˋ ㄓㄨㄢ ㄒㄧㄣ ㄧ ㄉㄧㄢˇ ㄘㄞˊ ㄋㄥˊ ㄧㄡˇ ㄕㄡ ㄏㄨㄛˋ',
    '雖然他張大了眼睛看著黑板，可是怎麼也找不到答案。': 'ㄙㄨㄟ ㄖㄢˊ ㄊㄚ ㄓㄤ ㄉㄚˋ ㄌㄜ˙ ㄧㄢˇ ㄐㄧㄥ ㄎㄢˋ ㄓㄜ˙ ㄏㄟ ㄅㄢˇ ㄎㄜˇ ㄕˋ ㄗㄣˇ ㄇㄜ˙ ㄧㄝˇ ㄓㄠˇ ㄅㄨˊ ㄉㄠˋ ㄉㄚˊ ㄢˋ'
};
let focusedLevel = 1;
function refreshGuide() {
    const root = document.getElementById('floating-letter-key-guide');
    const text = levelsData[focusedLevel - 1].ans;
    if (focusedLevel % 2) renderZhuyinKeyboardGuide(root, { text, zhuyin: zhuyin[text] });
    else renderEnglishKeyboardGuide(root, { target: text });
}
initTypingTools({ keyboardGuide: true, getKeyboardTarget: () => levelsData[focusedLevel - 1].ans });
document.querySelector('[data-typing-tool-toggle="keyboard"]').addEventListener('click', refreshGuide);
document.querySelectorAll('[id^="input-level"]').forEach(input => input.addEventListener('focus', () => {
    focusedLevel = Number(input.id.replace('input-level', ''));
    refreshGuide();
}));

function describeMismatch(answer, value, level) {
    if (level % 2 && /[A-Za-z]/.test(value)) return '出現英文字母了：先切到「中」，擦掉後再輸入注音。';
    if (!(level % 2) && /[\uFF01-\uFF5E\u3000]/.test(value)) return '這關用英文半形字元，請檢查英／中與標點寬度。';
    let index = 0;
    while (index < value.length && value[index] === answer[index]) index++;
    if (answer[index] === '\n') return '第一行已打完，請按 Enter 換到第二行。';
    if (index === answer.length && value.length > answer.length) return `多了 ${value.length - answer.length} 個字元，用 Backspace 擦掉多的部分。`;
    if (index === value.length && value.length < answer.length) return `前面都對，還少 ${answer.slice(index).replace(/\n/g, '').length} 個字元，接著輸入。`;
    const before = answer.slice(0, index).split('\n');
    const position = answer.includes('\n') ? `第 ${before.length} 行第 ${before.at(-1).length + 1} 個字元` : `第 ${index + 1} 個字元`;
    return `從${position}附近再檢查一次，留意${level % 2 ? '選字與中文全形標點' : '大小寫、空白與英文半形標點'}。`;
}

initNavbarAuth();
const container = document.getElementById('typing-levels-container');
const auth = await initGoogleCourseAuth({ courseId: 'grade3-115-1' }).catch(() => {
    const message = '網站身分暫時無法確認，請告訴老師；票選與登入說明仍可閱讀。';
    document.getElementById('course-identity-status').textContent = message;
    return { hasIdentity: () => false, getIdentity: () => null, getIdentityError: () => message };
});
const store = createGoogleCourseProgress({ courseId: 'grade3-115-1', weekCode: '09', activityKey: 'typing_task_6', total: 6, getIdentity: auth.getIdentity });
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
// The shared adapter remains the only cloud writer. Replays of saved levels are read-only practice.
const progressAdapter = {
    async load() {
        if (!auth.hasIdentity()) return null;
        const progress = await store.load();
        if (!auth.hasIdentity()) return null;
        savedScore = progress?.completed ? 6 : Math.max(0, Number(progress?.score ?? Number(progress?.current_level || 1) - 1));
        container.inert = false;
        container.querySelectorAll('input,textarea,button[onclick]').forEach(el => { el.disabled = false; });
        setTimeout(syncControls, 0);
        return progress;
    },
    async save(value) {
        if (!auth.hasIdentity() || container.inert) return false;
        const score = value.completed ? 6 : Number(value.current_level) - 1;
        if (score <= savedScore) return true;
        const saved = await store.save(value);
        if (saved) { savedScore = score; setTimeout(syncControls, 0); }
        return saved;
    }
};
container.querySelectorAll('input,textarea,button').forEach(el => { el.disabled = true; });
initTypingChallenge({ courseId: 'grade3-115-1', weekCode: '09', activityKey: 'typing_task_6', levelsData, progressAdapter, autoScrollNext: false,
    levelEncouragements: {
        1: '你看清楚「窗戶」，把注音和字都檢查過了。',
        2: '你切回英文，一個字母一個字母完成數字單字。',
        3: '你願意停下來選字，讓四字詞語更完整。',
        4: '你留意句首、空格和標點，句子就清楚了。',
        5: '你耐心打完課文，還仔細檢查了中文標點。',
        6: '你把問答分成兩行，也檢查了縮寫、空格和標點；這些方法下次也用得上。'
    },
    progressMessages: {
        guestReady: auth.hasIdentity() ? '本人身分已確認，正在接回第 09 週進度。' : auth.getIdentityError() || '請先登入學校 Google 帳號，才能開始打字闖關並記錄進度。',
        guestNextLevel: level => `已記下你的成果，下次可以從第 ${level} 關繼續。`,
        loadError: '進度暫時讀取不到，請重新整理或告訴老師。'
    },
    getWrongAnswerHtml: ({ levelIndex, userVal }) => describeMismatch(levelsData[levelIndex - 1].ans, userVal, levelIndex),
    celebrationContent: {
        title: '課文練功，一步一步完成！',
        message: '你靠著檢查、修正與耐心完成六關。努力樹記下自己的學習：五片葉、一朵花。',
        buttonText: '看看我的努力樹', buttonHref: '/my-tree.html?course=grade3-115-1&returnTo=%2Fgrade3%2F115-1%2Fweek09.html'
    }
});
new MutationObserver(syncControls).observe(container, { subtree: true, attributes: true, attributeFilter: ['readonly', 'class', 'inert'] });
document.querySelectorAll('[data-replay]').forEach(button => button.addEventListener('click', () => {
    const id = Number(button.dataset.replay);
    const input = document.getElementById(`input-level${id}`);
    if (button.disabled || container.inert || !auth.hasIdentity() || savedScore < id) return;
    const alternate = levelsData[id - 1].ans === originalAnswers[id - 1];
    levelsData[id - 1].ans = alternate ? replayAnswers[id - 1] : originalAnswers[id - 1];
    document.getElementById(`target-level${id}`).textContent = levelsData[id - 1].ans;
    document.getElementById(`source-level${id}`).textContent = alternate
        ? id % 2 ? '康軒國語三上第二課〈妙故事點點名〉p.19' : '翰林 Here We Go 1 Unit 2 p.26'
        : originalSources[id - 1];
    document.querySelector(`#block-level${id} > p`).textContent = alternate ? '換一題同課內容，照新題目逐字輸入；成果已保存，不會重複增加。' : originalHints[id - 1];
    input.value = ''; input.readOnly = false;
    input.classList.remove('border-green-400', 'bg-green-50', 'text-green-800', 'shake', 'border-red-400', 'border-red-500', 'border-orange-300', 'border-pink-300', 'border-cyan-300', 'border-emerald-300', 'border-purple-400');
    const message = document.getElementById(`msg-level${id}`);
    message.className = 'level-message'; message.textContent = '換一題再練，使用剛才的方法慢慢檢查。';
    focusedLevel = id; refreshGuide(); input.focus(); syncControls();
}));
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
    if (container.inert || !auth.hasIdentity()) return;
    const input = document.getElementById(`input-level${button.dataset.next}`);
    if (!input?.disabled && !input.closest('.hidden')) { input.scrollIntoView({ block: 'center' }); input.focus({ preventScroll: true }); }
}));
