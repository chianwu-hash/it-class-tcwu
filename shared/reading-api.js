import { SUPABASE_URL, SUPABASE_ANON_KEY, getStoredAccessToken } from './auth.js';
export const readingSources={school_library:'頂溪國小數位圖書館',parent_platform:'親師生平台閱讀專區'};
export const readingLabels={submitted:'已分享・待老師回應',passed:'過關',needs_revision:'老師邀請你補充'};
const errors={login_required:'請先登入學校帳號。',roster_required:'帳號尚未列入六年級名冊，請老師確認。',student_required:'請使用學生帳號分享。',teacher_required:'只有作業老師可以操作。',period_unavailable:'這一週目前不提供分享；仍可查看已保存的紀錄。',period_overlap:'日期與其他週重疊，請依學期行事曆調整。',period_has_submissions:'這一週已有分享，不能更改日期。',invalid_period:'請確認學期週次與日期範圍（最多七天）。',version_changed:'已有新版本，請更新後再操作；你的輸入仍保留在視窗中。',review_changed:'評比或回饋已更新，請重新開啟小卡再操作。',submission_conflict:'這次送出與先前資料不同，請更新後再試。'};
export async function readingRequest(session,action,data={}){
 if(!session?.user)throw new Error(errors.login_required);
 const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/reading_action`,{method:'POST',signal:AbortSignal.timeout(20000),headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${getStoredAccessToken()||session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_data:data})});
 const body=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(errors[body.message]||'閱讀服務暫時無法完成，請稍後重試。');e.code=body.message;throw e;}return body;
}
export function readingTreeData(periods){return {activities:periods.filter(p=>p.submission).map(p=>({courseId:p.course_id,weekCode:p.week_code,activityKey:`reading_${p.id}`,type:'homework',label:`第 ${Number(p.week_code)} 週 閱讀小卡`,pageHref:'/grade6/115-1/homework.html#reading'})),rows:periods.filter(p=>p.submission).map(p=>({course_id:p.course_id,week_code:p.week_code,activity_key:`reading_${p.id}`,submitted:true,completed:p.submission.status==='passed',feedback:p.submission.feedback,updated_at:p.submission.reviewed_at||p.submission.submitted_at}))};}
