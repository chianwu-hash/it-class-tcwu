import { SUPABASE_URL, SUPABASE_ANON_KEY, getStoredAccessToken } from './auth.js';

export function createFoundationProgress({courseId, lessonKey='english-home-row-v1', getSession = () => null, fetchImpl = fetch}) {
  if (!['grade3-115-1','grade6-115-1'].includes(courseId)) throw new Error('不支援的基礎練習課程。');
  const sessionId = crypto.randomUUID();
  let current = null;
  async function request(action, payload = {}) {
    const session = getSession();
    if (!session?.user) throw new Error('請先登入 Google。');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/typing_foundation_action`, {
        method:'POST', signal:controller.signal,
        headers:{'Content-Type':'application/json', apikey:SUPABASE_ANON_KEY,
          Authorization:`Bearer ${getStoredAccessToken() || session?.access_token || SUPABASE_ANON_KEY}`},
        body:JSON.stringify({p_action:action,p_course_id:courseId,p_payload:{...payload,lesson_key:lessonKey}}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body.message?.includes('lesson_locked')) throw new Error('請先完成前面的關卡，再開啟這一關。');
        if (body.message?.includes('stale_revision')) throw new Error('進度已被教師重置，請重新整理後再開始。');
        if (body.message?.includes('session_changed')) throw new Error('另一個頁面已開始練習，請重新整理後再開始。');
        if (body.message?.includes('student_required')) throw new Error('請使用學生自己的學校 Google 帳號登入；教師帳號不能代闖關。');
        if (body.message?.includes('roster_required')) throw new Error(`目前 Google 帳號不在 115 學年度${courseId.startsWith('grade3') ? '三' : '六'}年級名冊，請確認自己的帳號。`);
        if (body.message?.includes('course_identity_required')) throw new Error('目前帳號尚未通過三年級本人身分確認；請確認使用自己的三年級學校 Google 帳號，回課程首頁接回舊成果。');
        throw new Error(`基礎練習連線失敗（${response.status}），請確認身分與資料庫設定後重試。`);
      }
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  return {
    list:() => request('list'),
    load:async () => (current = await request('load')),
    start:async starter => (current = await request('start',{session_id:sessionId,starter})),
    save:async attempt => (current = await request('save',{...attempt,session_id:sessionId,revision:current?.revision})),
    request,
  };
}
