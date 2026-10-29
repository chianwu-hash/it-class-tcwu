import {initNavbarAuth} from './navbar-auth.js';import {createAuthenticatedTransport} from './quiz-transport.mjs?v=20261029-batch4';import {initImageLightbox} from './image-lightbox.js';
let session=null,generation=0;const host=document.getElementById('teacher-preview'),status=document.getElementById('teacher-status');
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
initImageLightbox({root:host,selector:'img'});
initNavbarAuth({onSessionResolved:async next=>{session=next;const token=++generation;host.replaceChildren();if(!next?.user){status.textContent='請先登入教師帳號。';return;}
 try{const auth=await import('./auth.js'),transport=createAuthenticatedTransport({auth,getSession:()=>session});const data=await transport('/rest/v1/rpc/quiz_past_action',{p_action:'preview',p_data:{paper_id:'dingxi-114-1-g3-exam1-science'}});if(token!==generation)return;
  status.textContent=data.paper.title+'｜教師專用・63個自動核對欄位／畫圖自核對／3欄答案待確認';
  host.append(el('p','固定版本：'+data.paper.active_version));for(const f of data.provenance.sourceFiles)host.append(el('p',f.fileId+' SHA-256：'+f.sha256));
  for(const g of data.document.groups){const card=el('article','');card.className='question-card';card.append(el('h2',g.title),el('p',g.material));for(const c of g.choices)card.append(el('p',c.id+'　'+c.text));for(const f of g.fields){const source=data.provenance.entries.find(e=>e.id===f.id);card.append(el('p',f.text),el('p','官方答案：'+(g.kind==='annotation'?'完成標示後自核對':JSON.stringify(f.answer))),el('p',`原卷第${source.source.page}頁／解答第${source.answerSource.page}頁；${f.points}分`));}
   host.append(card);for(const a of [...g.assets,...(g.referenceUrl?[{url:g.referenceUrl,alt:'官方解答局部參考'}]:[])]){const img=document.createElement('img');img.alt=a.alt;img.style.maxWidth='100%';card.append(img);transport('/functions/v1/quiz-media',{action:'read',url:a.url}).then(r=>{if(token===generation&&img.isConnected)img.src=r.url;}).catch(()=>{if(token===generation)status.textContent='圖片讀取失敗，請確認私有媒體權限。';});}
  }
  for(const b of data.document.blocked){const source=data.provenance.entries.find(e=>e.id===b.id);host.append(el('h2',`待確認 ${b.id}（${b.points}分）`),el('p',b.text),el('p','官方原記號：'+source.answerSource.raw),el('p',`原卷第${source.source.page}頁／解答第${source.answerSource.page}頁`));for(const issue of data.provenance.issues.filter(i=>i.questions?.includes(b.id)))host.append(el('p',issue.detail));}
 }catch{if(token===generation)status.textContent='此頁只供這份考古題的教師管理者預覽。';}
}});
