import { initQuizModule } from "../shared/quiz-module.js";

export function initWeek11QuizAdapter({
    loadProgress,
    saveProgress,
    getCurrentUser,
    onRequireLogin,
    onAfterSubmit
}) {
    const questions = [
        {
            id: 1,
            q: "在網路群組和同學討論功課，一直傳「快點啦！！你很慢耶！！」再加上很多個驚嘆號，同學可能會有什麼感受？",
            opts: [
                { text: "A. 感覺你很有禮貌", correct: false },
                { text: "B. 感覺你在對他大聲吼叫", correct: true },
                { text: "C. 感覺你在開玩笑", correct: false },
                { text: "D. 感覺你打字很快", correct: false }
            ]
        },
        {
            id: 2,
            q: "收到別人傳來讓你難過的訊息，最好的做法是？",
            opts: [
                { text: "A. 馬上回罵回去", correct: false },
                { text: "B. 把訊息截圖，告訴老師或家長", correct: true },
                { text: "C. 轉傳給全班讓大家評評理", correct: false },
                { text: "D. 直接刪掉不管他", correct: false }
            ]
        },
        {
            id: 3,
            q: "有人一直重複傳一樣的貼圖給你，這種行為叫做什麼？",
            opts: [
                { text: "A. 認真溝通", correct: false },
                { text: "B. 表達友善", correct: false },
                { text: "C. 可能讓對方覺得被騷擾", correct: true },
                { text: "D. 很有趣的方式", correct: false }
            ]
        },
        {
            id: 4,
            q: "在網路群組裡，把別人私下告訴你的秘密說給大家聽，這樣做對嗎？",
            opts: [
                { text: "A. 對，讓大家都知道比較安全", correct: false },
                { text: "B. 不對，這樣可能傷害對方", correct: true },
                { text: "C. 對，網路上說說沒關係", correct: false },
                { text: "D. 不對，但轉傳給 2 個人就好", correct: false }
            ]
        },
        {
            id: 5,
            q: "不認識的人傳來一個連結說「點這裡有好東西」，你應該怎麼做？",
            opts: [
                { text: "A. 趕快點開看看", correct: false },
                { text: "B. 先轉給同學讓他點", correct: false },
                { text: "C. 不要點，告訴老師或家長", correct: true },
                { text: "D. 點開後如果沒問題再說", correct: false }
            ]
        }
    ];

    return initQuizModule({
        questions: questions.map((item) => ({
            id: item.id,
            questionHtml: item.q,
            options: item.opts
        })),
        selectors: {
            lock: "quiz-lock",
            content: "quiz-content",
            container: "quiz-container",
            statusBanner: "quiz-status-banner",
            statusText: "quiz-status-text"
        },
        messages: {
            questionLabel: (index) => `第 ${index} 題`,
            submitButton: "完成作答！",
            submittedButton: "已完成作答",
            unansweredAlert: (remaining) => `還有 ${remaining} 題未作答，先檢查一下再送出。`,
            scoreLabel: (correct, total) => `得分：${correct} / ${total} 分`,
            completedBanner: (score, total) => `你已經完成這次的網路禮儀測驗！上次得分：${score ?? "?"} / ${total} 分。`,
            unauthenticated: "登入 Google 後，才能開始這一區的網路禮儀測驗。",
            resultMessages: {
                perfect: ["🏆", "太棒了！全部答對！你是網路禮儀小模範！"],
                great: ["🎉", "答對很多題了！你已經記住重要的網路溝通方式。"],
                good: ["👍", "做得不錯，你已經知道不少網路禮節。"],
                retry: ["🔁", "先別急，再看一次題目，你一定可以選出更有禮貌的做法。"]
            }
        },
        loadProgress,
        saveProgress,
        getCurrentUser,
        onRequireLogin,
        onAfterSubmit
    });
}
