import { SUPABASE_URL, SUPABASE_ANON_KEY, getStoredAccessToken } from './auth.js';

// Shared adapter for quiz/practical activities. Typing continues to use typing-challenge.
export function createActivityProgress({ courseId, weekCode, activityKey, total, getSession }) {
    async function request(method, score) {
        const session = getSession();
        if (!session?.user) throw new Error('請先登入 Google。');
        const token = getStoredAccessToken() || session.access_token;
        if (!token) throw new Error('登入已失效，請重新登入。');
        const url = new URL(`${SUPABASE_URL}/rest/v1/student_progress`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
        const options = { method, headers, signal: controller.signal };
        if (method === 'GET') {
            Object.entries({ select: 'score,completed,current_level', user_id: `eq.${session.user.id}`, course_id: `eq.${courseId}`, week_code: `eq.${weekCode}`, activity_key: `eq.${activityKey}` }).forEach(([key, value]) => url.searchParams.set(key, value));
        } else {
            url.searchParams.set('on_conflict', 'user_id,course_id,week_code,activity_key');
            headers['Content-Type'] = 'application/json';
            headers.Prefer = 'resolution=merge-duplicates,return=minimal';
            options.body = JSON.stringify({ user_id: session.user.id, course_id: courseId, week_code: weekCode, activity_key: activityKey, score, current_level: Math.min(score + 1, total), completed: score === total, updated_at: new Date().toISOString() });
        }
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`進度連線失敗（${response.status}），請再試一次。`);
            return method === 'GET' ? (await response.json())[0] ?? null : true;
        } finally { clearTimeout(timeout); }
    }
    return { load: () => request('GET'), save: (score) => request('POST', score) };
}
