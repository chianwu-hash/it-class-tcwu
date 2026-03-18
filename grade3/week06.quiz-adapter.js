import { initQuizModule } from "../shared/quiz-module.js";

export function initWeek06QuizAdapter({
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
            completedBanner: (score, total) => `你已經完成這次的資安測驗！上次得分：${score ?? "?"} / ${total} 分。`,
            unauthenticated: "登入 Google 後，才能開始這一區的資安測驗。",
            resultMessages: {
                perfect: ["🏆", "太棒了！全部答對！你是網路安全小達人！"],
                great: ["🎉", "答對很多題了！你已經很注意網路安全重點。"],
                good: ["👍", "做得不錯，代表你已經記住一部分的資安觀念。"],
                retry: ["🔁", "先別急，再讀一次題目，你一定可以找出更安全的答案。"]
            }
        },
        loadProgress,
        saveProgress,
        getCurrentUser,
        onRequireLogin,
        onAfterSubmit
    });
}
