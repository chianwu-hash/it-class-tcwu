const ZH_KEYBOARD_URL = "https://res.cloudinary.com/dmqmjfqng/image/upload/v1773745139/postimages-migration/040_ytvyrx.png";
const EN_KEYBOARD_URL = "https://res.cloudinary.com/dmqmjfqng/image/upload/v1777287126/it-class-tcwu/grade3/week12/english-keyboard-071.png";
const PUNCTUATION_PAGE_1_URL = "https://res.cloudinary.com/dmqmjfqng/image/upload/c_crop,w_1188,h_490,x_0,y_0/v1773745152/postimages-migration/101_ngog8m.png";
const PUNCTUATION_PAGE_2_URL = "https://res.cloudinary.com/dmqmjfqng/image/upload/c_crop,w_1188,h_546,x_0,y_490/v1773745152/postimages-migration/101_ngog8m.png";
const ENGLISH_LETTER_ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"]
];

function ensureEnglishKeyboardGuideStyles() {
    if (document.getElementById("english-keyboard-guide-styles")) return;
    const style = document.createElement("style");
    style.id = "english-keyboard-guide-styles";
    style.textContent = `
        .typing-letter-guide{padding:16px 18px;border:3px solid #67e8f9;border-radius:18px;background:#ecfeff;color:#173f3b;font-family:'Noto Sans TC',sans-serif;font-weight:800}
        .typing-letter-guide-intro{margin:0 0 12px;font-size:18px;line-height:1.6}
        .typing-letter-keyboard{max-width:660px;margin:0 auto;overflow-x:auto;padding:5px}
        .typing-letter-row{display:flex;gap:6px;min-width:570px}
        .typing-letter-row+.typing-letter-row{margin-top:6px}
        .typing-letter-row:nth-child(2){padding-left:20px}
        .typing-letter-row:nth-child(3){padding-left:54px}
        .typing-letter-key{display:grid;grid-template-rows:1fr 1fr;place-items:center;width:50px;height:54px;padding:3px 0;border:2px solid #cbd5e1;border-bottom:5px solid #94a3b8;border-radius:9px;background:#fff;color:#334155;font:900 17px/1 'Noto Sans TC',sans-serif}
        .typing-letter-key small{color:#0f766e;font-size:13px;font-weight:900}
        .typing-letter-key.is-target{border-color:#f59e0b;border-bottom-color:#d97706;background:#fde047;color:#713f12;box-shadow:0 0 0 3px #fef3c7}
        .typing-letter-key.is-target small{color:#713f12}
        .typing-letter-guide-help{margin:12px 0 0;color:#174f48;font-size:17px;line-height:1.6}
        .typing-letter-sequence{color:#92400e;letter-spacing:.05em}
        @media(max-width:760px){.typing-letter-guide{padding:13px 10px}.typing-letter-guide-intro,.typing-letter-guide-help{font-size:16px}}
    `;
    document.head.appendChild(style);
}

function ensureKeyLocationHintStyles() {
    if (document.getElementById("typing-key-location-hint-styles")) return;
    const style = document.createElement("style");
    style.id = "typing-key-location-hint-styles";
    style.textContent = `
        .typing-key-hint{position:relative;display:inline-block;vertical-align:middle;cursor:help}
        .typing-key-hint>kbd{border-color:#8fc9b8;border-bottom-color:#6fa997;background:#f8fffb;color:#17423b;font-size:1.02em;padding:3px 10px}
        .typing-key-hint:hover>kbd,.typing-key-hint:focus>kbd,.typing-key-hint:focus-within>kbd{background:#fef3c7;border-color:#f59e0b;border-bottom-color:#d97706;color:#78350f;outline:4px solid #fde68a;outline-offset:2px}
        .typing-key-popover{position:absolute;z-index:30;bottom:calc(100% + 13px);left:50%;transform:translate(-50%,-6px);width:min(620px,88vw);padding:14px 16px 16px;background:#0faaa0;border:3px solid #f59e0b;border-radius:18px;box-shadow:0 16px 32px rgba(120,53,15,.24);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .15s ease,transform .15s ease}
        .typing-key-popover:before{content:"";position:absolute;bottom:-12px;left:50%;width:18px;height:18px;background:#0faaa0;border-right:3px solid #f59e0b;border-bottom:3px solid #f59e0b;transform:translateX(-50%) rotate(45deg)}
        .typing-key-hint:hover .typing-key-popover,.typing-key-hint:focus .typing-key-popover,.typing-key-hint:focus-within .typing-key-popover{opacity:1;visibility:visible;transform:translate(-50%,0)}
        .typing-key-popover-title{display:block;margin:0 0 10px;color:#fff7ed;font-size:17px;font-weight:900;text-align:center;text-shadow:0 1px 0 rgba(0,0,0,.2)}
        .typing-keyboard-strip{display:grid;gap:7px}
        .typing-keyboard-strip-row{display:grid;gap:6px}
        .typing-keyboard-strip-row.function{grid-template-columns:1.2fr repeat(12,1fr)}
        .typing-keyboard-strip-row.number{grid-template-columns:repeat(13,1fr) 2.5fr}
        .typing-keyboard-strip-row.letters{grid-template-columns:1.5fr repeat(10,1fr)}
        .typing-keyboard-strip-row.home{grid-template-columns:2fr repeat(9,1fr) 2fr}
        .typing-keyboard-strip-row.bottom{grid-template-columns:2.4fr repeat(7,1fr) 2.4fr}
        .typing-keyboard-strip-row span{display:flex;align-items:center;justify-content:center;min-height:34px;border:1px solid #cbd5e1;border-bottom:4px solid #94a3b8;border-radius:7px;background:#fff;color:#111827;font-size:13px;font-weight:900;line-height:1}
        .typing-keyboard-strip-row .is-backspace{border:4px solid #1d4ed8;border-bottom-color:#1d4ed8;background:#fff;color:#111827;font-size:16px;box-shadow:0 0 0 3px #dbeafe inset}
        .typing-keyboard-strip-row .is-capslock{border:4px solid #1d4ed8;border-bottom-color:#1d4ed8;background:#fff;color:#111827;font-size:15px;box-shadow:0 0 0 3px #dbeafe inset}
        .typing-keyboard-strip-row .is-shift{border:4px solid #1d4ed8;border-bottom-color:#1d4ed8;background:#fff;color:#111827;font-size:15px;box-shadow:0 0 0 3px #dbeafe inset}
        .typing-key-popover.is-below-left{top:calc(100% + 13px);bottom:auto;left:0;transform:translateY(-6px)}
        .typing-key-popover.is-below-left:before{top:-12px;bottom:auto;left:64px;border:0;border-left:3px solid #f59e0b;border-top:3px solid #f59e0b}
        .typing-key-hint:hover .typing-key-popover.is-below-left,.typing-key-hint:focus .typing-key-popover.is-below-left,.typing-key-hint:focus-within .typing-key-popover.is-below-left{transform:translateY(0)}
        .typing-key-popover.is-below-center{top:calc(100% + 13px);bottom:auto}
        .typing-key-popover.is-below-center:before{top:-12px;bottom:auto;border:0;border-left:3px solid #f59e0b;border-top:3px solid #f59e0b}
        .typing-key-popover-help{display:block;margin-top:10px;color:#ecfeff;font-size:14px;font-weight:900;text-align:center}
        @media(max-width:760px){.typing-key-popover,.typing-key-popover.is-below-left,.typing-key-popover.is-below-center{position:fixed;top:var(--typing-key-popover-mobile-top,142px);bottom:auto;left:50%;right:auto;transform:translate(-50%,-6px);width:min(500px,92vw);max-height:calc(100vh - var(--typing-key-popover-mobile-top,142px) - 12px);overflow:auto;padding:11px}.typing-key-popover:before,.typing-key-popover.is-below-left:before,.typing-key-popover.is-below-center:before{display:none}.typing-key-hint:hover .typing-key-popover,.typing-key-hint:focus .typing-key-popover,.typing-key-hint:focus-within .typing-key-popover,.typing-key-hint:hover .typing-key-popover.is-below-left,.typing-key-hint:focus .typing-key-popover.is-below-left,.typing-key-hint:focus-within .typing-key-popover.is-below-left,.typing-key-hint:hover .typing-key-popover.is-below-center,.typing-key-hint:focus .typing-key-popover.is-below-center,.typing-key-hint:focus-within .typing-key-popover.is-below-center{transform:translate(-50%,0)}.typing-keyboard-strip-row{gap:3px}.typing-keyboard-strip-row span{min-height:28px;font-size:10px}.typing-keyboard-strip-row .is-backspace,.typing-keyboard-strip-row .is-capslock,.typing-keyboard-strip-row .is-shift{font-size:11px}}
    `;
    document.head.appendChild(style);
}

function setupKeyLocationHintPositioning(hint, preferredPlacement = "above") {
    const popover = hint?.querySelector(".typing-key-popover");
    if (!hint || !popover) return hint;

    const updatePosition = () => {
        const isMobile = window.matchMedia("(max-width: 760px)").matches;
        if (isMobile) {
            const navBottom = document.querySelector("body > nav")?.getBoundingClientRect().bottom ?? 0;
            popover.style.setProperty("--typing-key-popover-mobile-top", `${Math.max(12, Math.ceil(navBottom) + 12)}px`);
            popover.classList.remove("is-below-center");
            return;
        }

        popover.style.removeProperty("--typing-key-popover-mobile-top");
        if (preferredPlacement === "above") {
            const requiredSpace = popover.offsetHeight + 24;
            popover.classList.toggle("is-below-center", hint.getBoundingClientRect().top < requiredSpace);
        }
    };

    hint.addEventListener("pointerenter", updatePosition);
    hint.addEventListener("focusin", updatePosition);
    hint.addEventListener("touchstart", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", () => {
        if (hint.matches(":hover, :focus, :focus-within")) updatePosition();
    }, { passive: true });
    updatePosition();
    return hint;
}

export function renderBackspaceKeyHint(container) {
    if (!container) return null;
    ensureKeyLocationHintStyles();
    container.innerHTML = `
        <span class="typing-key-hint" tabindex="0" aria-label="Backspace 鍵在鍵盤數字列的最右邊">
            <kbd>Backspace</kbd>
            <span class="typing-key-popover" role="tooltip" aria-hidden="true">
                <span class="typing-key-popover-title">Backspace 在數字列最右邊</span>
                <span class="typing-keyboard-strip" aria-hidden="true">
                    <span class="typing-keyboard-strip-row function"><span>Esc</span><span>F1</span><span>F2</span><span>F3</span><span>F4</span><span>F5</span><span>F6</span><span>F7</span><span>F8</span><span>F9</span><span>F10</span><span>F11</span><span>F12</span></span>
                    <span class="typing-keyboard-strip-row number"><span>~</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>0</span><span>-</span><span>=</span><span class="is-backspace">← Backspace</span></span>
                    <span class="typing-keyboard-strip-row letters"><span>Tab</span><span>Q</span><span>W</span><span>E</span><span>R</span><span>T</span><span>Y</span><span>U</span><span>I</span><span>O</span><span>P</span></span>
                </span>
                <span class="typing-key-popover-help">滑鼠移到這裡，或用鍵盤選到提示，就能確認位置。</span>
            </span>
        </span>
    `;
    return setupKeyLocationHintPositioning(container.querySelector('.typing-key-hint'), 'above');
}

export function renderCapsLockKeyHint(container) {
    if (!container) return null;
    ensureKeyLocationHintStyles();
    container.innerHTML = `
        <span class="typing-key-hint caps-lock-location-hint" tabindex="0" aria-label="Caps Lock 鍵在鍵盤左側，位於 Tab 鍵下方">
            <kbd>Caps Lock</kbd>
            <span class="typing-key-popover is-below-left" role="tooltip" aria-hidden="true">
                <span class="typing-key-popover-title">Caps Lock 在鍵盤左側、A 鍵旁邊</span>
                <span class="typing-keyboard-strip" aria-hidden="true">
                    <span class="typing-keyboard-strip-row function"><span>Esc</span><span>F1</span><span>F2</span><span>F3</span><span>F4</span><span>F5</span><span>F6</span><span>F7</span><span>F8</span><span>F9</span><span>F10</span><span>F11</span><span>F12</span></span>
                    <span class="typing-keyboard-strip-row number"><span>~</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>0</span><span>-</span><span>=</span><span>← Backspace</span></span>
                    <span class="typing-keyboard-strip-row letters"><span>Tab</span><span>Q</span><span>W</span><span>E</span><span>R</span><span>T</span><span>Y</span><span>U</span><span>I</span><span>O</span><span>P</span></span>
                    <span class="typing-keyboard-strip-row home"><span class="is-capslock">Caps Lock</span><span>A</span><span>S</span><span>D</span><span>F</span><span>G</span><span>H</span><span>J</span><span>K</span><span>L</span><span>Enter</span></span>
                </span>
                <span class="typing-key-popover-help">滑鼠移到 Caps Lock，或用鍵盤選到它，就能確認位置。</span>
            </span>
        </span>
    `;
    return setupKeyLocationHintPositioning(container.querySelector('.typing-key-hint'), 'below');
}

export function renderShiftKeyHint(container) {
    if (!container) return null;
    ensureKeyLocationHintStyles();
    container.innerHTML = `
        <span class="typing-key-hint shift-location-hint" tabindex="0" aria-label="Shift 鍵在鍵盤最下排的左右兩側">
            <kbd>Shift</kbd>
            <span class="typing-key-popover is-below-left" role="tooltip" aria-hidden="true">
                <span class="typing-key-popover-title">Shift 在鍵盤最下排字母列的左右兩側</span>
                <span class="typing-keyboard-strip" aria-hidden="true">
                    <span class="typing-keyboard-strip-row number"><span>~</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>0</span><span>-</span><span>=</span><span>← Backspace</span></span>
                    <span class="typing-keyboard-strip-row letters"><span>Tab</span><span>Q</span><span>W</span><span>E</span><span>R</span><span>T</span><span>Y</span><span>U</span><span>I</span><span>O</span><span>P</span></span>
                    <span class="typing-keyboard-strip-row home"><span>Caps Lock</span><span>A</span><span>S</span><span>D</span><span>F</span><span>G</span><span>H</span><span>J</span><span>K</span><span>L</span><span>Enter</span></span>
                    <span class="typing-keyboard-strip-row bottom"><span class="is-shift">⇧ Shift</span><span>Z</span><span>X</span><span>C</span><span>V</span><span>B</span><span>N</span><span>M</span><span class="is-shift">Shift ⇧</span></span>
                </span>
                <span class="typing-key-popover-help">左邊或右邊的 Shift 都可以；本週只按一下切換中、英文。</span>
            </span>
        </span>
    `;
    return setupKeyLocationHintPositioning(container.querySelector('.typing-key-hint'), 'below');
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function renderEnglishKeyboardGuide(container, options = {}) {
    if (!container) return null;
    ensureEnglishKeyboardGuideStyles();
    const target = String(options.target ?? "").toLowerCase().replace(/[^a-z]/g, "");
    const targetKeys = new Set(target);
    const sequence = [...target].map(letter => letter.toUpperCase()).join(" → ");
    const rowsHtml = ENGLISH_LETTER_ROWS.map(row => `
        <div class="typing-letter-row">
            ${row.map(letter => `<kbd class="typing-letter-key${targetKeys.has(letter) ? " is-target" : ""}" data-key="${letter}" aria-label="${letter.toUpperCase()} 鍵，輸入小寫 ${letter}${targetKeys.has(letter) ? "，本題需要" : ""}"><span>${letter.toUpperCase()}</span><small>${letter}</small></kbd>`).join("")}
        </div>
    `).join("");
    container.innerHTML = `
        <div class="typing-letter-guide" data-english-keyboard-guide>
            <p class="typing-letter-guide-intro"><strong>先找按鍵位置：</strong>鍵盤印的是大寫字母，但直接按下去會輸入小寫字母。</p>
            <div class="typing-letter-keyboard" aria-label="英文字母按鍵位置示意">${rowsHtml}</div>
            <p class="typing-letter-guide-help">${target ? `請依序找黃色按鍵：<strong class="typing-letter-sequence">${escapeHtml(sequence)}</strong>，再輸入 <strong>${escapeHtml(target)}</strong>。` : "請先看清楚大寫鍵帽與下方的小寫字母。"}</p>
        </div>
    `;
    return container.querySelector("[data-english-keyboard-guide]");
}

function setActiveTab(activeButton, inactiveButton, isActive) {
    activeButton?.classList.toggle("bg-rose-600", isActive);
    activeButton?.classList.toggle("text-white", isActive);
    activeButton?.classList.toggle("bg-slate-100", !isActive);
    activeButton?.classList.toggle("text-slate-700", !isActive);
    inactiveButton?.classList.toggle("bg-rose-600", !isActive);
    inactiveButton?.classList.toggle("text-white", !isActive);
    inactiveButton?.classList.toggle("bg-slate-100", isActive);
    inactiveButton?.classList.toggle("text-slate-700", isActive);
}

function setKeyboardActiveTab(activeButton, inactiveButton, isActive) {
    activeButton?.classList.toggle("bg-indigo-600", isActive);
    activeButton?.classList.toggle("text-white", isActive);
    activeButton?.classList.toggle("bg-slate-100", !isActive);
    activeButton?.classList.toggle("text-slate-700", !isActive);
    inactiveButton?.classList.toggle("bg-indigo-600", !isActive);
    inactiveButton?.classList.toggle("text-white", !isActive);
    inactiveButton?.classList.toggle("bg-slate-100", isActive);
    inactiveButton?.classList.toggle("text-slate-700", isActive);
}

function buildTypingToolsHtml(options = {}) {
    const keyboard = options.showKeyboard ?? options.keyboard ?? true;
    const punctuation = options.showPunctuation ?? options.punctuation ?? true;
    const guidedKeyboard = options.keyboardGuide === true || typeof options.getKeyboardTarget === "function";

    return `
        ${punctuation ? `
        <div class="fixed bottom-6 left-6 z-50 flex flex-col items-start">
            <div id="floating-punc-panel" class="hidden mb-4 bg-white p-3 rounded-2xl shadow-2xl border-4 border-rose-400 max-w-[92vw] md:max-w-[760px] transform transition-all origin-bottom-left">
                <div class="flex justify-between items-center mb-2 px-2 border-b border-gray-100 pb-2 gap-3">
                    <span class="font-black text-rose-800 text-lg"><i class="fa-solid fa-quote-left mr-2"></i>標點符號小幫手</span>
                    <button type="button" data-typing-tool-close="punctuation" class="bg-gray-100 hover:bg-red-500 hover:text-white text-gray-600 rounded-full w-8 h-8 flex items-center justify-center transition" aria-label="關閉標點符號小幫手">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <button id="punctuation-tab-1" type="button" data-punctuation-page="1" class="rounded-xl bg-rose-600 text-white font-black py-2 shadow-sm transition">第 1 頁</button>
                    <button id="punctuation-tab-2" type="button" data-punctuation-page="2" class="rounded-xl bg-slate-100 text-slate-700 font-black py-2 shadow-sm transition">第 2 頁</button>
                </div>
                <div class="max-h-[72vh] overflow-auto rounded-xl border border-gray-200 shadow-sm bg-rose-50">
                    <img id="punctuation-img-1" src="${PUNCTUATION_PAGE_1_URL}" alt="常用標點符號組合鍵第 1 頁" class="w-full">
                    <img id="punctuation-img-2" src="${PUNCTUATION_PAGE_2_URL}" alt="常用標點符號組合鍵第 2 頁" class="hidden w-full">
                </div>
            </div>
            <button type="button" data-typing-tool-toggle="punctuation" class="bg-rose-600 hover:bg-rose-500 text-white px-5 py-3 rounded-full shadow-[0_4px_15px_rgba(244,63,94,0.45)] font-black text-lg flex items-center justify-center transform transition hover:scale-105 border-2 border-white">
                <i class="fa-solid fa-quote-left mr-2 text-2xl"></i> 看標點符號
            </button>
        </div>` : ""}

        ${keyboard ? `
        <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            <div id="floating-kb-panel" class="hidden mb-4 bg-white p-3 rounded-2xl shadow-2xl border-4 border-indigo-400 max-w-[90vw] md:max-w-[680px] transform transition-all origin-bottom-right">
                <div class="flex justify-between items-center mb-2 px-2 border-b border-gray-100 pb-2 gap-3">
                    <span class="font-black text-indigo-800 text-lg"><i class="fa-solid fa-keyboard mr-2"></i>找字小幫手</span>
                    <button type="button" data-typing-tool-close="keyboard" class="bg-gray-100 hover:bg-red-500 hover:text-white text-gray-600 rounded-full w-8 h-8 flex items-center justify-center transition" aria-label="關閉找字小幫手">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                ${guidedKeyboard ? `<div id="floating-letter-key-guide"></div>` : `<div class="grid grid-cols-2 gap-2 mb-3">
                    <button id="keyboard-tab-zh" type="button" data-keyboard-layout="zh" class="rounded-xl bg-indigo-600 text-white font-black py-2 shadow-sm transition">中文鍵盤</button>
                    <button id="keyboard-tab-en" type="button" data-keyboard-layout="en" class="rounded-xl bg-slate-100 text-slate-700 font-black py-2 shadow-sm transition">英文鍵盤</button>
                </div>
                <img id="keyboard-img-zh" src="${ZH_KEYBOARD_URL}" alt="注音鍵盤圖" class="w-full rounded-xl border border-gray-200 shadow-sm">
                <img id="keyboard-img-en" src="${EN_KEYBOARD_URL}" alt="英文鍵盤圖" class="hidden w-full rounded-xl border border-gray-200 shadow-sm">`}
            </div>
            <button type="button" data-typing-tool-toggle="keyboard" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-full shadow-[0_4px_15px_rgba(79,70,229,0.5)] font-black text-lg flex items-center justify-center transform transition hover:scale-105 border-2 border-white">
                <i class="fa-solid fa-keyboard mr-2 text-2xl"></i> 看鍵盤圖
            </button>
        </div>` : ""}
    `;
}

export function initTypingTools(options = {}) {
    if (document.getElementById("typing-tools-root")) {
        return;
    }

    const root = document.createElement("div");
    root.id = "typing-tools-root";
    root.innerHTML = buildTypingToolsHtml(options);
    document.body.appendChild(root);
    const guidedKeyboard = options.keyboardGuide === true || typeof options.getKeyboardTarget === "function";
    const refreshKeyboardGuide = () => {
        if (!guidedKeyboard) return;
        const target = typeof options.getKeyboardTarget === "function"
            ? options.getKeyboardTarget()
            : options.keyboardTarget;
        renderEnglishKeyboardGuide(document.getElementById("floating-letter-key-guide"), { target });
    };

    function toggleFloatingPunctuation() {
        document.getElementById("floating-punc-panel")?.classList.toggle("hidden");
    }

    function toggleFloatingKeyboard() {
        refreshKeyboardGuide();
        document.getElementById("floating-kb-panel")?.classList.toggle("hidden");
    }

    function showPunctuationPage(page) {
        const showFirstPage = Number(page) === 1;
        document.getElementById("punctuation-img-1")?.classList.toggle("hidden", !showFirstPage);
        document.getElementById("punctuation-img-2")?.classList.toggle("hidden", showFirstPage);
        setActiveTab(
            document.getElementById("punctuation-tab-1"),
            document.getElementById("punctuation-tab-2"),
            showFirstPage
        );
    }

    function showKeyboardLayout(layout) {
        const showZh = layout === "zh";
        document.getElementById("keyboard-img-zh")?.classList.toggle("hidden", !showZh);
        document.getElementById("keyboard-img-en")?.classList.toggle("hidden", showZh);
        setKeyboardActiveTab(
            document.getElementById("keyboard-tab-zh"),
            document.getElementById("keyboard-tab-en"),
            showZh
        );
    }

    root.querySelector("[data-typing-tool-toggle='punctuation']")?.addEventListener("click", toggleFloatingPunctuation);
    root.querySelector("[data-typing-tool-close='punctuation']")?.addEventListener("click", toggleFloatingPunctuation);
    root.querySelector("[data-typing-tool-toggle='keyboard']")?.addEventListener("click", toggleFloatingKeyboard);
    root.querySelector("[data-typing-tool-close='keyboard']")?.addEventListener("click", toggleFloatingKeyboard);
    root.querySelectorAll("[data-punctuation-page]").forEach((button) => {
        button.addEventListener("click", () => showPunctuationPage(button.dataset.punctuationPage));
    });
    root.querySelectorAll("[data-keyboard-layout]").forEach((button) => {
        button.addEventListener("click", () => showKeyboardLayout(button.dataset.keyboardLayout));
    });
    refreshKeyboardGuide();
    return { refreshKeyboardGuide };
}
