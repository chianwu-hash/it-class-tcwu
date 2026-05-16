import { getActivityId } from "./reward-tree-config.js";

function clampNumber(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return min;
    }
    return Math.max(min, Math.min(numeric, max));
}

function formatDateTime(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return date.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function createReward({ kind, source = {}, activity, index, total, earned = true, href = "" }) {
    const isQuiz = kind === "quiz-leaf";
    const isFlower = kind === "flower";
    return {
        id: `${getActivityId(activity.weekCode, activity.activityKey)}:${kind}:${index}`,
        kind,
        earned,
        href,
        weekCode: activity.weekCode,
        activityKey: activity.activityKey,
        label: activity.label,
        title: isFlower
            ? `${activity.label} ${earned ? "魔王花" : "尚未開放的魔王花"}`
            : isQuiz
                ? `${activity.label} ${earned ? "測驗葉" : "尚未完成的測驗葉"}`
                : `${activity.label} 第 ${index} 關${earned ? "葉" : "尚未完成的葉"}`,
        reason: isFlower
            ? earned
                ? "完成每週最後一關，開出一朵魔王花。"
                : "完成這週最後一關，就能開出魔王花。"
            : isQuiz
                ? earned
                    ? "完成測驗，長出一片藍綠色葉子。"
                    : "完成這個測驗，就能長出藍綠色葉子。"
                : earned
                    ? "完成打字關卡，長出一片葉子。"
                    : "完成這一關，就能長出一片葉子。",
        detail: isFlower
            ? earned
                ? `完成 ${total} 關打字闖關。`
                : `前往第 ${total} 關挑戰魔王關。`
            : isQuiz
                ? earned
                    ? `測驗已完成${source.score === null || source.score === undefined ? "。" : `，分數 ${source.score}。`}`
                    : "前往測驗區完成挑戰。"
                : earned
                    ? `打字闖關進度 ${index} / ${Math.max(1, total - 1)}。`
                    : `前往第 ${index} 關繼續挑戰。`,
        updatedAt: source.updated_at || "",
        updatedAtText: formatDateTime(source.updated_at),
        score: source.score ?? null
    };
}

function buildTypingHref(activity, level) {
    return `${activity.pageHref || `/grade3/week${activity.weekCode}.html`}#block-level${level}`;
}

function buildQuizHref(activity) {
    return `${activity.pageHref || `/grade3/week${activity.weekCode}.html`}#quiz-lock`;
}

export function deriveRewardTreeModel(progressRows, activities) {
    const rows = Array.isArray(progressRows) ? progressRows : [];
    const rowByActivity = new Map(
        rows.map((row) => [getActivityId(row.week_code, row.activity_key), row])
    );
    const knownIds = new Set(
        activities.map((activity) => getActivityId(activity.weekCode, activity.activityKey))
    );
    const rewards = [];
    const pendingRewards = [];
    const skippedActivities = [];
    const unknownRows = rows.filter((row) => !knownIds.has(getActivityId(row.week_code, row.activity_key)));

    activities.forEach((activity) => {
        const row = rowByActivity.get(getActivityId(activity.weekCode, activity.activityKey)) || {
            week_code: activity.weekCode,
            activity_key: activity.activityKey,
            current_level: 0,
            completed: false,
            score: null,
            updated_at: ""
        };

        if (activity.type === "typing") {
            const totalLevels = Number(activity.totalLevels);
            if (!Number.isInteger(totalLevels) || totalLevels < 2) {
                skippedActivities.push(activity);
                return;
            }

            const maxLeaves = totalLevels - 1;
            const leafCount = row.completed === true
                ? maxLeaves
                : clampNumber(Number(row.current_level ?? 0) - 1, 0, maxLeaves);

            for (let index = 1; index <= maxLeaves; index += 1) {
                const isEarned = index <= leafCount;
                const reward = createReward({
                    kind: "typing-leaf",
                    source: row,
                    activity,
                    index,
                    total: totalLevels,
                    earned: isEarned,
                    href: isEarned ? "" : buildTypingHref(activity, index)
                });

                if (isEarned) {
                    rewards.push(reward);
                } else {
                    pendingRewards.push(reward);
                }
            }

            if (row.completed === true) {
                rewards.push(createReward({
                    kind: "flower",
                    source: row,
                    activity,
                    index: totalLevels,
                    total: totalLevels,
                    earned: true
                }));
            } else {
                pendingRewards.push(createReward({
                    kind: "flower",
                    source: row,
                    activity,
                    index: totalLevels,
                    total: totalLevels,
                    earned: false,
                    href: buildTypingHref(activity, totalLevels)
                }));
            }
            return;
        }

        if (activity.type === "quiz") {
            if (row.completed === true) {
                rewards.push(createReward({
                    kind: "quiz-leaf",
                    source: row,
                    activity,
                    index: 1,
                    total: 1,
                    earned: true
                }));
            } else {
                pendingRewards.push(createReward({
                    kind: "quiz-leaf",
                    source: row,
                    activity,
                    index: 1,
                    total: 1,
                    earned: false,
                    href: buildQuizHref(activity)
                }));
            }
            return;
        }

        skippedActivities.push(activity);
    });

    const leaves = rewards.filter((reward) => reward.kind !== "flower");
    const flowers = rewards.filter((reward) => reward.kind === "flower");
    const pendingLeaves = pendingRewards.filter((reward) => reward.kind !== "flower");
    const pendingFlowers = pendingRewards.filter((reward) => reward.kind === "flower");

    return {
        rewards,
        pendingRewards,
        leaves,
        flowers,
        pendingLeaves,
        pendingFlowers,
        stats: {
            leafCount: leaves.length,
            flowerCount: flowers.length,
            pendingLeafCount: pendingLeaves.length,
            pendingFlowerCount: pendingFlowers.length,
            colorUnlocked: flowers.length >= 3,
            nextFlowerUnlock: Math.max(0, 3 - flowers.length),
            unknownRowCount: unknownRows.length,
            skippedActivityCount: skippedActivities.length
        },
        unknownRows,
        skippedActivities
    };
}

export function createFullCompletionRows(activities) {
    return activities.map((activity) => ({
        week_code: activity.weekCode,
        activity_key: activity.activityKey,
        current_level: activity.type === "typing" ? activity.totalLevels : 5,
        completed: true,
        score: activity.type === "quiz" ? 5 : null,
        updated_at: "2026-05-15T12:00:00.000Z"
    }));
}
