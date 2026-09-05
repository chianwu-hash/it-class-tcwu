import {
    GRADE3_GRADING_CONFIG,
    getGrade3QuizTotal,
    getGrade3TypingTotalPoints
} from "./grade3-grading-config.js";

function clamp(value, min, max) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return min;
    return Math.min(Math.max(numberValue, min), max);
}

function normalizeText(value) {
    return String(value ?? "").trim().normalize("NFC");
}

function progressKey(userId, courseId, weekCode, activityKey) {
    return [
        userId || "",
        String(courseId || "").toLowerCase(),
        String(weekCode || "").padStart(2, "0"),
        String(activityKey || "").toLowerCase()
    ].join("|");
}

function triangularPoints(levels) {
    return levels * (levels + 1) / 2;
}

function passedTypingLevels(progress, totalLevels) {
    if (!progress) return 0;
    if (progress.completed) return totalLevels;
    return clamp((Number(progress.current_level) || 1) - 1, 0, totalLevels);
}

function buildProfilesByStudentCode(profiles = []) {
    const profilesByCode = new Map();
    const duplicates = new Set();

    for (const profile of profiles) {
        const code = String(profile.student_code || "").trim();
        if (!code) continue;
        if (profilesByCode.has(code)) {
            duplicates.add(code);
            continue;
        }
        profilesByCode.set(code, profile);
    }

    return { profilesByCode, duplicates };
}

function buildProgressByUserWeekActivity(progressRows = []) {
    return new Map(progressRows.map((row) => [
        progressKey(row.user_id, row.course_id, row.week_code, row.activity_key),
        row
    ]));
}

function percentileByAverageRank(items, valueSelector) {
    const sorted = [...items]
        .map((item, index) => ({ item, index, value: Number(valueSelector(item)) || 0 }))
        .sort((a, b) => a.value - b.value);
    const n = sorted.length;
    const result = new Map();

    if (n === 0) return result;
    if (n === 1) {
        result.set(sorted[0].item, 100);
        return result;
    }

    let start = 0;
    while (start < n) {
        let end = start;
        while (end + 1 < n && sorted[end + 1].value === sorted[start].value) {
            end += 1;
        }

        const averageRank = (start + 1 + end + 1) / 2;
        const percentile = ((averageRank - 1) / (n - 1)) * 100;
        for (let i = start; i <= end; i += 1) {
            result.set(sorted[i].item, percentile);
        }
        start = end + 1;
    }

    return result;
}

function effortForScore(score, config) {
    const threshold = config.effortThresholds.find((item) => score >= item.minScore);
    return threshold?.effort || "3";
}

function descriptionLevel(rate) {
    if (rate >= 0.8) return "high";
    if (rate >= 0.35) return "mid";
    return "low";
}

function descriptionForRow(row, config) {
    const quizLevel = descriptionLevel(row.quizRaw);
    const typingLevel = descriptionLevel(row.typingRaw);
    const quizText = config.descriptions.quiz?.[quizLevel] || "";
    const typingText = config.descriptions.typing?.[typingLevel] || "";
    const description = `資訊素養：${quizText}；中英打能力：${typingText}。`;
    return description.slice(0, config.descriptionMaxLength);
}

function calculateQuizCorrect(profile, progressByKey, config) {
    if (!profile?.user_id) return 0;

    return config.quiz
        .filter((activity) => activity.counted)
        .reduce((sum, activity) => {
            const progress = progressByKey.get(progressKey(profile.user_id, config.courseId, activity.weekCode, activity.activityKey));
            if (!progress?.completed) return sum;
            return sum + clamp(progress.score, 0, activity.totalQuestions);
        }, 0);
}

function calculateTypingPoints(profile, progressByKey, config) {
    if (!profile?.user_id) return 0;

    return config.typing
        .filter((activity) => activity.counted)
        .reduce((sum, activity) => {
            const progress = progressByKey.get(progressKey(profile.user_id, config.courseId, activity.weekCode, activity.activityKey));
            const passedLevels = passedTypingLevels(progress, activity.totalLevels);
            return sum + triangularPoints(passedLevels);
        }, 0);
}

function progressCountForProfile(profile, progressByKey, config) {
    if (!profile?.user_id) return 0;
    const countedActivities = [
        ...config.quiz.filter((activity) => activity.counted),
        ...config.typing.filter((activity) => activity.counted)
    ];
    return countedActivities.filter((activity) => (
        progressByKey.has(progressKey(profile.user_id, config.courseId, activity.weekCode, activity.activityKey))
    )).length;
}

export function calculateGrade3Grades({
    rosterRows = [],
    profiles = [],
    progressRows = [],
    config = GRADE3_GRADING_CONFIG,
    exemptStudentCodes = config.exemptStudentCodes,
    quizWeight = config.quizWeight,
    typingWeight = config.typingWeight
} = {}) {
    const { profilesByCode, duplicates } = buildProfilesByStudentCode(profiles);
    const progressByKey = buildProgressByUserWeekActivity(progressRows);
    const exemptCodes = new Set(exemptStudentCodes.map((code) => String(code).trim()).filter(Boolean));
    const quizTotal = getGrade3QuizTotal(config);
    const typingTotal = getGrade3TypingTotalPoints(config);
    const weightTotal = Number(quizWeight) + Number(typingWeight);
    const safeQuizWeight = weightTotal > 0 ? Number(quizWeight) / weightTotal : config.quizWeight;
    const safeTypingWeight = weightTotal > 0 ? Number(typingWeight) / weightTotal : config.typingWeight;

    const rows = rosterRows.map((roster) => {
        const studentCode = String(roster.studentCode || "").trim();
        const profile = profilesByCode.get(studentCode) || null;
        const isExempt = exemptCodes.has(studentCode);
        const quizCorrect = calculateQuizCorrect(profile, progressByKey, config);
        const typingPoints = calculateTypingPoints(profile, progressByKey, config);
        const progressCount = progressCountForProfile(profile, progressByKey, config);
        const warnings = [];

        if (duplicates.has(studentCode)) {
            warnings.push("student_code 重複");
        }
        if (!profile && !isExempt) {
            warnings.push("找不到 student profile");
        }
        if (profile && normalizeText(profile.display_name) && normalizeText(profile.display_name) !== normalizeText(roster.name)) {
            warnings.push("姓名與 student profile 不一致");
        }
        if (!isExempt && profile && progressCount === 0) {
            warnings.push("沒有任何計分進度");
        }

        return {
            ...roster,
            studentCode,
            profile,
            userId: profile?.user_id || null,
            email: profile?.email || null,
            isExempt,
            quizCorrect,
            quizTotal,
            quizRaw: quizTotal > 0 ? quizCorrect / quizTotal : 0,
            typingPoints,
            typingTotal,
            typingRaw: typingTotal > 0 ? typingPoints / typingTotal : 0,
            progressCount,
            warnings
        };
    });

    const classCodes = Array.from(new Set(rows.map((row) => row.classCode).filter(Boolean)));
    for (const classCode of classCodes) {
        const classRows = rows.filter((row) => row.classCode === classCode && !row.isExempt);
        const quizPrByRow = percentileByAverageRank(classRows, (row) => row.quizRaw);
        const typingPrByRow = percentileByAverageRank(classRows, (row) => row.typingRaw);

        for (const row of classRows) {
            row.quizPR = quizPrByRow.get(row) ?? 0;
            row.typingPR = typingPrByRow.get(row) ?? 0;
        }
    }

    for (const row of rows) {
        if (row.isExempt) {
            row.quizPR = null;
            row.typingPR = null;
            row.quizScore = null;
            row.typingScore = null;
            row.termScore = null;
            row.effort = "";
            row.description = "";
            continue;
        }

        row.quizPR = row.quizPR ?? 0;
        row.typingPR = row.typingPR ?? 0;
        row.quizScore = config.baseScore + row.quizPR * config.prScoreRange / 100;
        row.typingScore = config.baseScore + row.typingPR * config.prScoreRange / 100;
        row.termScore = Math.round(row.quizScore * safeQuizWeight + row.typingScore * safeTypingWeight);
        row.effort = effortForScore(row.termScore, config);
        row.description = descriptionForRow(row, config);
    }

    return {
        rows,
        meta: {
            quizTotal,
            typingTotal,
            quizWeight: safeQuizWeight,
            typingWeight: safeTypingWeight,
            exemptStudentCodes: Array.from(exemptCodes)
        }
    };
}
