import { findTypingDifference } from './typing-text-diff.mjs?v=20261113-locator';

const compositions = new WeakMap();
export function trackTypingComposition(input) {
    if (compositions.has(input)) return;
    const state = { active: false };
    compositions.set(input, state);
    input.addEventListener('compositionstart', () => { state.active = true; });
    input.addEventListener('compositionend', () => { state.active = false; });
    input.addEventListener('blur', () => { state.active = false; });
}

function ensureStyle() {
    if (document.getElementById('typing-error-locator-style')) return;
    const style = document.createElement('style');
    style.id = 'typing-error-locator-style';
    style.textContent = `
    .typing-error-message{height:auto!important;min-height:2rem;margin-top:1rem;color:#334155;text-align:left}
    .typing-error-locator{border:2px solid #fbbf24;border-radius:18px;background:#fffbeb;padding:18px;font-size:1rem;line-height:1.8;overflow-wrap:anywhere}
    .typing-error-locator p{margin:0 0 10px}.typing-error-locator .typing-error-title{font-size:1.12rem;font-weight:900;color:#92400e}
    .typing-error-context{background:#fff;border:1px solid #fde68a;border-radius:12px;padding:10px 12px;margin:10px 0;white-space:pre-wrap}
    .typing-error-context strong{display:block;color:#475569;font-size:.88rem}.typing-error-context mark{background:#fef08a;border:2px solid #a16207;color:#713f12;border-radius:4px;padding:1px 3px;font-weight:900}
    .typing-error-context.actual mark{background:#ffe4e6;border-color:#be123c;color:#881337}.typing-error-context .typing-error-gap{background:#dcfce7;border-color:#15803d;color:#14532d}
    .typing-error-jump{font:inherit;font-weight:900;border:0;border-radius:12px;background:#6d28d9;color:#fff;padding:12px 18px;min-height:48px;cursor:pointer;margin:8px 0}
    .typing-error-jump:focus-visible{outline:3px solid #4338ca;outline-offset:4px}.typing-error-note,.typing-error-status{font-size:.9rem;color:#475569}
    @media(max-width:640px){.typing-error-locator{padding:14px}.typing-error-jump{width:100%}}
    `;
    document.head.append(style);
}

function visibleText(text) { return text.replace(/\r\n/g, '\n').replace(/\n/g, ' ⏎ '); }
function describe(text) {
    const names = { '\n': '換行（Enter）', '\r\n': '換行（Enter）', ' ': '空白（Space）', '\t': '定位空白（Tab）',
        '，': '全形逗號「，」', ',': '半形逗號「,」', '。': '全形句號「。」', '.': '半形句點「.」',
        '？': '全形問號「？」', '?': '半形問號「?」', '！': '全形驚嘆號「！」', '!': '半形驚嘆號「!」',
        '　': '全形空白', "'": '直撇號', '’': '彎撇號「’」' };
    return names[text] || `「${text}」`;
}

function contextRow(label, context, actual, gapLabel) {
    const row = document.createElement('div');
    row.className = 'typing-error-context' + (actual ? ' actual' : '');
    const heading = document.createElement('strong'); heading.textContent = label;
    const mark = document.createElement('mark');
    mark.textContent = context.highlight ? (/^\s+$/u.test(context.highlight) ? describe(context.highlight) : visibleText(context.highlight)) : gapLabel;
    if (!context.highlight) mark.className = 'typing-error-gap';
    row.append(heading, document.createTextNode((context.moreBefore ? '…' : '') + visibleText(context.before)), mark,
        document.createTextNode(visibleText(context.after) + (context.moreAfter ? '…' : '')));
    return row;
}

// Measure the caret using the live textarea width/font. Soft wraps never become "input lines".
function scrollToSelection(input, start, end) {
    const computed = getComputedStyle(input);
    const mirror = document.createElement('div');
    Object.assign(mirror.style, { position: 'absolute', top: '0', left: '-100000px', visibility: 'hidden',
        pointerEvents: 'none', boxSizing: 'border-box', width: `${input.clientWidth}px`,
        whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: computed.wordBreak, border: '0' });
    for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
        'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'tabSize', 'textIndent', 'direction']) {
        mirror.style[property] = computed[property];
    }
    const marker = document.createElement('span'); marker.textContent = input.value.slice(start, end) || '\u200b';
    mirror.append(document.createTextNode(input.value.slice(0, start)), marker,
        document.createTextNode(input.value.slice(end) || '\u200b'));
    document.body.append(mirror);
    const top = marker.offsetTop;
    mirror.remove();
    input.focus({ preventScroll: true });
    input.setSelectionRange(start, end);
    input.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    requestAnimationFrame(() => { input.scrollTop = Math.max(0, top - input.clientHeight * .42); });
}

export function renderTypingErrorLocator(root, input, answer) {
    trackTypingComposition(input);
    ensureStyle();
    const snapshot = input.value;
    const difference = findTypingDifference(snapshot, answer);
    root.replaceChildren();
    root.className = 'typing-message typing-error-message';
    if (!difference) { root.textContent = '這段已修正，請再按「檢查」確認。'; return; }
    const card = document.createElement('div'); card.className = 'typing-error-locator';
    const title = document.createElement('p'); title.className = 'typing-error-title';
    title.textContent = difference.kind === 'missing' ? `這裡少了${describe(difference.expectedText)}`
        : difference.kind === 'extra' ? `這裡多了${describe(difference.actualText)}`
        : `這裡需要${describe(difference.expectedText)}，目前是${describe(difference.actualText)}`;
    card.append(title, contextRow('題目附近', difference.expectedContext, false, '這裡不用加字'),
        contextRow('我的輸入附近', difference.actualContext, true, '插入這裡'));
    const jump = document.createElement('button'); jump.type = 'button'; jump.className = 'typing-error-jump';
    jump.textContent = '帶我到這裡';
    const note = document.createElement('p'); note.className = 'typing-error-note';
    note.textContent = '先修這一處，再按檢查。畫面自動折行不影響定位；⏎ 代表按 Enter 換行。';
    const status = document.createElement('p'); status.className = 'typing-error-status'; status.setAttribute('role', 'status');
    jump.addEventListener('click', () => {
        if (compositions.get(input)?.active) { status.textContent = '請先完成注音選字，再按「帶我到這裡」。'; return; }
        if (input.disabled || input.readOnly) { status.textContent = '輸入框目前未開放，請先確認登入與進度狀態。'; return; }
        const current = findTypingDifference(input.value, answer);
        if (!current) { renderTypingErrorLocator(root, input, answer); return; }
        if (snapshot !== input.value) {
            renderTypingErrorLocator(root, input, answer);
            const updatedStatus = root.querySelector('.typing-error-status');
            updatedStatus.textContent = '內容已更新，已重新定位目前第一處差異。';
        } else {
            status.textContent = current.kind === 'missing' ? '游標已放在插入位置，直接補上文字即可。' : '已反白這一處，直接修改即可。';
        }
        scrollToSelection(input, current.actualStart, current.actualEnd);
    });
    card.append(jump, note, status);
    root.append(card);
}
