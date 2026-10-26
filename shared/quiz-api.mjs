import { createAuthenticatedTransport } from './quiz-transport.mjs';
import { configureQuizMedia } from './quiz-media.mjs';
const errors = {
  media_freeze_required: '媒體需先完成版本保存。', media_source_denied: '媒體來源未列入允許清單，請確認來源設定。',
  media_invalid: '媒體格式或大小不符，未固定版本。', media_unavailable: '媒體尚未開放或無法載入。',
  revision_changed: '草稿已更新，請重新開啟後再固定版本。', bank_unavailable: '無法開啟這份題庫。',
  login_required: '請先登入學校帳號。', teacher_required: '只有教師可以操作。', student_required: '請使用學生帳號加入。',
  roster_required: '這個帳號不在本場次的班級名冊中，請老師確認。', session_unavailable: '找不到這個場次，請確認加入連結。',
  attempt_unavailable: '場次已結束或尚未加入，請老師確認。', session_closed: '老師已結束場次，這次答案尚未送出。',
  session_full: '本場次的學生名額已滿，請老師確認。', submission_conflict: '這題已有保存紀錄，請更新狀態確認。',
  question_order: '作答順序已更新，請更新狀態後接續。', invalid_response: '請先選擇選項或填入答案（最多 2000 字）。',
  version_unavailable: '找不到這個固定版本。', session_conflict: '同一場次的設定不同，請重新確認。',
};
export const quizError = code => errors[code] || '測驗服務暫時無法完成，請更新狀態或重試。';
export async function createQuizRequest({ getSession, localStudent = null, local = false } = {}) {
  const auth = local ? null : await import('./auth.js');
  const transport = local ? null : createAuthenticatedTransport({ auth, getSession });
  let attemptId = null;
  configureQuizMedia(async url => {
    const result = local ? await localCall('/__quiz-media', { action: 'read', url, attempt_id: attemptId })
      : await transport('/functions/v1/quiz-media', { action: 'read', url, attempt_id: attemptId });
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
      if (result.attempt_id) attemptId = result.attempt_id;
      return result;
    }
    try {
      const result = await transport(action === 'publish' ? '/functions/v1/quiz-media' : '/rest/v1/rpc/quiz_action',
        action === 'publish' ? { action: 'freeze', data } : { p_action: action, p_data: data });
      if (result.attempt_id) attemptId = result.attempt_id;
      return result;
    } catch (e) { if (e.code) e.message = quizError(e.code); throw e; }
  };
}
