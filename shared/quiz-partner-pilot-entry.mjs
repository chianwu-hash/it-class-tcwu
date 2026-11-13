// Optional, fail-closed addition. It never changes the original quiz login or progress lifecycle.
import {supabase} from './auth.js';
let generation=0,observer=null,refreshCatalog=null;
const href=(params={})=>'partner-practice.html'+(Object.keys(params).length?'?'+new URLSearchParams(params):'');
function ensureEntryStyle(){
 if(document.getElementById('partner-pilot-entry-style'))return;
 const style=document.createElement('style');style.id='partner-pilot-entry-style';
 style.textContent=`
 [data-partner-pilot-entry="main"]{position:relative;padding-right:190px}
 [data-partner-pilot-entry="main"] .partner-entry-art{position:absolute;right:24px;bottom:14px;width:130px;height:100px;object-fit:contain;object-position:center bottom;pointer-events:none}
 @media(max-width:850px){[data-partner-pilot-entry="main"]{padding-right:24px}[data-partner-pilot-entry="main"] .partner-entry-art{display:none}}
 [data-partner-pilot-entry="main"] .partner-entry-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:12px;padding-bottom:3px}
 [data-partner-pilot-entry="main"] .partner-entry-actions .paper-start{margin:0;min-width:0}
 [data-partner-pilot-entry="main"] .partner-entry-actions .partner-entry-resume{background:var(--quiz-primary,#0f766e);color:#fff;box-shadow:0 3px 0 var(--quiz-primary-dark,#115e59)}
 [data-partner-pilot-entry="main"] .partner-entry-actions .partner-entry-resume:hover{background:var(--quiz-primary-dark,#115e59)}
 [data-partner-pilot-entry="main"] .partner-entry-actions .paper-start:focus-visible{outline:3px solid #0369a1;outline-offset:4px}
 @media(max-width:600px){[data-partner-pilot-entry="main"] .partner-entry-actions{grid-template-columns:1fr}}
 `;
 document.head.append(style);
}
function clear(){observer?.disconnect();observer=null;refreshCatalog=null;document.querySelectorAll('[data-partner-pilot-entry]').forEach(el=>el.remove());}
async function update(session){
 const epoch=++generation;clear();if(!session?.user)return;
 try{
  const access=await supabase.rpc('quiz_partner_pilot_access');
  if(epoch!==generation||access.error||access.data?.allowed!==true)return;
  const result=await supabase.rpc('quiz_partner_pilot_action',{p:{action:'catalog'}});
  if(epoch!==generation||result.error||!Array.isArray(result.data?.papers))return;
  const catalog=result.data.papers;
  ensureEntryStyle();
  const section=document.createElement('section');section.dataset.partnerPilotEntry='main';section.className='panel';
  const title=document.createElement('h2');title.textContent='夥伴練功';
  const description=document.createElement('p');description.textContent='有人陪，一起想。10題限2人，20題與考古題可2～4人；達標的紀念葉花直接長在努力樹。';
  section.append(title,description);
  const actions=document.createElement('div');actions.className='partner-entry-actions';
  for(const [text,params] of [['找夥伴一起練',{}],['接續夥伴練功',{view:'resume'}]]){const a=document.createElement('a');a.textContent=text;a.className='paper-start'+(params.view?' partner-entry-resume':'');a.href=href(params);actions.append(a);}
  section.append(actions);
  const art=document.createElement('img');art.className='partner-entry-art';art.src=new URL('./partner-pilot/art/welcome-v1.webp',import.meta.url).href;art.alt='';art.setAttribute('aria-hidden','true');art.width=480;art.height=268;art.loading='lazy';art.decoding='async';section.append(art);
  // Also visible to an invited adult without a student roster. Existing student eligibility stays intact.
  const homeSlot=document.getElementById('home-partner-slot');
  if(homeSlot){art.src=new URL('./partner-pilot/art/invite-v1.webp',import.meta.url).href;art.width=317;art.height=480;title.prepend(art);}
  if(homeSlot)homeSlot.append(section);else document.querySelector('main')?.prepend(section);
  function decorate(){
   if(epoch!==generation)return;
   for(const card of document.querySelectorAll('#cloud-papers .paper-card,#past-papers .paper-card,#my-papers .paper-card')){
    if(card.querySelector('[data-partner-pilot-entry]'))continue;
    const start=card.querySelector('a.paper-start');if(!start)continue;
    const url=new URL(start.href,location.href);
    const paper=catalog.find(p=>(card.dataset.sessionId&&(p.sourceSession===card.dataset.sessionId||p.sourceSessions?.includes(card.dataset.sessionId)))||(url.searchParams.has('paper')&&p.sourcePaper===url.searchParams.get('paper')));
    if(!paper)continue;
    const a=document.createElement('a');a.dataset.partnerPilotEntry='paper';a.className='paper-start';a.textContent='邀夥伴練這份';a.href=href(paper.sourcePaper?{paper:paper.sourcePaper}:{session:paper.sourceSession});a.style.marginTop='.75rem';start.after(a);
   }
  }
  // A newly composed paper is rendered without a page reload. Refresh only this optional catalog.
  let catalogRequest=0;
  refreshCatalog=async()=>{const serial=++catalogRequest;try{const fresh=await supabase.rpc('quiz_partner_pilot_action',{p:{action:'catalog'}});if(epoch!==generation||serial!==catalogRequest||fresh.error||!Array.isArray(fresh.data?.papers))return;catalog.splice(0,catalog.length,...fresh.data.papers);decorate();}catch{/* Personal paper creation remains successful if the optional entry is unavailable. */}};
  decorate();observer=new MutationObserver(decorate);
  for(const id of ['cloud-papers','past-papers','my-papers']){const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,subtree:true});}
 }catch{/* An unavailable pilot does not affect ordinary practice. */}
}
supabase.auth.onAuthStateChange((event,session)=>{if(event!=='TOKEN_REFRESHED')queueMicrotask(()=>update(session));});
supabase.auth.getSession().then(({data})=>update(data.session)).catch(()=>{});
document.addEventListener('quiz-paper-saved',()=>refreshCatalog?.());
