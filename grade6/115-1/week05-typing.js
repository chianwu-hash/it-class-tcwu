import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initTypingChallenge } from '../../shared/typing-challenge.js';
import { initTypingTools } from '../../shared/typing-tools.js';
import { challenges } from './week05-typing-data.js';

const challenge = challenges[document.body.dataset.challenge || 'regular'];
const root = document.getElementById('typing-levels-container');
challenge.levels.forEach(({ id, title, ans }, index) => {
    const article = document.createElement('article');
    article.id = `block-level${id}`;
    article.className = `typing-level${index ? ' hidden' : ''}`;
    const heading = document.createElement('h3');
    heading.className = 'typing-title';
    heading.textContent = challenge.boss ? `👑 ${title}` : `第${id}關｜${title}`;
    const grid = document.createElement('div'); grid.className = 'typing-grid';
    const source = document.createElement('div');
    const targetLabel = document.createElement('p'); targetLabel.className = 'typing-label';
    targetLabel.textContent = `📖 題目・${ans.split('\n').length}行｜依照換行逐字輸入`;
    const target = document.createElement('pre'); target.className = 'typing-target select-none pointer-events-none'; target.textContent = ans;
    source.append(targetLabel, target);
    const work = document.createElement('div');
    const label = document.createElement('label'); label.htmlFor = `input-level${id}`; label.className = 'typing-label'; label.textContent = '✍️ 我的輸入';
    const input = document.createElement('textarea'); input.id = `input-level${id}`; input.className = 'typing-input'; input.disabled = true;
    input.rows = challenge.boss ? Math.max(14, ans.split('\n').length + 1) : Math.min(8, ans.split('\n').length + 1);
    input.placeholder = '先登入學校Google帳號，再逐字輸入。';
    input.spellcheck = false; input.autocomplete = 'off'; input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocorrect', 'off');
    input.setAttribute('onpaste', 'return false;'); input.setAttribute('ondrop', 'return false;');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'typing-check'; button.disabled = true;
    button.setAttribute('onclick', `checkLevel(${id})`); button.textContent = challenge.boss ? '🌸 檢查全文・挑戰魔王' : '檢查答案';
    const msg = document.createElement('p'); msg.id = `msg-level${id}`; msg.className = 'typing-message'; msg.setAttribute('aria-live', 'polite');
    work.append(label, input, button, msg); grid.append(source, work); article.append(heading, grid); root.append(article);
});

function buildHint(value, answer) {
    const actual = value.split('\n'), expected = answer.split('\n');
    for (let line = 0; line < Math.max(actual.length, expected.length); line++) {
        if (actual[line] === expected[line]) continue;
        if (actual[line] === undefined) return `第${line + 1}行尚未完成，請檢查換行。`;
        if (expected[line] === undefined) return `第${line + 1}行多出內容，請檢查換行。`;
        let index = 0; while (actual[line][index] === expected[line][index] && index < expected[line].length) index++;
        return `第${line + 1}行、第${index + 1}個字附近不同，請檢查文字、大小寫、空格與標點。`;
    }
    return '請逐行檢查。';
}
initNavbarAuth();
initTypingTools();
initTypingChallenge({
    courseId: 'grade6-115-1', weekCode: '05', activityKey: challenge.key,
    levelsData: challenge.levels.map(({id, ans}) => ({id, ans})),
    draftOptions: { enabled: true }, buildHint,
    levelEncouragements: Object.fromEntries(challenge.levels.map(({id}) => [id, '你耐心完成逐行檢查，並修正到完全正確。'])),
    progressMessages: {
        completed: challenge.boss ? '🌸 這個魔王已完成，已取得1朵花。重新練習不會重複增加。' : '普通5關已完成，可以自由選擇進階魔王或其他延伸任務。',
        resumed: level => `已接回${challenge.title}，從第${level}關繼續。未完成的文字請按「回復上次草稿」。`,
        unauthenticated: '請先登入學校Google帳號，才能開始並保存自己的進度。',
        saveCompleted: challenge.boss ? '🌸 完成紀錄已儲存，這個魔王開出1朵花。' : '第05週5關完成紀錄已儲存。',
        resetConfirm: `要重設「${challenge.title}」嗎？這會清除此活動進度與草稿，並收回它的獎勵；其他活動不受影響。`
    },
    celebrationContent: {
        title: challenge.boss ? '🌸 你的魔王花開了！' : '第05週普通魔王完成！',
        message: challenge.boss ? '你把整篇文字逐行完成，這個挑戰留下1朵花。休息一下，或回去看看其他任務。' : '你已完成普通5關。想再挑戰，可以試試國語或英語進階魔王。',
        buttonText: challenge.boss ? '回魔王花園・看看我的花' : '回到第05週・選擇下一步', buttonHref: challenge.boss ? 'boss-garden.html' : 'week05.html#advanced-boss'
    }
});
