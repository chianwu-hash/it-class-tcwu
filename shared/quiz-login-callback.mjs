// 專用本機雲端入口的集中登入 callback；仍使用全站 auth 模組。
import { getSession, signInWithGoogle, consumePendingRedirect, getHomeRedirectUrl, supabase } from './auth.js';
const status = document.getElementById('login-status');
const error = new URLSearchParams(location.hash.slice(1)).get('error_description');
if (error) status.textContent = `登入未完成：${error}`;
else {
  const finish = session => {
    if (!session?.user) return false;
    if (!consumePendingRedirect(getHomeRedirectUrl())) location.replace('/grade6/115-1/quiz-library.html');
    return true;
  };
  const { session } = await getSession();
  if (!finish(session)) {
    supabase.auth.onAuthStateChange((_event, next) => { if (next?.user) setTimeout(() => finish(next), 0); });
    if (new URLSearchParams(location.search).get('login') === '1') {
      const { error } = await signInWithGoogle({ redirectTo: getHomeRedirectUrl() });
      if (error) status.textContent = '目前無法登入，請返回選卷頁後重試。';
    } else status.textContent = '請返回選卷頁，按 Google 登入。';
  }
}
