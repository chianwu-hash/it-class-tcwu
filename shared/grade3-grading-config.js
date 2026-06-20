export const GRADE3_GRADING_CONFIG = {
    grade: "grade3",
    schoolYear: "114",
    semester: "2",
    subjectCode: "A08_13_00",
    quizWeight: 0.4,
    typingWeight: 0.6,
    baseScore: 80,
    prScoreRange: 20,
    descriptionMaxLength: 200,
    exemptStudentCodes: ["30127", "30227", "30414"],
    quiz: [
        { weekCode: "06", activityKey: "safety_quiz_1", title: "第 6 週 資安測驗", totalQuestions: 5, counted: true },
        { weekCode: "07", activityKey: "privacy_quiz_1", title: "第 7 週 個資測驗", totalQuestions: 5, counted: true },
        { weekCode: "11", activityKey: "etiquette_quiz_1", title: "第 11 週 網路禮儀測驗", totalQuestions: 5, counted: true },
        { weekCode: "12", activityKey: "media_literacy_quiz_1", title: "第 12 週 媒體識讀測驗", totalQuestions: 5, counted: true },
        { weekCode: "13", activityKey: "internet_addiction_quiz_1", title: "第 13 週 網路沉迷測驗", totalQuestions: 5, counted: true },
        { weekCode: "14", activityKey: "phishing_safety_quiz_1", title: "第 14 週 資訊素養測驗", totalQuestions: 5, counted: true },
        { weekCode: "15", activityKey: "screen_time_quiz_1", title: "第 15 週 螢幕時間測驗", totalQuestions: 5, counted: true },
        { weekCode: "16", activityKey: "copyright_cc_quiz_1", title: "第 16 週 著作權測驗", totalQuestions: 5, counted: true }
    ],
    typing: [
        { weekCode: "04", activityKey: "typing_task_2", title: "第 4 週 打字闖關", totalLevels: 5, counted: true },
        { weekCode: "05", activityKey: "typing_task_3", title: "第 5 週 打字闖關", totalLevels: 5, counted: true },
        { weekCode: "06", activityKey: "typing_task_4", title: "第 6 週 打字闖關", totalLevels: 5, counted: true },
        { weekCode: "07", activityKey: "typing_task_5", title: "第 7 週 打字闖關", totalLevels: 5, counted: true },
        { weekCode: "10", activityKey: "typing_task_2", title: "第 10 週 打字闖關", totalLevels: 2, counted: true },
        { weekCode: "12", activityKey: "typing_task_5", title: "第 12 週 打字闖關", totalLevels: 5, counted: true },
        { weekCode: "13", activityKey: "typing_task_5", title: "第 13 週 打字闖關", totalLevels: 5, counted: true },
        { weekCode: "14", activityKey: "typing_task_5", title: "第 14 週 打字闖關", totalLevels: 5, counted: true },
        { weekCode: "15", activityKey: "typing_task_5", title: "第 15 週 打字闖關", totalLevels: 5, counted: true },
        { weekCode: "16", activityKey: "typing_task_5", title: "第 16 週 打字闖關", totalLevels: 5, counted: true }
    ],
    effortThresholds: [
        { minScore: 90, effort: "1" },
        { minScore: 80, effort: "2" },
        { minScore: 0, effort: "3" }
    ],
    descriptions: {
        quiz: {
            high: "能掌握網路安全、個資保護、媒體識讀與著作權等資訊素養觀念",
            mid: "已具備基本資訊素養觀念，部分主題可再複習",
            low: "資訊素養測驗完成度較低，需補強網路安全與著作權觀念"
        },
        typing: {
            high: "能穩定完成中英打闖關，輸入正確性與持續練習表現佳",
            mid: "已完成部分中英打闖關，需持續提升鍵盤輸入熟練度",
            low: "中英打闖關完成度較低，需持續練習鍵盤輸入"
        }
    }
};

export function getGrade3QuizTotal(config = GRADE3_GRADING_CONFIG) {
    return config.quiz
        .filter((item) => item.counted)
        .reduce((sum, item) => sum + item.totalQuestions, 0);
}

export function getGrade3TypingTotalPoints(config = GRADE3_GRADING_CONFIG) {
    return config.typing
        .filter((item) => item.counted)
        .reduce((sum, item) => sum + item.totalLevels * (item.totalLevels + 1) / 2, 0);
}
