import { initQuizModule } from "../shared/quiz-module.js";

export function initWeek07QuizAdapter({
    questions,
    loadProgress,
    saveProgress,
    getCurrentUser,
    onRequireLogin,
    onAfterSubmit
}) {
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
            submitButton: "送出我的答案！",
            submittedButton: "已完成作答",
            unansweredAlert: (remaining) => `還有 ${remaining} 題未作答，先檢查一下再送出。`,
            scoreLabel: (correct, total) => `得分：${correct} / ${total} 分`,
            completedBanner: (score, total) => `你已經完成這次的個資保護測驗！上次得分：${score ?? "?"} / ${total} 分。`,
            unauthenticated: "登入 Google 後，才能開始這一區的個資保護測驗。",
            resultMessages: {
                perfect: ["🛡️", "太棒了！全部答對！你是個資保護小達人！"],
                great: ["🎉", "答對很多題了！你已經記住重要的保護方法。"],
                good: ["👍", "做得不錯，你已經知道不少保護自己的方法。"],
                retry: ["🔁", "先別急，再看一次題目，你一定可以選出更安全的做法。"]
            }
        },
        loadProgress,
        saveProgress,
        getCurrentUser,
        onRequireLogin,
        onAfterSubmit
    });
}
