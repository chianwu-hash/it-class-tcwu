import baseReadings from './week02-zhuyin.json' with { type: 'json' };

// 沿用第 02 週字音，補入本週影片題組用字。
const readings = {
    ...baseReadings,
    機: 'ㄐㄧ', 板: 'ㄅㄢˇ', 況: 'ㄎㄨㄤˋ', 需: 'ㄒㄩ',
    室: 'ㄕˋ', 旁: 'ㄆㄤˊ', 明: 'ㄇㄧㄥˊ', 亮: 'ㄌㄧㄤˋ',
    燈: 'ㄉㄥ', 光: 'ㄍㄨㄤ', 很: 'ㄏㄣˇ', 暗: 'ㄢˋ',
    房: 'ㄈㄤˊ', 白: 'ㄅㄞˊ', 戶: 'ㄏㄨˋ', 昏: 'ㄏㄨㄣ',
    環: 'ㄏㄨㄢˊ', 易: 'ㄧˋ', 受: 'ㄕㄡˋ', 傷: 'ㄕㄤ',
    路: 'ㄌㄨˋ', 低: 'ㄉㄧ', 撞: 'ㄓㄨㄤˋ', 東: 'ㄉㄨㄥ',
    西: 'ㄒㄧ', 危: 'ㄨㄟˊ', 險: 'ㄒㄧㄢˇ', 因: 'ㄧㄣ',
    肩: 'ㄐㄧㄢ', 膀: 'ㄅㄤˇ', 脖: 'ㄅㄛˊ', 痛: 'ㄊㄨㄥˋ',
    聲: 'ㄕㄥ', 池: 'ㄔˊ', 充: 'ㄔㄨㄥ', 指: 'ㄓˇ',
    造: 'ㄗㄠˋ', 頸: 'ㄐㄧㄥˇ', 疼: 'ㄊㄥˊ', 幾: 'ㄐㄧˇ',
    寫: 'ㄒㄧㄝˇ', 短: 'ㄉㄨㄢˇ'
};

export function initQuizReadingAid() {
    const root = document.getElementById('quiz-container');
    const toggle = document.getElementById('zhuyin-toggle');
    if (!root || !toggle) return;

    let visible = false;

    function deannotate() {
        observer.disconnect();
        root.querySelectorAll('ruby').forEach(ruby => {
            const rbText = [...ruby.childNodes]
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent)
                .join('');
            ruby.replaceWith(document.createTextNode(rbText || ruby.textContent));
        });
        observer.observe(root, { childList: true, subtree: true, characterData: true });
    }

    function annotate() {
        if (!visible) return;
        observer.disconnect();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.parentElement.closest('ruby,script,style,input,textarea') && /[㐀-鿿]/.test(node.data)) nodes.push(node);
        }
        for (const node of nodes) {
            const fragment = document.createDocumentFragment();
            [...node.data].forEach((char, index) => {
                let reading = readings[char];
                if (char === '還') reading = 'ㄏㄞˊ';
                if (char === '重') reading = node.data.slice(index, index + 2) === '重新' ? 'ㄔㄨㄥˊ' : 'ㄓㄨㄥˋ';
                if (char === '西' && node.data[index - 1] === '東') reading = '˙ㄒㄧ';
                if (!reading) { fragment.append(char); return; }
                const ruby = document.createElement('ruby');
                const rt = document.createElement('rt');
                rt.textContent = reading;
                ruby.append(char, rt);
                fragment.append(ruby);
            });
            node.replaceWith(fragment);
        }
        observer.observe(root, { childList: true, subtree: true, characterData: true });
    }

    const observer = new MutationObserver(annotate);
    root.classList.add('quiz-zhuyin-off');
    toggle.addEventListener('click', () => {
        visible = root.classList.contains('quiz-zhuyin-off');
        root.classList.toggle('quiz-zhuyin-off', !visible);
        toggle.setAttribute('aria-pressed', String(visible));
        toggle.textContent = visible ? '隱藏題目注音' : '顯示題目注音';
        if (visible) annotate();
        else deannotate();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
}
