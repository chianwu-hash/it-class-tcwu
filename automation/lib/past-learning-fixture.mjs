import {createHash} from 'node:crypto';
// Local-only, version-pinned projection. Not a production migration or API.
export function createPastLearningProjection({bundle,map,version}){
 if(map.schema!==1||map.paperId!==bundle.paperId||map.documentSha256!==bundle.sha256||
  createHash('sha256').update(JSON.stringify(bundle.document)).digest('hex')!==bundle.sha256)throw Error('learning_source_version_mismatch');
 const group=bundle.document.groups.find(g=>g.id===map.groupId),field=group?.fields.find(f=>f.id===map.questionId);
 if(!field||field.answer!==map.expectedAnswer||group.kind!=='single')throw Error('learning_source_question_mismatch');
 const entry=bundle.provenance.entries.find(e=>e.id===map.questionId);
 if(entry?.source?.sha256!==map.source.paperSha256||entry?.answerSource?.sha256!==map.source.keySha256||entry.answerSource.raw!==map.source.officialRaw)throw Error('learning_provenance_mismatch');
 return snapshot=>{
  if(!snapshot?.records||snapshot.version!==version)return snapshot;
  const record=snapshot.records[group.id];
  if(!record?.results?.some(r=>r.questionId===field.id&&typeof r.correct==='boolean'))return snapshot;
  return {...snapshot,records:{...snapshot.records,[group.id]:{...record,learningReview:{schema:1,
   source:{versionId:version,groupId:group.id,questionId:field.id},
   explanation:map.explanation,concepts:structuredClone(map.concepts)}}}};
 };
}

// Used only when the loopback fixture is explicitly started with a learning map.
export function learningPreviewAssets({origin,nonce}){
 const auth=`export const SUPABASE_URL=${JSON.stringify(origin)},SUPABASE_ANON_KEY='local-learning-fixture';
 let s={user:{id:'00000000-0000-4000-8001-000000000001',email:'student1@example.invalid'},access_token:'local-fixture'};
 const callbacks=[];window.__pastSession=next=>{s=next;callbacks.forEach(f=>f(s?'SIGNED_IN':'SIGNED_OUT',s));};
 export const getSession=async()=>s,resolveSession=async()=>s,isTeacher=()=>false,beginCentralizedLogin=async()=>window.__pastSession({user:{id:'00000000-0000-4000-8001-000000000001',email:'student1@example.invalid'}}),signOutAndReload=async()=>window.__pastSession(null);
 export const supabase={auth:{getSession:async()=>({data:{session:s}}),onAuthStateChange:f=>{callbacks.push(f);return {data:{subscription:{unsubscribe(){}}}}}},rpc:async()=>({data:[],error:null})};`;
 const transport=`export function createAuthenticatedTransport({getSession}){return async(path,body)=>{
 const s=await getSession();if(!s?.user)throw Error('請先登入本機測試帳號。');
 const n=s.user.id==='00000000-0000-4000-8001-000000000001'?1:s.user.id==='00000000-0000-4000-8001-000000000002'?2:null;
 if(!n)throw Error('僅供合成測試帳號。');
 const action=path==='/rest/v1/rpc/quiz_past_action'?body.p_action:path==='/functions/v1/quiz-media'?'media':null;
 if(!action)throw Error('本機預覽不支援此操作。');
 const r=await fetch('/__past/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':${JSON.stringify(nonce)}},body:JSON.stringify({action,data:action==='media'?body:body.p_data,student:n})});
 const data=await r.json();if(!r.ok)throw Error(data.message||'本機測試失敗');return data;};}`;
 return new Map([['/shared/auth.js',auth],['/shared/quiz-transport.mjs',transport]]);
}
