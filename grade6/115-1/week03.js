import { initNavbarAuth } from "../../shared/navbar-auth.js";
import { initTypingChallenge } from "../../shared/typing-challenge.js";
import { initTypingTools } from "../../shared/typing-tools.js";

const WEEK_CODE = "03";

const levelsData = [
    { id: 1, ans: "I'm Ella.\nI'm from France.\nI go biking every day.\nI want to be a cyclist one day." },
    { id: 2, ans: "Is she from Canada?\nNo, she's not.\nIs she from Taiwan?\nYes, she is.\nShe's Ivy.\nYou're right." },
    { id: 3, ans: "人生的價值在於不斷超越昨日的自己。\n更快、更高、更強！" },
    { id: 4, ans: "首先，我們可以找出自己的優勢或亮點，\n設定好目標，\n一步一腳印，\n不驕傲自滿，\n穩健踏實的前進；" },
    { id: 5, ans: "I'm Ella.\nI'm from France.\nI go biking every day.\n因為耕耘與收穫往往不在同一個季節，\n中間隔著一段時間，\n名為「堅持」。" }
];

const levelMeta = [
    { tone: "cyan", icon: "fa-person-biking", title: "Ella 的夢想", note: "四行英文，注意 France、cyclist、縮寫符號和句點。" },
    { tone: "emerald", icon: "fa-earth-asia", title: "猜猜 Ivy 來自哪裡", note: "六行英文對話，問號、逗號、縮寫和大小寫都要一致。" },
    { tone: "blue", icon: "fa-arrow-trend-up", title: "超越昨日的自己", note: "兩行中文，注意驚嘆號與換行。" },
    { tone: "orange", icon: "fa-shoe-prints", title: "一步一腳印", note: "五行中文，留意頓號、逗號與最後的分號。" },
    { tone: "purple", icon: "fa-crown", title: "中英混打魔王關", note: "英文三行加中文三行，切換輸入法後再逐行檢查。" }
];

const levelEncouragements = {
    1: "你把 Ella 的介紹逐行打準，清楚注意了大小寫與句點。",
    2: "你完成六行對話，問號、縮寫與換行都檢查得很仔細。",
    3: "你把中文標點和換行一起完成，正在超越昨天的自己。",
    4: "長段落需要耐心，你用一步一腳印的方法完成了。",
    5: "你完成中英切換魔王關；省下來的時間，可以拿去讀得更深。"
};

function renderTypingLevels() {
    const container = document.getElementById("typing-levels-container");
    if (!container) return;

    levelsData.forEach((level, index) => {
        const meta = levelMeta[index];
        const block = document.createElement("article");
        block.id = `block-level${level.id}`;
        block.className = "level-card";
        block.classList.toggle("hidden", index > 0);
        block.dataset.tone = meta.tone;

        const badge = document.createElement("div");
        badge.className = "level-badge absolute -top-4 -left-3 text-white px-4 py-1 rounded-full font-black shadow-md -rotate-3";
        badge.textContent = `第 ${level.id} 關`;

        const title = document.createElement("h4");
        title.className = "level-title text-xl font-black mb-2 flex items-center gap-2";
        title.innerHTML = `<i class="fa-solid ${meta.icon}" aria-hidden="true"></i><span></span>`;
        title.querySelector("span").textContent = meta.title;

        const note = document.createElement("p");
        note.className = "text-slate-600 font-bold text-sm mb-3";
        note.textContent = meta.note;

        const target = document.createElement("pre");
        target.className = "level-target level-copy text-lg sm:text-2xl font-black text-center tracking-wide mb-4 py-4 px-3 rounded-xl shadow-inner";
        target.textContent = level.ans;

        const input = document.createElement("textarea");
        input.disabled = true;
        input.id = `input-level${level.id}`;
        input.rows = Math.min(8, level.ans.split("\n").length + 2);
        input.className = "level-input w-full p-3 rounded-xl bg-white focus:outline-none font-bold text-slate-800 text-lg sm:text-xl text-center mb-4 transition placeholder:text-base placeholder:text-slate-400";
        input.placeholder = "請逐行打出上方內容";
        input.autocomplete = "off";
        input.autocorrect = "off";
        input.autocapitalize = "off";
        input.spellcheck = false;
        input.dataset.formType = "other";
        input.addEventListener("paste", (event) => event.preventDefault());
        input.addEventListener("drop", (event) => event.preventDefault());

        const button = document.createElement("button");
        button.disabled = true;
        button.type = "button";
        button.className = "level-check w-full text-white font-black text-lg py-3 rounded-xl shadow-md transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-55";
        button.setAttribute("onclick", `checkLevel(${level.id})`);
        button.innerHTML = '<i class="fa-solid fa-paper-plane mr-2" aria-hidden="true"></i>檢查答案';

        const message = document.createElement("p");
        message.id = `msg-level${level.id}`;
        message.className = "text-center font-bold mt-4 min-h-12 text-base leading-relaxed";
        message.setAttribute("aria-live", "polite");

        block.append(badge, title, note, target, input, button, message);
        container.appendChild(block);
    });
}

function buildHint(userValue, targetValue) {
    const userLines = userValue.split("\n");
    const targetLines = targetValue.split("\n");
    const maxLines = Math.max(userLines.length, targetLines.length);

    for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
        const userLine = userLines[lineIndex] || "";
        const targetLine = targetLines[lineIndex] || "";
        if (userLine === targetLine) continue;

        if (!userLine && targetLine) {
            return `提示：第 ${lineIndex + 1} 行還沒完成，看看是不是少了整行。`;
        }
        if (userLine && !targetLine) {
            return `提示：第 ${lineIndex + 1} 行多出內容，請檢查換行或句尾。`;
        }

        const maxChars = Math.max(userLine.length, targetLine.length);
        for (let charIndex = 0; charIndex < maxChars; charIndex += 1) {
            if (userLine[charIndex] === targetLine[charIndex]) continue;
            const nearby = targetLine.slice(Math.max(0, charIndex - 2), charIndex + 3);
            if (!userLine[charIndex]) {
                return `提示：第 ${lineIndex + 1} 行可能少字，從「${nearby}」附近再看一次。`;
            }
            if (!targetLine[charIndex]) {
                return `提示：第 ${lineIndex + 1} 行可能多打了字，請檢查句尾。`;
            }
            return `提示：第 ${lineIndex + 1} 行第 ${charIndex + 1} 個字附近不同，從「${nearby}」附近再看一次。`;
        }
    }

    return "提示：再檢查大小寫、空格、標點與換行。";
}

function initReadingTimer() {
    const display = document.getElementById("reading-timer-display");
    const status = document.getElementById("reading-timer-status");
    const startButton = document.getElementById("reading-timer-start");
    const resetButton = document.getElementById("reading-timer-reset");
    if (!display || !status || !startButton || !resetButton) return;

    let remainingSeconds = 600;
    let intervalId = null;

    const render = () => {
        const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
        const seconds = String(remainingSeconds % 60).padStart(2, "0");
        display.textContent = `${minutes}:${seconds}`;
    };

    const stop = () => {
        if (intervalId !== null) window.clearInterval(intervalId);
        intervalId = null;
        startButton.innerHTML = '<i class="fa-solid fa-play mr-2" aria-hidden="true"></i>繼續';
    };

    startButton.addEventListener("click", () => {
        if (remainingSeconds === 0) return;
        if (intervalId !== null) {
            stop();
            status.textContent = "計時已暫停；準備好後再繼續。";
            return;
        }

        startButton.innerHTML = '<i class="fa-solid fa-pause mr-2" aria-hidden="true"></i>暫停';
        status.textContent = "安靜閱讀中；停在有意思的地方時，先記在心裡。";
        intervalId = window.setInterval(() => {
            remainingSeconds -= 1;
            render();
            if (remainingSeconds > 0) return;
            stop();
            startButton.disabled = true;
            startButton.innerHTML = '<i class="fa-solid fa-check mr-2" aria-hidden="true"></i>閱讀完成';
            status.textContent = "10 分鐘完成！接著分享一張閱讀小卡。";
            window.confetti?.({ particleCount: 90, spread: 70, origin: { y: 0.72 } });
        }, 1000);
    });

    resetButton.addEventListener("click", () => {
        stop();
        remainingSeconds = 600;
        startButton.disabled = false;
        startButton.innerHTML = '<i class="fa-solid fa-play mr-2" aria-hidden="true"></i>開始 10 分鐘';
        status.textContent = "選好書、坐好，再按開始。";
        render();
    });

    render();
}

renderTypingLevels();
initNavbarAuth();
initReadingTimer();
initTypingTools();

const typingToolsRoot = document.getElementById("typing-tools-root");
const typingSection = document.getElementById("typing-section");
if (typingToolsRoot && typingSection && "IntersectionObserver" in window) {
    typingToolsRoot.classList.add("hidden");
    const observer = new IntersectionObserver((entries) => {
        typingToolsRoot.classList.toggle("hidden", !entries.some((entry) => entry.isIntersecting));
    }, { rootMargin: "120px 0px 120px 0px" });
    observer.observe(typingSection);
}

initTypingChallenge({
    weekCode: WEEK_CODE,
    courseId: "grade6-115-1",
    activityKey: "typing_task_5",
    draftOptions: { enabled: true },
    levelsData,
    levelEncouragements,
    buildHint,
    getWrongAnswerHtml: ({ hint }) => `還差一點點。${hint}`,
    progressMessages: {
        completed: "5 關全部完成。接著選擇深度閱讀、依指引協助同學，或安靜休息。",
        resumed: (level) => `已接回 Week 03 打字進度，從第 ${level} 關繼續。`,
        firstLogin: "已登入成功，這次的打字進度會自動記錄。",
        unauthenticated: "請先登入學校 Google 帳號，才能開始並記錄中英打進度。",
        saveCompleted: "已記下 5 關完整進度。去看看完成後可以怎麼安排。",
        saveNextLevel: (level) => `已記下進度，下次從第 ${level} 關繼續。`,
        saveError: "進度暫時沒有記錄成功，請留在本頁稍後再試。",
        resetNoSession: "目前沒有登入，不能重新開始練習。",
        resetConfirm: "要重新開始 Week 03 打字練習嗎？這會把進度重設回第 1 關。"
    },
    celebrationContent: {
        title: "第 03 週魔王關完成",
        message: "你已完成老師指定的中英打任務。速度不是終點，把省下來的時間用來閱讀、幫助別人或好好休息。",
        buttonText: "查看完成後選擇",
        buttonHref: "#fast-finisher"
    }
});
