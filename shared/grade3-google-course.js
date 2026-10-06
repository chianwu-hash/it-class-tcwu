import { supabase, resolveSession, beginCentralizedLogin } from './auth.js';
import { initNavbarAuth } from './navbar-auth.js';

export const GRADE3_GOOGLE_COURSE = 'grade3-115-1';

// Authenticated server RPCs determine the student. No client-selected student code.
export async function reconnectGrade3Progress() {
    const { data, error } = await supabase.rpc('reconnect_grade3_progress').abortSignal(AbortSignal.timeout(10000));
    if (error) throw new Error(error.code === 'PGRST202'
        ? 'Google 已登入，但課程資料轉換尚未啟用；本人身分、舊成果與闖關尚未接通，請告訴老師。'
        : error.code === 'P0001' ? error.message : '舊成果尚未接回，請重新整理再試一次，或告訴老師。');
    const identity = Array.isArray(data) ? data[0] : data;
    if (!identity?.student_code) throw new Error('找不到你的三年級名冊，請確認使用學校 Google 帳號並告訴老師。');
    return identity;
}

// Compatibility API for existing classroom UI. Identity is held in memory only.
export async function initGoogleCourseAuth({ courseId }) {
    if (courseId !== GRADE3_GOOGLE_COURSE) throw new Error('不支援的課程。');
    initNavbarAuth();
    let identity = null;
    let identityError = null;
    let invalidated = false;
    const session = await resolveSession();
    const originalUser = session?.user?.id ?? null;
    supabase.auth.onAuthStateChange((_event, next) => {
        // Subscribe before import: account changes during a slow import invalidate UI.
        if ((next?.user?.id ?? null) !== originalUser) {
            invalidated = true;
            identity = null;
            document.querySelectorAll('[data-google-activity], #typing-levels-container').forEach(el => { el.inert = true; });
            window.location.reload();
        } else setTimeout(paint, 0);
    });
    try {
        if (originalUser) {
            const row = await reconnectGrade3Progress();
            if (invalidated || (await resolveSession())?.user?.id !== originalUser) throw new Error('帳號已變更，請重新整理後確認本人。');
            identity = { source: 'google', classCode: row.class_code, seatNo: row.seat_no,
                seatLabel: String(row.seat_no).padStart(2, '0'), displayName: row.display_name,
                studentCode: row.student_code, practiceAccount: row.practice_account };
        }
    } catch (error) {
        identityError = error.message;
    }
    function paint() {
        if (invalidated) return;
        if (!identity) {
            if (!originalUser || !identityError) return;
            const status = document.querySelector('#course-identity-status, .class-card-required-hint');
            if (status) status.textContent = identityError;
            const nav = document.getElementById('auth-status');
            if (nav) { nav.textContent = 'Google 已登入｜本人身分尚未接回'; nav.title = identityError; }
            return;
        }
        const status = document.getElementById('course-identity-status');
        if (status) status.textContent = `${identity.classCode} 班 ${identity.seatLabel} 號 ${identity.displayName}｜舊成果已接回，先看看自己的努力樹。`;
        const nav = document.getElementById('auth-status');
        if (nav) {
            nav.textContent = `${identity.studentCode} ${identity.displayName}`;
            nav.title = nav.textContent;
        }
    }
    window.addEventListener('course-navbar:rendered', () => setTimeout(paint, 0));
    setTimeout(paint, 0);
    return { getIdentity: () => identity, hasIdentity: () => Boolean(identity),
        getIdentityError: () => identityError,
        open: () => beginCentralizedLogin({ returnTo: window.location.href }), clear: () => { identity = null; } };
}

export function createGoogleCourseProgress({ courseId, weekCode, activityKey, total, getIdentity }) {
    async function request(action, value) {
        if (courseId !== GRADE3_GOOGLE_COURSE || !getIdentity?.()) return action === 'load' ? null : false;
        const score = typeof value === 'number' ? value : value?.completed ? total : (value?.score ?? (Number(value?.current_level) - 1));
        const args = { p_week_code: weekCode, p_activity_key: activityKey };
        if (action === 'save') args.p_score = score;
        const { data, error } = await supabase.rpc(action === 'load' ? 'get_grade3_progress' : 'save_grade3_progress', args)
            .abortSignal(AbortSignal.timeout(10000));
        if (error) throw new Error(error.code === 'P0001' ? error.message : action === 'load' ? '進度暫時讀取不到，請重新整理或告訴老師。' : '進度尚未保存，請留在這頁重試，或告訴老師。');
        return action === 'load' ? (Array.isArray(data) ? data[0] ?? null : data) : true;
    }
    return { load: () => request('load'), save: value => request('save', value) };
}
