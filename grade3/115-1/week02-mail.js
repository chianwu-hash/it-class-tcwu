import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initTypingChallenge } from '../../shared/typing-challenge.js';
import { connectTypingUI, digitHint, typingMessages, randomDigits } from './week02-typing-ui.js?v=20260909';

const UNLOCK_KEY = 'grade3-115-1:week02:local-practice:v1';
const MAIL_KEY = 'grade3-115-1:week02-mail:local-practice:v2';
let session = null, started = false, checking = false;
const $ = id => document.getElementById(id);
const animals = ['🐰 兔子', '🐻 小熊', '🐱 小貓', '🐶 小狗', '🐼 熊貓'];
const counts = [2, 3, 3, 3, 5];
const delivered = new Set();

function loadJson(key, fallback = null) {
    try {
        const raw = window.localStorage?.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function saveMailProgress(patch) {
    const current = loadJson(MAIL_KEY, {}) || {};
    try {
        window.localStorage?.setItem(MAIL_KEY, JSON.stringify({ ...current, ...patch }));
        return true;
    } catch {
        return false;
    }
}

function isSavedCodes(value) {
    return Array.isArray(value)
        && value.length === counts.length
        && value.every((items, levelIndex) => Array.isArray(items)
            && items.length === counts[levelIndex]
            && items.every(code => /^[0-9]{3,4}$/.test(String(code))));
}

function makeCodes() {
    const saved = loadJson(MAIL_KEY, {}) || {};
    if (isSavedCodes(saved.codes)) return saved.codes;
    const nextCodes = counts.map((count, index) => Array.from({ length: count }, () => randomDigits(index === 2 ? 4 : 3)));
    saveMailProgress({ codes: nextCodes });
    return nextCodes;
}

function makeWrongCode(code, level, index) {
    const chars = String(code).split('');
    const position = (level + index) % chars.length;
    const original = Number(chars[position]);
    chars[position] = String((original + level + index + 1) % 10);
    const wrong = chars.join('');
    return wrong === code ? `${code.slice(0, -1)}${(Number(code.at(-1)) + 1) % 10}` : wrong;
}

function loadMailProgress() {
    const progress = loadJson(MAIL_KEY, {}) || {};
    return { current_level: Number(progress.current_level) || 1, completed: Boolean(progress.completed) };
}

function hasWeek02Unlock() {
    const progress = loadJson(UNLOCK_KEY, {}) || {};
    return Boolean(progress.typingCompleted && progress.quizCompleted && progress.windowCompleted);
}

const codes = makeCodes();
const wrongCodes = codes.map((items, levelIndex) => items.map((code, itemIndex) => levelIndex >= 2 ? makeWrongCode(code, levelIndex + 1, itemIndex) : ''));
const levelsData = codes.map((items, index) => ({ id: index + 1, ans: items.join('\n') }));

function levelIntro(level) {
    if (level === 4) return '依序投遞：兔子 → 小熊 → 小貓。每填好一框，按它的投遞按鈕。';
    if (level >= 3) return '信箱已經有數字了，但有些數字放錯了。請把它修成正確代碼。';
    return '每個信箱都有自己的代碼。換框前，記得重新點一下。';
}

function inputLabel(level) {
    return level >= 3 ? '修正成這個信箱的代碼' : '輸入這個信箱的代碼';
}

function mailboxHint({ levelIndex, userVal, targetVal, hint }) {
    const userItems = String(userVal || '').split('\n');
    const targetItems = String(targetVal || '').split('\n');
    for (let index = 0; index < targetItems.length; index += 1) {
        const userCode = userItems[index] || '';
        const targetCode = targetItems[index] || '';
        if (userCode === targetCode) continue;
        const animalName = animals[index]?.replace(/^\S+\s*/, '') || `第 ${index + 1} 個`;
        if (!userCode) return `${animalName}信箱還沒有填好。`;
        if (userCode.length !== targetCode.length) return `${animalName}信箱的數字長度不一樣，請對照上方代碼。`;
        for (let digit = 0; digit < targetCode.length; digit += 1) {
            if (userCode[digit] !== targetCode[digit]) {
                return `${animalName}信箱的第 ${digit + 1} 個數字不一樣，請修成 ${targetCode[digit]}。`;
            }
        }
        return `${animalName}信箱還有數字需要修正。`;
    }
    if (userItems.length !== targetItems.length) return '信箱數量不一樣，請檢查是不是有漏填。';
    return hint || '對照每個信箱的代碼，修好再試。';
}

function start() {
    if (started) return;
    started = true;
    $('typing-levels-container').innerHTML = codes.map((items, index) => {
        const level = index + 1;
        const order = level === 3 ? [2, 0, 1] : items.map((_, i) => i);
        return `<div id="block-level${level}" class="stage ${level > 1 ? 'hidden' : 'current'}" data-level="${level}">
            <h2>第 ${level} 關 / 5</h2>
            <p class="mail-order" ${level === 4 ? 'id="delivery-instruction"' : ''}>${levelIntro(level)}</p>
            <div class="mail-grid">
                ${order.map(i => `<div class="mailbox ${level >= 3 ? 'needs-repair' : ''}" id="mailbox-${level}-${i}">
                    <div class="animal">${animals[i]}</div>
                    <span class="code">${items[i]}</span>
                    <label for="mail-${level}-${i}">${inputLabel(level)}</label>
                    <input id="mail-${level}-${i}" class="mail-answer" type="text" inputmode="numeric" autocomplete="off" data-level="${level}" data-index="${i}" value="${level >= 3 ? wrongCodes[index][i] : ''}">
                    ${level === 4 ? `<button type="button" data-deliver="${i}">投遞給${animals[i].slice(3)}</button>` : ''}
                </div>`).join('')}
            </div>
            <textarea id="input-level${level}" class="hidden" aria-hidden="true" tabindex="-1" disabled></textarea>
            <button id="check-${level}" onclick="checkLevel(${level})" disabled>檢查信箱</button>
            <button id="next-${level}" data-next="${level + 1}" class="secondary hidden">下一關 →</button>
            <p id="msg-level${level}" class="level-message" role="status"></p>
        </div>`;
    }).join('');

    function updateAnswer(level) {
        const vals = codes[level - 1].map((_, i) => $(`mail-${level}-${i}`).value);
        $(`input-level${level}`).value = vals.join('\n');
    }

    function restoreMailFields() {
        const progress = loadMailProgress();
        const completedThrough = progress.completed ? counts.length : Math.max(0, Math.min(counts.length, Number(progress.current_level) - 1 || 0));
        for (let level = 1; level <= counts.length; level += 1) {
            updateAnswer(level);
            if (level > completedThrough) continue;
            codes[level - 1].forEach((code, index) => {
                const input = $(`mail-${level}-${index}`);
                const mailbox = $(`mailbox-${level}-${index}`);
                if (!input) return;
                input.value = code;
                input.readOnly = true;
                mailbox?.classList.add('readonly');
            });
            updateAnswer(level);
        }
    }

    $('typing-levels-container').addEventListener('input', event => {
        if (!event.target.matches('.mail-answer')) return;
        const level = Number(event.target.dataset.level);
        if ($(`input-level${level}`).readOnly) return;
        if (level === 4 && delivered.has(Number(event.target.dataset.index))) {
            delivered.clear();
            document.querySelectorAll('.delivered').forEach(el => el.classList.remove('delivered'));
            $('delivery-instruction').textContent = '內容修改了。請依兔子、小熊、小貓的順序重新投遞。';
        }
        updateAnswer(level);
    });

    document.querySelectorAll('[data-deliver]').forEach(button => button.addEventListener('click', () => {
        const index = Number(button.dataset.deliver);
        if (index !== delivered.size) {
            $('delivery-instruction').textContent = '請依兔子、小熊、小貓的順序投遞。';
            return;
        }
        if ($(`mail-4-${index}`).value !== codes[3][index]) {
            $('delivery-instruction').textContent = '這個信箱的數字還不一樣，先修正再投遞。';
            return;
        }
        delivered.add(index);
        $(`mailbox-4-${index}`).classList.add('delivered');
        $('delivery-instruction').textContent = delivered.size === 3 ? '三個信箱已依序投遞，請按檢查信箱。' : `接著投遞給${animals[delivered.size].slice(3)}。`;
    }));

    initTypingChallenge({
        courseId: 'grade3-115-1',
        weekCode: '02',
        activityKey: 'typing_task_5',
        levelsData,
        levelEncouragements: {
            1: '你記得換框，把數字送到對的信箱。',
            2: '你對照每個信箱，仔細完成投遞。',
            3: '你會看出錯誤，並把數字修正好。',
            4: '你照順序完成，會先想下一步。',
            5: '你耐心檢查五個信箱，完成修理與投遞。'
        },
        buildHint: digitHint,
        getWrongAnswerHtml: mailboxHint,
        afterAuthUpdate: () => document.querySelectorAll('.mail-answer,[data-deliver]').forEach(el => el.disabled = false),
        requireAuth: false,
        guestProgress: { load: loadMailProgress, save: progress => saveMailProgress(progress) },
        progressMessages: {
            ...typingMessages,
            guestReady: '快手任務已開放，今天不用登入 Google。',
            guestNextLevel: level => `第 ${level - 1} 關完成，繼續投遞。`,
            guestCompleted: '投遞完成！請舉手讓老師看看。'
        },
        celebrationContent: { title: '投遞完成！', message: '你靠找框、檢查與修正完成練習。', buttonText: '回到本週課程', buttonHref: 'week02.html' }
    });

    restoreMailFields();
    connectTypingUI({ total: 5 });
    const check = window.checkLevel;
    window.checkLevel = async level => {
        if (level === 4 && delivered.size !== 3 && !$('input-level4').readOnly) {
            $('msg-level4').textContent = '先依兔子、小熊、小貓的順序投遞，再檢查。';
            return;
        }
        updateAnswer(level);
        await check(level);
        if ($(`input-level${level}`).readOnly) {
            document.querySelectorAll(`#block-level${level} .mail-answer`).forEach(el => {
                el.readOnly = true;
                el.closest('.mailbox')?.classList.add('readonly');
            });
        }
    };
}

async function verifyUnlock() {
    if (checking) return;
    checking = true;
    $('mail-retry').disabled = true;
    const unlocked = hasWeek02Unlock();
    $('mail-content').classList.toggle('hidden', !unlocked);
    $('mail-lock-panel').classList.toggle('hidden', unlocked);
    if (unlocked) {
        start();
    } else {
        $('mail-lock').textContent = '先回本週課程，完成游標、坐姿答題與視窗練習，再來投遞。';
    }
    checking = false;
    $('mail-retry').disabled = false;
}

initNavbarAuth({ onSessionResolved: next => {
    if (session?.user && session.user.id !== next?.user?.id) {
        window.location.reload();
        return;
    }
    session = next;
    void verifyUnlock();
}});

$('mail-retry').onclick = verifyUnlock;
$('boot-status').hidden = true;
