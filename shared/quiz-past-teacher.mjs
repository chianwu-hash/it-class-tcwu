import {initNavbarAuth} from './navbar-auth.js';
import {createAuthenticatedTransport} from './quiz-transport.mjs?v=20261029-batch4';
import {initImageLightbox} from './image-lightbox.js';
import {renderContent} from './quiz-render.mjs';
import {createMediaScope} from './quiz-media.mjs';
let session=null,generation=0,scope=null;
const host=document.getElementById('teacher-preview'),status=document.getElementById('teacher-status'),picker=document.getElementById('teacher-paper');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
initImageLightbox({root:host,selector:'img'});
let transport=null;
async function preview(id){
 const token=++generation;host.replaceChildren();scope?.dispose();scope=null;status.textContent='正在讀取固定版本與來源紀錄…';
 try{
  const data=await transport('/rest/v1/rpc/quiz_past_action',{p_action:'preview',p_data:{paper_id:id}});if(token!==generation)return;
  const url=new URL(location.href);url.searchParams.set('paper',id);history.replaceState(null,'',url);
  scope=createMediaScope({context:{user:session.user.id,preview:id},valid:()=>generation===token,read:async url=>transport('/functions/v1/quiz-media',{action:'read',url})});const mediaScope=scope;
  const auto=data.document.groups.filter(g=>!['annotation','manual'].includes(g.kind)).flatMap(g=>g.fields),manual=data.document.groups.filter(g=>['annotation','manual'].includes(g.kind)).flatMap(g=>g.fields),blocked=data.document.blocked||[];
  status.textContent=`${data.paper.title}｜${data.paper.enabled?'已開放':'尚未開放'}｜自動核對${auto.reduce((n,f)=>n+f.points,0)}分／自我核對${manual.reduce((n,f)=>n+f.points,0)}分／暫停${blocked.reduce((n,f)=>n+f.points,0)}分`;
  host.append(el('p','固定版本：'+data.paper.active_version));for(const f of data.provenance.sourceFiles||[])host.append(el('p',f.fileId+' SHA-256：'+f.sha256,'source-label'));
  const rich=(parent,content)=>renderContent(parent,content||{text:'',media:[]},{mediaScope});
  const art=(parent,a)=>rich(parent,{text:'',media:[{kind:'image',url:a.url,alt:a.alt}]});
  for(const g of data.document.groups){
   const card=el('article',undefined,'question-card teacher-past-card');card.append(el('h2',g.title));
   rich(card,g.materialContent||{text:g.material,media:[]});if(g.promptContent?.text)rich(card,g.promptContent);
   for(const a of g.assets)art(card,a);
   for(const c of g.choices){const row=el('div',undefined,'teacher-choice');row.append(el('b',c.id+'　'));rich(row,c.content||{text:c.text,media:[]});card.append(row);}
   for(const f of g.fields){const source=data.provenance.entries?.find(e=>e.id===f.id);card.append(el('p',f.text),el('p','官方答案：'+(['annotation','manual'].includes(g.kind)?f.reference||'請對照官方參考圖':JSON.stringify(f.answer))));if(source)card.append(el('p',`原卷第${source.source.page}頁／解答第${source.answerSource.page}頁；${f.points}分`,'source-label'));}
   if(g.referenceUrl){card.append(el('h3','官方參考圖（教師可見）'));art(card,{url:g.referenceUrl,alt:'官方解答局部參考'});}host.append(card);
  }
  for(const b of blocked){const source=data.provenance.entries?.find(e=>e.id===b.id),card=el('article',undefined,'question-card teacher-past-card');card.append(el('h2',`暫停 ${b.id}（${b.points}分）`),el('p',b.text),el('p',b.reason||'官方答案待確認'));if(source)card.append(el('p','官方原記號：'+source.answerSource.raw),el('p',`原卷第${source.source.page}頁／解答第${source.answerSource.page}頁`));host.append(card);}
  const issues=el('details');issues.append(el('summary','校對問題紀錄'));for(const issue of data.provenance.issues||[])issues.append(el('p',`${issue.id}：${issue.detail}`));host.append(issues);
 }catch{if(token===generation)status.textContent='無法讀取這份試卷，請確認教師管理權限與私有媒體。';}
}
picker?.addEventListener('change',()=>{if(picker.value&&session?.user)preview(picker.value);});
initNavbarAuth({onSessionResolved:async next=>{
 session=next;const token=++generation;scope?.dispose();scope=null;host.replaceChildren();if(picker){picker.replaceChildren();picker.disabled=true;}
 if(!next?.user){status.textContent='請先登入教師帳號。';return;}
 try{const auth=await import('./auth.js');transport=createAuthenticatedTransport({auth,getSession:()=>session});const list=await transport('/rest/v1/rpc/quiz_past_action',{p_action:'preview_list',p_data:{}});if(token!==generation)return;
  if(!list.papers.length){status.textContent='目前沒有可預覽的考古題。';return;}
  for(const p of list.papers)picker?.append(new Option(`${p.grade}年級｜${p.title}${p.enabled?'':'（尚未開放）'}`,p.id));
  const requested=new URLSearchParams(location.search).get('paper'),id=list.papers.find(p=>p.id===requested)?.id||list.papers[0].id;if(picker){picker.value=id;picker.disabled=false;}await preview(id);
 }catch{if(token===generation)status.textContent='此頁僅供考古題的教師管理者預覽。';}
}});
