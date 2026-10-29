import { buildKeyboardGuideModel } from './typing-guide-model.mjs?v=20261028';
import { zhuyinKeys } from './zhuyin-foundation-curriculum.mjs';

const states = new WeakMap();
let composing = false;
let initialized = false;
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function ensureKeyboardGuideStyles() {
    if (!document.getElementById('typing-keyboard-guide-css')) {
        const link = document.createElement('link');
        link.id = 'typing-keyboard-guide-css'; link.rel = 'stylesheet';
        link.href = new URL('./typing-keyboard-guide.css?v=20261028', import.meta.url).href;
        document.head.appendChild(link);
    }
    if (!initialized) {
        initialized = true;
        document.addEventListener('compositionstart', () => { composing = true; }, true);
        document.addEventListener('compositionend', () => { composing = false; }, true);
    }
}

// Mouse lookup keeps the input focused. Tab/Enter/Space retain native button behavior.
export function keepTypingFocus(root) {
    root.addEventListener('mousedown', event => {
        if (event.target.closest('button')) event.preventDefault();
    });
}

function keyboardHtml(lang) {
    const rows = lang === 'zh'
        ? ['1234567890-', 'qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./', ['space']]
        : ['1234567890-=', 'qwertyuiop[]', [..."asdfghjkl;'", 'enter'], ['shift', ...'zxcvbnm,./'], ['space']];
    return rows.map(row => `<div class="kg-key-row typing-letter-row">${[...row].map(key => {
        const label = key === 'space' ? '空白鍵' : key === 'shift' ? 'Shift' : key === 'enter' ? 'Enter' : lang === 'zh' ? zhuyinKeys[key] || key : key.toUpperCase();
        const detail = key === 'space' ? lang === 'zh' ? '一聲' : 'Space' : ['shift', 'enter'].includes(key) ? '' : lang === 'zh' ? key.toUpperCase() : /^[a-z]$/.test(key) ? key : '';
        return `<kbd class="kg-key typing-letter-key${key === 'space' ? ' kg-space' : ''}${key === 'enter' || key === 'shift' ? ' kg-wide' : ''}" data-key="${escape(key)}" aria-label="${escape(label)} 鍵"><span>${escape(label)}</span><small>${escape(detail)}</small></kbd>`;
    }).join('')}</div>`).join('');
}

function render(container, target) {
    if (!container) return null;
    ensureKeyboardGuideStyles();
    const fingerprint = JSON.stringify(target);
    if (states.get(container)?.fingerprint === fingerprint) return container.firstElementChild;
    const model = buildKeyboardGuideModel(target);
    const state = { fingerprint, index: 0, all: false, selected: null };
    states.set(container, state);
    const zh = model.lang === 'zh';
    container.innerHTML = `<section class="kg-guide typing-letter-guide" ${zh ? 'data-zhuyin-keyboard-guide' : 'data-english-keyboard-guide'} aria-label="${zh ? '注音' : '英文'}按鍵提示">
        <p class="kg-intro">${zh ? '先切到「中」；點不會的字，只看它的按鍵。' : '鍵帽大寫、直接按是小寫；大寫請搭配 Shift。'}</p>
        <div class="kg-board typing-letter-keyboard${zh ? ' typing-zhuyin-keyboard' : ''}" aria-label="${zh ? '注音' : '英文'}鍵盤按鍵位置示意">${keyboardHtml(model.lang)}</div>
        <div class="kg-toolbar">
            <button type="button" data-guide-prev aria-label="上一段">← 上一段</button>
            <span class="kg-position"></span>
            <button type="button" data-guide-next aria-label="下一段">下一段 →</button>
            <button type="button" data-guide-all aria-expanded="false">${zh ? '看全部注音' : '看全部按鍵'}</button>
        </div>
        <div class="kg-selection"><span class="kg-status" role="status"></span><button type="button" data-guide-clear hidden>看整段</button></div>
        <div class="kg-hints" tabindex="0" aria-label="${zh ? '注音' : '按鍵'}提示，可捲動"></div>
    </section>`;
    const guide = container.firstElementChild;
    keepTypingFocus(guide);
    const hints = guide.querySelector('.kg-hints'), status = guide.querySelector('.kg-status');
    const prev = guide.querySelector('[data-guide-prev]'), next = guide.querySelector('[data-guide-next]');
    const all = guide.querySelector('[data-guide-all]'), clear = guide.querySelector('[data-guide-clear]');
    function updateKeys() {
        const selected = model.items.find(item => item.id === state.selected);
        const items = selected ? [selected] : model.segments[state.index] || [];
        const keys = new Set(items.flatMap(item => item.keys));
        guide.querySelectorAll('[data-key]').forEach(key => {
            const active = keys.has(key.dataset.key);
            key.classList.toggle('is-target', active);
            key.setAttribute('aria-label', `${key.querySelector('span').textContent} 鍵${active ? '，目前提示需要' : ''}`);
        });
        hints.querySelectorAll('[data-guide-char]').forEach(card => {
            card.setAttribute('aria-pressed', String(Number(card.dataset.guideChar) === state.selected));
        });
        status.textContent = selected ? `正在找「${selected.display}」：${selected.hint}` : model.warning || (model.text ? '黃色是這一段用到的鍵；可以點字卡縮小提示。' : '點一下題目的輸入框，再來看按鍵。');
        clear.hidden = state.selected === null;
    }
    function paint() {
        const multiple = model.segments.length > 1;
        prev.hidden = next.hidden = !multiple;
        prev.disabled = state.index === 0; next.disabled = state.index >= model.segments.length - 1;
        all.hidden = !multiple;
        all.textContent = state.all ? '收起全部' : zh ? '看全部注音' : '看全部按鍵';
        all.setAttribute('aria-expanded', String(state.all));
        guide.querySelector('.kg-position').textContent = model.segments.length ? `第 ${state.index + 1}／${model.segments.length} 段` : '';
        const shown = state.all ? model.segments.map((items, index) => ({ items, index })) : [{ items: model.segments[state.index] || [], index: state.index }];
        hints.innerHTML = shown.map(({ items, index }) => `<div class="kg-segment${index === state.index ? ' is-current' : ''}" data-segment="${index}">
            ${state.all ? `<p class="kg-segment-label">第 ${index + 1} 段</p>` : ''}
            <p class="kg-source">${escape(items.map(item => item.char).join(''))}</p>
            <div class="kg-cards">${items.map(item => `<button type="button" class="kg-card${item.kind === 'punct' ? ' kg-punctuation' : ''}" data-guide-char="${item.id}" aria-pressed="false" aria-label="${escape(item.kind === 'punct' ? `查看「${item.display}」的標點符號表` : `看「${item.display}」的按鍵`)}"><strong>${escape(item.display)}</strong><small>${escape(item.hint).replace(' ＋ 空白', '<br><span class="kg-tone">一聲：空白</span>')}</small></button>`).join('')}</div>
        </div>`).join('');
        hints.scrollTop = 0;
        updateKeys();
    }
    guide.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        if (composing) { status.textContent = '先完成選字，再切換按鍵提示。'; return; }
        if (button === prev || button === next) { state.index += button === prev ? -1 : 1; state.selected = null; paint(); }
        else if (button === all) { state.all = !state.all; paint(); }
        else if (button === clear) { state.selected = null; updateKeys(); }
        else if (button.hasAttribute('data-guide-char')) {
            const id = Number(button.dataset.guideChar), item = model.items[id];
            if (item.kind === 'punct') {
                guide.dispatchEvent(new CustomEvent('typing-tools:show-punctuation', { bubbles: true }));
                return;
            }
            state.index = Number(button.closest('[data-segment]').dataset.segment);
            state.selected = state.selected === id ? null : id;
            guide.querySelector('.kg-position').textContent = `第 ${state.index + 1}／${model.segments.length} 段`;
            prev.disabled = state.index === 0; next.disabled = state.index >= model.segments.length - 1;
            updateKeys();
        }
    });
    paint();
    return guide;
}

export function renderEnglishKeyboardGuide(container, options = {}) {
    return render(container, { lang: 'en', text: String(options.target ?? options.text ?? '') });
}

export function renderZhuyinKeyboardGuide(container, target = {}) {
    return render(container, { lang: 'zh', text: String(target.text ?? ''), zhuyin: String(target.zhuyin ?? '') });
}
