import {validateLearningMap,learningConcepts} from './past-learning-map.mjs';
// Local-only, version-pinned projection. Not a production migration or API.
export function createPastLearningProjection({bundle,map,version}){
 const entries=validateLearningMap({bundle,map});
 return snapshot=>{
  if(!snapshot?.records||snapshot.version!==version)return snapshot;
  const records={...snapshot.records};
  for(const entry of entries){
   const record=records[entry.groupId];if(!record)continue;
   const disclosed=record.results?.some(r=>r.questionId===entry.questionId&&typeof r.correct==='boolean');
   if(!disclosed&&!(map.schema===2&&entry.selfCheck&&record.status==='self_checked'))continue;
   const review={schema:1,source:{versionId:version,groupId:entry.groupId,questionId:entry.questionId},explanation:entry.explanation,concepts:structuredClone(learningConcepts(map,entry))};
   records[entry.groupId]=map.schema===1?{...record,learningReview:review}:{...record,learningReviews:{...record.learningReviews,[entry.questionId]:review}};
  }return {...snapshot,records};
 };
}

// Used only when the loopback fixture is explicitly started with a learning map.
export function learningPreviewAssets({origin,nonce,extensionRewards=false}){
 const auth=`export const SUPABASE_URL=${JSON.stringify(origin)},SUPABASE_ANON_KEY='local-learning-fixture';
 const n=new URLSearchParams(location.search).get('fixture_student')==='2'?2:1;
 let s={user:{id:'00000000-0000-4000-8001-'+String(n).padStart(12,'0'),email:'student'+n+'@example.invalid'},access_token:'local-fixture'};
 const callbacks=[];window.__pastSession=next=>{s=next;callbacks.forEach(f=>f(s?'SIGNED_IN':'SIGNED_OUT',s));};
 export const getSession=async()=>s,resolveSession=async()=>s,isTeacher=()=>false,beginCentralizedLogin=async()=>window.__pastSession({user:{id:'00000000-0000-4000-8001-000000000001',email:'student1@example.invalid'}}),signOutAndReload=async()=>window.__pastSession(null);
 export const supabase={auth:{getSession:async()=>({data:{session:s}}),onAuthStateChange:f=>{callbacks.push(f);return {data:{subscription:{unsubscribe(){}}}}}},rpc:async()=>({data:[],error:null})};`;
 const transport=`export function createAuthenticatedTransport({getSession}){return async(path,body)=>{
 const s=await getSession();if(!s?.user)throw Error('請先登入本機測試帳號。');
 const n=s.user.id==='00000000-0000-4000-8001-000000000001'?1:s.user.id==='00000000-0000-4000-8001-000000000002'?2:null;
 if(!n)throw Error('僅供合成測試帳號。');
 if(path==='/__past/extension'){
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':${JSON.stringify(nonce)}},body:JSON.stringify({...body,student:n})});const v=await r.json();if(!r.ok)throw Error(v.message||'目前無法讀取練習紀錄。');return v;
 }
 const library=['library_sessions','pool_catalog','wrong_questions'].find(n=>path==='/rest/v1/rpc/quiz_'+n);
 const practice=path==='/__past/practice'||path==='/rest/v1/rpc/quiz_action'||path==='/rest/v1/rpc/quiz_entry_context'||path==='/rest/v1/rpc/quiz_past_practice';
 const action=library||(path==='/rest/v1/rpc/quiz_past_practice'||(path==='/rest/v1/rpc/quiz_action'&&body.p_action==='past_practice')?'start':path==='/__past/practice'?body.action:path==='/rest/v1/rpc/quiz_action'?'quiz':path==='/rest/v1/rpc/quiz_entry_context'?'entry_context':path==='/rest/v1/rpc/quiz_past_action'?body.p_action:path==='/functions/v1/quiz-media'?'media':null);
 if(!action)throw Error('本機預覽不支援此操作。');
 let data=path==='/__past/practice'?body.data:action==='quiz'?{...body.p_data,quiz_action:body.p_action}:action==='media'?body:body.p_data;
 if(${extensionRewards}&&practice&&action==='start')data={...data,retake:true};
 const r=await fetch(library?'/__past/library':practice?'/__past/practice':'/__past/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':${JSON.stringify(nonce)}},body:JSON.stringify({action,data,student:n})});
 const result=await r.json();if(!r.ok)throw Error(result.message||'本機測試失敗');if(result.extension)window.dispatchEvent(new CustomEvent('past-extension-change',{detail:action==='quiz'&&data.quiz_action==='submit'?result.extension:null}));return result;};}`;
 return new Map([['/shared/auth.js',auth],['/shared/quiz-transport.mjs',transport]]);
}
