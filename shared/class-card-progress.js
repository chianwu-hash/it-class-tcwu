import { supabase } from './auth.js';

function clampScore(value, total) {
    return Math.max(0, Math.min(total, Number(value) || 0));
}

function normalizeProgress(progress, total) {
    const explicitCompleted = Boolean(progress?.completed);
    const rawScore = explicitCompleted ? total : clampScore(progress?.score ?? ((Number(progress?.current_level) || 1) - 1), total);
    const completed = explicitCompleted || rawScore >= total;
    const score = completed ? total : rawScore;
    const currentLevel = completed ? total : Math.max(1, Math.min(total, Number(progress?.current_level) || score + 1));
    return { score, completed, current_level: currentLevel };
}

export function createClassCardProgress({ courseId, weekCode, activityKey, total, getIdentity }) {
    async function load() {
        const identity = getIdentity?.();
        if (!identity?.birthdayCode || identity.source !== 'rpc') return null;
        const { data, error } = await supabase.rpc('get_guest_progress', {
            p_course_id: courseId,
            p_week_code: weekCode,
            p_activity_key: activityKey,
            p_class_code: identity.classCode,
            p_seat_no: identity.seatNo,
            p_birthday_code: identity.birthdayCode
        });
        if (error) {
            if (error.code !== 'PGRST202') console.warn('get_guest_progress failed', error);
            return null;
        }
        const row = Array.isArray(data) ? data[0] : data;
        return row ? normalizeProgress(row, total) : null;
    }

    async function save(progressOrScore) {
        const identity = getIdentity?.();
        if (!identity?.birthdayCode || identity.source !== 'rpc') return false;
        const progress = typeof progressOrScore === 'number'
            ? normalizeProgress({ score: progressOrScore, current_level: Math.min(progressOrScore + 1, total), completed: progressOrScore >= total }, total)
            : normalizeProgress(progressOrScore, total);
        const { error } = await supabase.rpc('upsert_guest_progress', {
            p_course_id: courseId,
            p_week_code: weekCode,
            p_activity_key: activityKey,
            p_class_code: identity.classCode,
            p_seat_no: identity.seatNo,
            p_birthday_code: identity.birthdayCode,
            p_current_level: progress.current_level,
            p_score: progress.score,
            p_completed: progress.completed
        });
        if (error) {
            if (error.code !== 'PGRST202') console.warn('upsert_guest_progress failed', error);
            return false;
        }
        return true;
    }

    return { load, save };
}
