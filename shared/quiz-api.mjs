import { createAuthenticatedTransport } from './quiz-transport.mjs';
import { configureQuizMedia } from './quiz-media.mjs';
const errors = {
  paper_name_choice_invalid: '這個主題或角色目前無法使用，請更新後重新選擇。',
  paper_name_locked: '試卷由系統自動命名，不能自行修改名稱。',
  self_pool_empty: '這個範圍目前沒有符合所選難度的題目，請選其他單元或難度。',
  course_unavailable: '這個科目目前尚未開放，請選擇自己年級可用的科目。',
  answer_too_fast: '請看清題目和選項再作答。',
  paper_removed: '這份卷已從清單移除，請重新組一份新卷。',
  pool_empty: '這個範圍目前沒有可用的延伸題，可以先回看這題的解析或選其他單元。', extension_unavailable: '這題目前還沒有可用的同重點延伸題。',
  media_freeze_required: '媒體需先完成版本保存。', media_source_denied: '媒體來源未列入允許清單，請確認來源設定。',
  media_invalid: '媒體格式或大小不符，未固定版本。', media_unavailable: '媒體尚未開放或無法載入。',
  revision_changed: '草稿已更新，請重新開啟後再固定版本。', bank_unavailable: '無法開啟這份題庫。',
  login_required: '請先登入學校帳號。', teacher_required: '只有教師可以操作。', student_required: '請使用學生帳號加入。',
  roster_required: '這個帳號不在本場次的班級名冊中，請老師確認。', session_unavailable: '找不到這個場次，請確認加入連結。',
  wrong_question_unavailable: '目前無法查看這題錯題，請更新紀錄後重試。', invalid_request: '資料格式不符，請更新後重試。',
  attempt_unavailable: '場次已結束或尚未加入，請老師確認。', session_closed: '老師已結束場次，這次答案尚未送出。',
  session_busy: '目前仍有答案正在儲存，請稍候再結束場次。',
  session_full: '本場次的學生名額已滿，請老師確認。', submission_conflict: '這題已有保存紀錄，請更新狀態確認。',
  question_order: '作答順序已更新，請更新狀態後接續。', invalid_response: '請先選擇選項或填入答案（最多 2000 字）。',
  version_unavailable: '找不到這個固定版本。', session_conflict: '同一場次的設定不同，請重新確認。',
};
export const quizError = code => errors[code] || '測驗服務暫時無法完成，請更新狀態或重試。';
export async function createQuizRequest({ getSession, localStudent = null, local = false } = {}) {
  const auth = local ? null : await import('./auth.js');
  const transport = local ? null : createAuthenticatedTransport({ auth, getSession });
  const driveMedia = !local && ['localhost', '127.0.0.1'].includes(location.hostname)
    && document.querySelector('meta[name="quiz-media-backend"]')?.content === 'drive';
  const mediaTransport = driveMedia ? createAuthenticatedTransport({auth, getSession, baseUrl:location.origin}) : null;
  let attemptId = null;
  configureQuizMedia(async url => {
    const body = { action: 'read', url, attempt_id: attemptId };
    let result = local ? await localCall('/__quiz-media', body)
      : mediaTransport ? await mediaTransport('/__quiz-drive-media', body)
      : await transport('/functions/v1/quiz-media', body);
    if (result.fallback === 'supabase') result = await transport('/functions/v1/quiz-media', body);
    return result.url;
  });
  if (local && !['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('本機模式只可在本機使用。');
  async function localCall(path, body) {
    const response = await fetch(path, { method: 'POST', signal: AbortSignal.timeout(body.action === 'freeze' ? 45000 : 20000),
      headers: { 'Content-Type': 'application/json', ...(localStudent === null ? {} : { 'X-Quiz-Demo-Student': String(localStudent) }) }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) { const e = new Error(quizError(result.error)); e.code = result.error; throw e; }
    return result;
  }
  return async (action, data = {}) => {
    if (local) {
      const result = await localCall(action === 'publish' ? '/__quiz-media' : '/__quiz-rpc', { action: action === 'publish' ? 'freeze' : action, data });
      if(result.warning){const e=new Error(quizError(result.warning));e.code=result.warning;e.retryAfter=result.retry_after;throw e;}
      if (result.attempt_id) attemptId = result.attempt_id;
      return result;
    }
    try {
      const specialized = {rewards:'quiz_rewards',wrong_questions:'quiz_wrong_questions',compose:'quiz_compose',rename_paper:'quiz_rename_paper',delete_paper:'quiz_delete_paper',pool_catalog:'quiz_pool_catalog'}[action];
      const result = await transport(action === 'publish' ? '/functions/v1/quiz-media' : specialized ? '/rest/v1/rpc/'+specialized : '/rest/v1/rpc/quiz_action',
        action === 'publish' ? { action: 'freeze', data } : action === 'pool_catalog' ? {} : specialized ? { p_data: data } : { p_action: action, p_data: data });
      if (result.attempt_id) attemptId = result.attempt_id;
      if(result.warning){const e=new Error(quizError(result.warning));e.code=result.warning;e.retryAfter=result.retry_after;throw e;}
      return result;
    } catch (e) { if (e.code) e.message = quizError(e.code); throw e; }
  };
}
