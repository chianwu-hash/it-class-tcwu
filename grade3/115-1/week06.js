import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initGoogleCourseAuth, createGoogleCourseProgress } from '../../shared/grade3-google-course.js?v=20261007-identity';
import { initTypingChallenge } from '../../shared/typing-challenge.js?v=20261006';
import { initTypingTools } from '../../shared/typing-tools.js?v=20260924-1';

const levelsData = [
    { id: 1, ans: 'robot358' }, { id: 2, ans: 'l1o0' }, { id: 3, ans: 'Robot358!' },
    { id: 4, ans: 'Hi, I am Tom.' }, { id: 5, ans: "Hi, I am Tom.\nWhat's your name?" }
];
initNavbarAuth();
const auth = await initGoogleCourseAuth({ courseId: 'grade3-115-1' });
const store = createGoogleCourseProgress({ courseId: 'grade3-115-1', weekCode: '06',
    activityKey: 'typing_task_5', total: 5, getIdentity: auth.getIdentity });
const container = document.getElementById('typing-levels-container');
container.inert = !auth.hasIdentity();
container.querySelectorAll('input,textarea,button').forEach(el => { el.disabled = !auth.hasIdentity(); });
let keyboardTarget = levelsData[0].ans;
const tools = initTypingTools({ keyboardGuide: true, getKeyboardTarget: () => keyboardTarget });
document.querySelectorAll('[id^="input-level"]').forEach((input, index) => {
    input.addEventListener('focus', () => { keyboardTarget = levelsData[index].ans; tools?.refreshKeyboardGuide?.(); });
});
initTypingChallenge({ courseId: 'grade3-115-1', weekCode: '06', activityKey: 'typing_task_5', levelsData,
    // The UI is gated by the verified roster/import controller; the adapter calls
    // authenticated, student-safe RPCs, never the classroom guest RPCs.
    progressAdapter: store,
    levelEncouragements: {
        1: '你看清楚字母與數字，逐字完成了。', 2: '你分辨相似的字，檢查後再送出。',
        3: '你記得按住 Shift，也仔細檢查符號。', 4: '你留意空格與句點，把句子打完整。',
        5: '你耐心完成兩行文字，也檢查了換行與問號。'
    },
    progressMessages: { guestReady: auth.hasIdentity() ? '已接回本人身分，先看努力樹，再來挑戰。' : auth.getIdentityError() || '請先登入學校 Google 帳號並接回舊成果，才可以闖關。',
        loadError: '進度暫時讀取不到，請重新整理或告訴老師。' },
    getWrongAnswerHtml: ({ levelIndex: level, userVal: value }) => {
        const answer = levelsData.find(item => item.id === level)?.ans || '';
        let index = 0;
        while (index < value.length && index < answer.length && value[index] === answer[index]) index++;
        const prefix = answer.slice(0, index).split('\n');
        return `看看第 ${prefix.length} 行、第 ${prefix.at(-1).length + 1} 個字附近：檢查大小寫、空格、標點或換行；打錯用 Backspace 修正。`;
    },
    celebrationContent: { title: '一步一步，把五關走完了', message: '你仔細檢查並修正，努力樹也會記住今天的成果：四片葉、一朵花。',
        buttonText: '看看我的努力樹', buttonHref: '/my-tree.html?course=grade3-115-1&returnTo=%2Fgrade3%2F115-1%2Fweek06.html' }
});
document.querySelectorAll('[data-replay]').forEach(button => {
    button.addEventListener('click', () => {
        if (!auth.hasIdentity()) return;
        const input = document.getElementById(`input-level${button.dataset.replay}`);
        input.readOnly = false; input.value = ''; input.focus();
        document.getElementById(`msg-level${button.dataset.replay}`).textContent = '再練一次，成果不會重複增加。';
    });
});
