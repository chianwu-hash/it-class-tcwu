import { zhuyinKeys } from './zhuyin-foundation-curriculum.mjs';

const symbolKeys = Object.fromEntries(Object.entries(zhuyinKeys).map(([key, symbol]) => [symbol, key]));
const han = char => /\p{Script=Han}/u.test(char);
const shifted = { '?': '/', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', ':': ';', '"': "'", '<': ',', '>': '.', '~': '`', '{': '[', '}': ']', '|': '\\' };

export function englishKeyInfo(char) {
    if (char === '\n') return { keys: ['enter'], hint: 'Enter 換行' };
    if (/\s/u.test(char)) return { keys: ['space'], hint: '空白鍵' };
    if (/[A-Z]/.test(char)) return { keys: ['shift', char.toLowerCase()], hint: `Shift ＋ ${char}` };
    if (shifted[char]) return { keys: ['shift', shifted[char]], hint: `Shift ＋ ${shifted[char]}` };
    if (/^[a-z0-9\-=[\];',./`\\]$/.test(char)) return { keys: [char], hint: /^[a-z]$/.test(char) ? char.toUpperCase() : char };
    return { keys: [], hint: '對照原題目' };
}

// Every source character is retained, including punctuation, spaces and line breaks.
// A mismatched pronunciation list is never partially paired with the wrong character.
export function buildKeyboardGuideModel({ lang = 'en', text = '', zhuyin = '', zhLimit = 8, enLimit = 28 } = {}) {
    text = String(text).replace(/\r\n?/g, '\n');
    const chars = [...text];
    const syllables = String(zhuyin).trim().split(/\s+/).filter(Boolean);
    const hanCount = chars.filter(han).length;
    const validZhuyin = lang !== 'zh' || (hanCount === syllables.length && syllables.every(s => [...s].every(c => symbolKeys[c])));
    let syllableIndex = 0;
    const items = chars.map((char, index) => {
        const base = { id: index, char, display: char === '\n' ? '換行' : /\s/u.test(char) ? '空白' : char };
        if (lang !== 'zh') return { ...base, kind: char === '\n' ? 'newline' : /\s/u.test(char) ? 'space' : 'letter', ...englishKeyInfo(char) };
        if (han(char)) {
            const syllable = validZhuyin ? syllables[syllableIndex] : '';
            syllableIndex++;
            const firstTone = syllable && !'ˊˇˋ˙'.includes([...syllable].at(-1));
            return { ...base, kind: 'han', syllable, keys: [...syllable].map(c => symbolKeys[c]).concat(firstTone ? ['space'] : []), hint: syllable ? `${syllable}${firstTone ? ' ＋ 空白' : ''}` : '注音待確認' };
        }
        if (char === '\n') return { ...base, kind: 'newline', keys: ['enter'], hint: '選好字後 Enter 換行' };
        if (/\s/u.test(char)) return { ...base, kind: 'space', keys: ['space'], hint: '空白鍵' };
        return { ...base, kind: 'punct', keys: [], hint: '看標點符號表' };
    });
    const segments = [];
    let current = [], count = 0;
    const flush = () => {
        if (current.length) {
            if (segments.length && current.every(i => ['punct', 'space', 'newline'].includes(i.kind))) segments.at(-1).push(...current);
            else segments.push(current);
        }
        current = []; count = 0;
    };
    if (lang === 'zh') {
        let phrase = [];
        const emitPhrase = () => {
            const total = phrase.filter(i => i.kind === 'han').length;
            const groups = Math.max(1, Math.ceil(total / Math.max(1, zhLimit)));
            let seen = 0, group = 1;
            for (const item of phrase) {
                if (item.kind === 'han' && seen >= Math.ceil(group * total / groups)) { flush(); group++; }
                current.push(item);
                if (item.kind === 'han') seen++;
            }
            flush(); phrase = [];
        };
        for (const item of items) {
            phrase.push(item);
            if (item.kind === 'newline' || /[，。！？；、!?;,]/u.test(item.char)) emitPhrase();
        }
        emitPhrase();
    } else {
        // Keep a long single word intact; wrap only between words.
        let offset = 0;
        for (const token of text.match(/\n|[^\S\n]+|[^\s]+/gu) || []) {
            const group = items.slice(offset, offset + [...token].length);
            offset += group.length;
            if (!/^\s/u.test(token) && count && count + group.length > Math.max(1, enLimit)) flush();
            current.push(...group); count += group.length;
            if (token === '\n') flush();
        }
    }
    flush();
    return { lang, text, items, segments, warning: !validZhuyin ? '這題的注音對照尚待確認，先看鍵盤位置，請老師協助。' : '' };
}
