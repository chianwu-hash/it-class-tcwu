import {supabase,getSession,isTeacher} from './auth.js';
let checking=false,again=null,queued=null,showing=false,observer=null,lastPendingUser=null;
const COURSES=['grade3-114-2','grade3-115-1','grade6-115-1'];
const courseFromPage=()=>{const m=location.pathname.match(/\/grade([36])\/(115-1)\//);return m?`grade${m[1]}-${m[2]}`:null};
async function sameUser(uid){return (await getSession()).session?.user?.id===uid}
async function call(action,courseId=null,claim=null){let request=supabase.rpc('garden_unlock_notice',{p_action:action,p_course_id:courseId,p_claim:claim});if(request.abortSignal)request=request.abortSignal(AbortSignal.timeout(8000));const {data,error}=await request;if(error)throw error;return data}
function blocked(){return document.hidden||document.querySelector('dialog[open],#celebration-overlay,.quiz-leaf-celebration')}
function watch(){if(observer||!queued)return;observer=new MutationObserver(()=>{if(!blocked())void show()});observer.observe(document.body,{childList:true,subtree:true});}
async function show(){
 if(showing||!queued)return;if(blocked()){watch();return;}showing=true;
 const target=queued;queued=null;observer?.disconnect();observer=null;
 try{
  if(!await sameUser(target.uid))return;const n=await call('claim');if(!n||!COURSES.includes(n.courseId)||!await sameUser(target.uid))return;
  const style=document.createElement('style');style.textContent=`.garden-unlock-dialog{box-sizing:border-box;width:min(520px,92vw);border:2px solid #a6d6bc;border-radius:28px;padding:28px;background:linear-gradient(145deg,#fff8dc,#e9f9ed);color:#245747;text-align:center;font-family:system-ui,sans-serif;box-shadow:0 20px 70px #163d3544}.garden-unlock-dialog::backdrop{background:#173c3766}.garden-unlock-dialog img{width:150px;height:150px;object-fit:contain;animation:garden-welcome 1.3s ease-in-out 2}.garden-unlock-dialog h2{font-size:28px;margin:8px 0}.garden-unlock-dialog p{line-height:1.8}.garden-unlock-dialog nav{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.garden-unlock-dialog a,.garden-unlock-dialog button{font:inherit;min-height:44px;border-radius:14px;padding:12px 16px;cursor:pointer;border:1px solid #72af99;text-decoration:none;background:white;color:#245747}.garden-unlock-dialog a{background:#137b69;color:white;font-weight:800}@keyframes garden-welcome{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-12px) rotate(3deg)}}@media(prefers-reduced-motion:reduce){.garden-unlock-dialog img{animation:none}}`;
  const box=document.createElement('dialog');box.className='garden-unlock-dialog';box.setAttribute('aria-labelledby','garden-unlock-title');
  box.innerHTML='<img src="/garden/assets/processed/social-v10/sit-0.webp" alt="小貓"><h2 id="garden-unlock-title">新的陪伴來了！</h2><p>小貓和避雨小屋已經解鎖。<br>謝謝你持續學習，牠們準備陪你一起成長。</p><nav><a>去努力樹看看</a><button type="button">繼續練習</button></nav>';
  box.querySelector('a').href='/my-tree.html?course='+encodeURIComponent(n.courseId);
  let ackPromise;const ack=()=>ackPromise??=(sameUser(target.uid).then(ok=>ok&&call('ack',n.courseId,n.claim)).catch(()=>{}));
  box.querySelector('a').onclick=e=>{e.preventDefault();void Promise.race([ack(),new Promise(r=>setTimeout(r,1500))]).then(()=>sameUser(target.uid)).then(ok=>{if(ok)location.assign(box.querySelector('a').href)})};box.querySelector('button').onclick=()=>box.close();box.addEventListener('close',()=>{void ack();box.remove();style.remove()},{once:true});
  document.head.append(style);document.body.append(box);box.showModal();box.querySelector('a').focus();
 }catch{/* An unlock notice must never turn a successful save into a failure. */}finally{showing=false}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void show()});
export function checkGardenUnlock(session,courseId=courseFromPage(),action='check'){
 if(!session?.user||isTeacher(session)||!COURSES.includes(courseId)&&action!=='pending')return;
 if(action==='pending'){if(lastPendingUser===session.user.id)return;lastPendingUser=session.user.id;}
 again={session,courseId,action};if(checking)return;checking=true;
 void(async()=>{try{while(again){const job=again;again=null;try{const n=await call(job.action,job.courseId);if(n&&await sameUser(job.session.user.id)){queued={uid:job.session.user.id};void show()}}catch{}}}finally{checking=false}})();
}
export function afterGardenReward(courseId){void getSession().then(({session})=>checkGardenUnlock(session,courseId)).catch(()=>{})}
