import readings from './week02-zhuyin.json' with { type: 'json' };

export function initReadingAid() {
    const section = document.getElementById('posture-task');
    const toggle = document.getElementById('zhuyin-toggle');
    if (!section || !toggle) return;

    let visible = false;

    function annotate(root) {
        if (!root || root.dataset.zhuyinAnnotated === 'true') return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.parentElement?.closest('script,style,ruby,textarea,input,kbd,nav,.lesson-route,.code,.hero-art,#auth-status,#zhuyin-toggle,.numlock-status,.keyboard-popover,.reference,footer')) continue;
            if (/[^\s]/.test(node.data) && /[㐀-鿿]/.test(node.data)) nodes.push(node);
        }
        for (const node of nodes) {
            const text = node.data, fragment = document.createDocumentFragment();
            [...text].forEach((char,i) => {
                let reading = readings[char];
                if (char === '還') reading = text.slice(i,i+2) === '還原' ? 'ㄏㄨㄢˊ' : 'ㄏㄞˊ';
                if (char === '重') reading = text.slice(i,i+2) === '重新' ? 'ㄔㄨㄥˊ' : 'ㄓㄨㄥˋ';
                if (char === '著') reading = '˙ㄓㄜ';
                if (reading) {
                    const ruby = document.createElement('ruby'); ruby.append(char);
                    const rt = document.createElement('rt'); rt.textContent = reading; ruby.append(rt); fragment.append(ruby);
                } else fragment.append(char);
            });
            node.replaceWith(fragment);
        }
        root.dataset.zhuyinAnnotated = 'true';
    }

    function applyScope() {
        const scope = document.querySelector('#quiz-container .quiz-reading-scope');
        if (!scope) return;
        annotate(scope);
        scope.classList.toggle('zhuyin-off', !visible);
    }

    toggle.addEventListener('click', event => {
        visible = !visible;
        event.currentTarget.setAttribute('aria-pressed', String(visible));
        event.currentTarget.textContent = visible ? '隱藏題目注音' : '顯示題目注音';
        applyScope();
    });

    document.addEventListener('quiz-practice:rendered', applyScope);
    applyScope();
}
