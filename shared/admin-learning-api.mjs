const labels={teacher_required:'請使用具有權限的教師帳號登入。',student_unavailable:'這位學生不在目前課程名冊中。',
  session_expired:'教師登入已失效，請重新登入後再讀取紀錄。',identity_changed:'登入帳號已變更，這次讀取結果已捨棄。',
  paper_unavailable:'這張試卷不屬於所選學生，或已無法讀取。',progress_unavailable:'這筆打字紀錄不屬於所選學生。',
  unsupported_document:'這份試卷的題型版本尚未支援檢視；紀錄仍保留。',invalid_course:'目前支援 115 學年度上學期三、四、六、九年級課程。',
  local_session_required:'本機預覽連線已失效，請重新整理此頁。'};
labels.live_reader_unavailable='Google 登入已確認，實際紀錄的唯讀查詢尚未就緒。請稍後重新讀取。';
export function learningError(error){
  if(error?.name==='AbortError')return '已取消讀取。';
  if(error?.name==='TimeoutError')return '讀取逾時，尚未取得紀錄。請稍後重試。';
  return labels[error?.code]||'暫時無法讀取資料，這不代表學生沒有紀錄。請重試。';
}
export function beginLearningTeacherLogin({auth,session,returnTo}){
  return session?.user&&!auth.isTeacher(session)?auth.signInWithGoogle({returnTo}):auth.beginCentralizedLogin({returnTo});
}
export function createLearningRequest({local=false,readOnlyBridge=false,auth=null,getSession=()=>null,fetcher=fetch}={}){
  if(local&&!['127.0.0.1','localhost'].includes(location.hostname))throw new Error('本機模式僅限本機預覽。');
  if(readOnlyBridge&&!['127.0.0.1','localhost'].includes(location.hostname))throw new Error('實際資料測試橋接僅限本機。');
  return async(action,course,payload={},signal)=>{
    const identity=getSession()?.user?.id;
    if(!local&&(!identity||!auth.isTeacher(getSession())))throw Object.assign(new Error('teacher_required'),{code:'teacher_required'});
    const token=local?null:auth.getStoredAccessToken()||getSession()?.access_token;
    if(!local&&!token)throw Object.assign(new Error('teacher_required'),{code:'teacher_required'});
    const rpc=['rewards','garden_status','class_rewards'].includes(action)?'admin_learning_rewards':'admin_learning_action';
    const response=await fetcher(local?'/__learning-rpc':readOnlyBridge?'/__learning-live':`${auth.SUPABASE_URL}/rest/v1/rpc/${rpc}`,{
      method:'POST',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),
      headers:{'Content-Type':'application/json',...(local?{}:{apikey:auth.SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`})},
      body:JSON.stringify({p_action:action,p_course_id:course,p_payload:payload}),cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!local&&getSession()?.user?.id!==identity)throw Object.assign(new Error('identity_changed'),{code:'identity_changed'});
    if(!response.ok)throw Object.assign(new Error('read_failed'),{code:!local&&response.status===401?'session_expired':data?.error||data?.message});
    if(!data||typeof data!=='object')throw new Error('invalid_response');
    return data;
  };
}
