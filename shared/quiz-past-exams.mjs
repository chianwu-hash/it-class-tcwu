import {initPastExamUI} from './quiz-past-ui.mjs?v=20261029-past-types3';
import {createAuthenticatedTransport} from './quiz-transport.mjs?v=20261029-batch4';
import {createMediaScope,configureQuizMedia} from './quiz-media.mjs';
import {initImageLightbox} from './image-lightbox.js';
import {provideNavIdentity} from './grade6-nav-identity.js?v=20261029-batch4';
const messages={answer_too_fast:'請先看清這一組題目，再送出答案。',paper_unavailable:'這份考古題尚未開放，或不適用目前年級。',roster_required:'請使用名冊中的學生帳號。',student_required:'此入口僅供學生作答，教師請使用預覽入口。',attempt_unavailable:'無法讀取這次作答，請重新選擇試卷。',submission_conflict:'這組已有儲存紀錄，請更新後查看。'};
export function initPastExam({selectors,server}){
 const root=document.getElementById(selectors.container),lock=document.getElementById(selectors.lock),content=document.getElementById(selectors.content);
 const template=root.innerHTML;let user=null,generation=0,ui=null,scope=null,state=null,transport=null,viewed=new Map();
 async function rpc(action,data={}){if(!transport)throw Error('請先登入。');try{return await transport('/rest/v1/rpc/quiz_past_action',{p_action:action,p_data:{paper_id:server.paperId,...data}});}catch(e){e.message=messages[e.code]||messages[e.message]||'資料尚未確認，請更新或用同一份答案重試。';throw e;}}
 const clear=()=>{generation++;scope?.dispose();scope=null;ui?.clear();ui=null;state=null;viewed.clear();document.getElementById('lightbox-close')?.click();root.replaceChildren();content.hidden=true;lock.hidden=false;};
 const onView=gid=>{if(!state||viewed.has(gid))return;const token=generation;const promise=rpc('view',{attempt_id:state.attemptId,group_id:gid}).catch(e=>{if(token===generation){viewed.delete(gid);root.querySelector('#status').textContent=e.message;}});viewed.set(gid,promise);};
 const updateScope=()=>{scope?.dispose();const token=generation,aid=state.attemptId;scope=createMediaScope({context:{user:user.user.id,attempt:aid},valid:()=>generation===token&&state?.attemptId===aid,read:async url=>transport('/functions/v1/quiz-media',{action:'read',url,attempt_id:aid})});const current=scope;configureQuizMedia(url=>current.resolve(url));};
 const request=async(route,packet)=>{
  const token=generation;let next;
  if(route==='/api/reset')next=await rpc('restart',{request_id:packet.requestId});
  else{await viewed.get(packet.groupId);next=await rpc('submit',{attempt_id:state.attemptId,version:packet.version,group_id:packet.groupId,request_id:packet.requestId,responses:packet.responses,confirmed:packet.confirmed});}
  if(token!==generation)throw Error('登入身分已變更。');const changed=state.attemptId!==next.attemptId;state=next;if(changed){viewed.clear();updateScope();}const url=new URL(location.href);url.searchParams.set('attempt',state.attemptId);history.replaceState(null,'',url);return next;
 };
 initImageLightbox({root,selector:'[data-image-lightbox]',resolveImageSource:image=>scope.resolve(image.dataset.quizMediaUrl)});
 return {async handleAuthChange(session){
  if(user?.user?.id===session?.user?.id&&ui)return;clear();user=session;if(!session?.user)return;
  const token=generation;const auth=await import('./auth.js');if(token!==generation)return;
  transport=createAuthenticatedTransport({auth,getSession:()=>user});
  try{
   const aid=new URLSearchParams(location.search).get('attempt');
   const next=await rpc(aid?'resume':'start',aid?{attempt_id:aid}:{request_id:crypto.randomUUID()});if(token!==generation)return;
   state=next;const url=new URL(location.href);url.searchParams.set('attempt',state.attemptId);history.replaceState(null,'',url);viewed.clear();root.innerHTML=template;content.hidden=false;lock.hidden=true;updateScope();
   provideNavIdentity({userId:user.user.id,email:user.user.email,row:next.identity?.enrollment||next.identity});
   root.querySelector('#paper-title').textContent=next.title;
   ui=initPastExamUI({root,request,resolveAsset:url=>scope.resolve(url),onView});ui.load(next);
  }catch(e){if(token!==generation)return;lock.querySelector('[role="status"]').textContent=e.message;}
 },destroy(){clear();user=null;transport=null;}};
}
