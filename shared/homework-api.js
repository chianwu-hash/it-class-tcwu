import { thumbnailStorageRequest } from './homework-thumbnails.js?v=20260910-stored';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getStoredAccessToken } from './auth.js';

export const homeworkStatus = { missing: '未繳交', submitted: '已繳交・待評', passed: '過關', needs_revision: '再努力' };
const messages = {
  login_required: '請先登入學校 Google 帳號。', teacher_required: '此功能只供作業老師使用。',
  roster_required: '這個帳號尚未列入 115 學年度六年級名冊，請老師確認登入信箱。',
  drive_required: '學校 Drive 授權需要老師重新連接。', assignment_unavailable: '這份作業尚未開放、已關閉，或不屬於你的班級。',
  version_changed: '學生已重交新版本。請更新收件名單後再評比。', upload_conflict: '接續檔案與原檔不一致，請重新選檔。',
  upload_expired: '這次上傳已逾期或被新上傳取代。請重新選檔上傳。', upload_limit: '上傳次數較多，請稍後再試。',
  file_type: '請選影片、圖片、文件、Scratch 或 ZIP 檔。', file_size: '檔案為空或超過老師設定的容量限制。',
  drive_verify_failed: '雲端檔案尚未通過完整性確認，未記為繳交。請按接續重試；若持續失敗請重新選檔。',
  storage_unavailable: '檔案狀態尚未保存，請接續重試確認結果。',
  preview_unavailable: '此檔案不支援圖片預覽；圖片預覽上限為 30 MB。仍可查看文字回饋。',
  thumbnail_pending: '縮圖尚未準備完成，請稍後更新。',
  invalid_review: '批註或回饋超過限制，請減少筆畫或縮短文字後再儲存。',
};
export function homeworkError(code) { return messages[code] || '收件服務暫時無法完成。請稍後更新狀態或接續重試。'; }
export async function homeworkRequest(session, action, data = {}, edge = false, review = false) {
  if (!session?.user) throw new Error(messages.login_required);
  const token = getStoredAccessToken() || session.access_token;
  if (!token) throw new Error(messages.login_required);
  if(action==='thumbnail_urls'||action==='thumbnail_save')return thumbnailStorageRequest(SUPABASE_URL,{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`},action,data);
  const form = data instanceof FormData;
  let response;
  try { response = await fetch(`${SUPABASE_URL}/${edge ? 'functions/v1/homework' : review ? 'rest/v1/rpc/homework_review' : 'rest/v1/rpc/homework_action'}`, {
    method: 'POST', signal: AbortSignal.timeout(90000),
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, ...(form ? {} : { 'Content-Type': 'application/json' }) },
    body: form ? data : JSON.stringify(edge ? { action, ...data } : { p_action: action, p_data: data }),
  }); } catch (cause) {
    const error = new Error(cause.name === 'TimeoutError'
      ? '收件服務回應逾時。請先更新繳交狀態，再決定是否重試。'
      : '無法連線到收件服務。請確認網路與網站網址；若持續失敗，請老師檢查收件服務的來源網址設定。');
    error.code = cause.name === 'TimeoutError' ? 'request_timeout' : 'network_error';
    throw error;
  }
  if (edge && action === 'preview' && response.ok) return response.blob();
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(homeworkError(result.error || result.message)); error.code = result.error || result.message; throw error; }
  return result;
}

export function homeworkTreeData(assignments) {
  return {
    activities: assignments.map(a => ({ courseId: a.course_id, weekCode: a.week_code, activityKey: `homework_${a.id}`,
      type: 'homework', label: a.title, pageHref: '/grade6/115-1/homework.html' })),
    rows: assignments.filter(a => a.submission).map(a => ({ course_id: a.course_id, week_code: a.week_code,
      activity_key: `homework_${a.id}`, submitted: true, completed: a.submission.status === 'passed',
      feedback: a.submission.feedback, updated_at: a.submission.reviewed_at || a.submission.submitted_at })),
  };
}
