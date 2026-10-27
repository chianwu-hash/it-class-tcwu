// 與頁面登入生命週期共用；不讀另一份 localStorage 權杖，也不自動重送寫入。
export function createAuthenticatedTransport({ auth, getSession, fetcher = fetch, baseUrl = auth.SUPABASE_URL }) {
  if (baseUrl !== auth.SUPABASE_URL && (!['localhost', '127.0.0.1'].includes(location.hostname) || baseUrl !== location.origin))
    throw new Error('本機媒體服務設定不符。');
  return async (path, body) => {
    const identity = getSession()?.user?.id;
    if (!identity) throw new Error('請先登入學校帳號。');
    const { data, error } = await auth.supabase.auth.getSession();
    const session = data?.session;
    if (error || !session?.access_token || session.user?.id !== identity || getSession()?.user?.id !== identity)
      throw new Error('登入已失效或身分已變更，請重新登入。');
    let response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method: 'POST', signal: AbortSignal.timeout(path === '/functions/v1/quiz-media' && body.action === 'freeze' ? 45000 : 20000),
        headers: { 'Content-Type': 'application/json', apikey: auth.SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new Error(cause.name === 'TimeoutError' ? '連線逾時，保存狀態尚未確認。請重試或更新狀態。' : '網路中斷，保存狀態尚未確認。請重試或更新狀態。');
    }
    const result = await response.json().catch(() => null);
    if (getSession()?.user?.id !== identity) throw new Error('登入身分已變更，請重新加入。');
    if (!response.ok || !result || typeof result !== 'object') {
      const e = new Error(result?.error || result?.message || 'service_unavailable'); e.code = e.message; throw e;
    }
    return result;
  };
}
