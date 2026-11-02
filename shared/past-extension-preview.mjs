// Loaded only by the opt-in loopback fixture, never by published course pages.
import {getSession,supabase} from './auth.js';
import {createAuthenticatedTransport} from './quiz-transport.mjs';
import {renderRewardTree} from './reward-tree-renderer.js';
import {LEAF_SLOTS,FLOWER_SLOTS} from './reward-tree-config.js';
if(!['127.0.0.1','localhost'].includes(location.hostname)||!document.querySelector('meta[name="past-extension-preview"]'))throw Error('local_preview_only');
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let session=await getSession(),epoch=0,loading=0;
function identity(){const n=document.getElementById('cloud-identity');if(n)n.textContent=session?.user?.email?'本機合成帳號：'+session.user.email:'請先登入本機測試帳號。';}
identity();
const transport=createAuthenticatedTransport({getSession:()=>session});
const rpc=(action,data={})=>transport('/__past/extension',{action,data});
const practice=data=>transport('/__past/practice',{action:'start',data});
const params=new URLSearchParams(location.search),student=()=>session?.user?.id==='00000000-0000-4000-8001-000000000002'?'2':'1';
const href=(file,extra={})=>'/grade3/115-1/'+file+'?'+new URLSearchParams({fixture_student:student(),...extra});
const standalone=document.getElementById('extension-page'),tree=Boolean(standalone&&location.pathname.includes('tree'));
const box=make('section',undefined,'panel past-extension-summary');box.id='past-extension-summary';
if(standalone)standalone.before(box);else(document.querySelector('main')||document.body).prepend(box);
const label=make('h2','我的延伸努力'),count=make('p','正在讀取…'),progress=make('progress'),message=make('p'),links=make('div',undefined,'extension-actions');
progress.max=10;progress.setAttribute('aria-label','下一片延伸葉的累積題數');count.id='extension-count';message.id='extension-message';message.setAttribute('role','status');
const refresh=make('button','更新練習成果');refresh.type='button';
for(const [text,file] of [['主動選學習重點','extension-topics.html'],['看我的努力樹','extension-tree.html'],['回我的錯題','quiz-library.html']]){const a=make('a',text);a.dataset.extensionFile=file;a.href=href(file)+(file==='quiz-library.html'?'#wrong':'');links.append(a);}
links.append(refresh);box.append(label,count,progress,message,links,make('p','每10道不同題長1片延伸葉，答錯也算；重練不重複計。本學期剩餘題數不跨學期，歷史成果保留。','helper'));
let treePage=0,lastSummary=null;
function drawTree(data){
 if(!tree)return;
 standalone.replaceChildren(make('h2','我的努力樹'),make('p','本機示範：原卷達標葉與延伸葉一起呈現、分開計算。其他課程成果不連正式資料。'));
 const stage=make('div',undefined,'tree-stage'),image=make('img');image.className='tree-image';image.src='/assets/reward-tree/empty-tree-base-v1-q80.webp';image.alt='努力樹';image.width=1254;image.height=1254;
 const layer=make('div',undefined,'reward-layer');layer.id='extension-reward-layer';stage.append(image,layer);standalone.append(stage);
 const details=make('p','每片延伸葉代表已完成10道不同的書商題。'),pages=make('div',undefined,'extension-actions');
 const extensionLeaves=data.awards.map(a=>({kind:'extension-leaf',title:'第'+a.ordinal+'片延伸葉',reason:'完成10道不同的延伸題，答錯也算。',detail:'原卷分數與達標葉不變。',updatedAtText:new Date(a.created_at).toLocaleString('zh-TW')}));
 const originalLeaves=(data.originalAwards||[]).map(a=>({kind:'quiz-leaf',title:'原卷達標葉｜'+a.title,reason:'原卷依原有達標規則取得，與延伸葉分開。',updatedAtText:new Date(a.awarded_at).toLocaleString('zh-TW')}));
 const leaves=[...originalLeaves,...extensionLeaves];
 const pageCount=Math.max(1,Math.ceil(leaves.length/LEAF_SLOTS.length));treePage=Math.min(treePage,pageCount-1);
 renderRewardTree({layer,leaves:leaves.slice(treePage*LEAF_SLOTS.length,(treePage+1)*LEAF_SLOTS.length),flowers:[],leafSlots:LEAF_SLOTS,flowerSlots:FLOWER_SLOTS,onSelect:r=>{details.textContent=r.title+'：'+r.reason+' '+r.updatedAtText;},ghostLeafCount:0,ghostFlowerCount:0});
 for(const [text,delta] of [['上一頁',-1],['下一頁',1]]){const b=make('button',text);b.disabled=delta<0?treePage===0:treePage>=pageCount-1;b.onclick=()=>{treePage+=delta;drawTree(lastSummary);};pages.append(b);}
 pages.append(make('span',`原卷達標葉${originalLeaves.length}片・延伸葉${extensionLeaves.length}片｜第${treePage+1}/${pageCount}頁`));standalone.append(details,pages);
 const history=make('details'),summary=make('summary','歷學期練習紀錄');history.append(summary);
 for(const h of data.history)history.append(make('p',`${h.school_year}學年度第${h.semester}學期：${h.count}道不同題（${Math.floor(h.count/10)}片葉）`));standalone.append(history);
}
async function update(detail){
 const token=++loading,g=epoch,uid=session?.user?.id;
 if(!uid){count.textContent='請先登入本機測試帳號。';return;}
 try{const data=await rpc('summary');if(g!==epoch||uid!==session?.user?.id||token!==loading)return;
  lastSummary=data;count.textContent=`本學期已完成${data.count}道不同題・${data.leaves}片延伸葉・下一片${data.remainder}/10`;progress.value=data.remainder;
  message.textContent=detail?.earnedNow?`長出${detail.earnedNow}片延伸葉！願意回頭練習，就是努力。`:detail?.added?'已記下這次練習；答錯也算努力。':detail?'這道題已計過，重練仍會保留作答紀錄。':'';
  drawTree(data);
 }catch(e){if(g===epoch&&token===loading)message.textContent=e.message;}
}
async function topics(){
 if(!standalone||tree)return;const g=epoch,uid=session?.user?.id;if(!uid)return;
 standalone.replaceChildren(make('h2','選學習重點，再練一次'));
 try{
  const data=await rpc('review',{attempt_id:params.get('attempt')||undefined});if(g!==epoch||uid!==session?.user?.id)return;
  standalone.append(make('h3',data.title));
  if(!data.concepts){
   standalone.append(make('p','原卷完整完成並揭答後，不論分數，都能選重點複習。'));
   if(!data.attempts.length)standalone.append(make('p','目前還沒有已完成的原卷，可以先回選卷作答。'));
   for(const a of data.attempts){const link=make('a',`本次${a.score}/${a.max_score}分｜選學習重點`,'extension-attempt');link.href=href('extension-topics.html',{attempt:a.id});standalone.append(link);}
   return;
  }
  standalone.append(make('p','選自己想加強的重點；滿分也可以練。這些補充重點由AI於製作時整理，線上不呼叫AI。'));
  for(const c of data.concepts){
   const card=make('details',undefined,'extension-topic');card.id='topic-'+c.id;card.open=params.get('concept')===c.id;
   card.append(make('summary',c.title));const list=make('ul');for(const point of c.points)list.append(make('li',point));card.append(list);
   const button=make('button',`練習這個重點（${c.count}題）`,'past-learning-start'),status=make('p');status.setAttribute('role','status');button.type='button';let requestId=null;
   button.onclick=async()=>{if(button.disabled)return;button.disabled=true;requestId??=crypto.randomUUID();status.textContent='正在準備練習…';
    try{const result=await practice({...c.source,request_id:requestId,retake:true});if(g!==epoch||uid!==session?.user?.id||!button.isConnected)return;const url=new URL(result.url,location.origin);if(url.origin!==location.origin||url.pathname!=='/grade3/115-1/quiz.html')throw Error('練習連結無效。');location.assign(url.href);}
    catch(e){if(g===epoch&&button.isConnected)status.textContent=e.message;}finally{if(g===epoch&&button.isConnected)button.disabled=false;}
   };card.append(button,status);standalone.append(card);
  }
  const target=document.getElementById('topic-'+params.get('concept'));if(target){target.scrollIntoView({block:'center'});target.querySelector('summary').focus();}
 }catch(e){if(g===epoch)standalone.append(make('p','暫時無法開啟學習重點：'+e.message));}
}
refresh.onclick=()=>update();window.addEventListener('past-extension-change',e=>update(e.detail));
document.addEventListener('click',event=>{const a=event.target.closest?.('a');if(!a)return;const url=new URL(a.href,location.origin);if(url.origin===location.origin&&url.pathname==='/my-tree.html'){url.searchParams.set('fixture_student',student());a.href=url.href;}});
supabase.auth.onAuthStateChange((_event,next)=>{
 if(session?.user?.id===next?.user?.id)return;session=next;identity();epoch++;loading++;count.textContent='';message.textContent='';progress.value=0;lastSummary=null;standalone?.replaceChildren();
 history.replaceState(null,'',location.pathname);for(const key of [...params.keys()])params.delete(key);
 for(const a of links.querySelectorAll('a[data-extension-file]'))a.href=href(a.dataset.extensionFile)+(a.dataset.extensionFile==='quiz-library.html'?'#wrong':'');
 if(!session?.user){links.hidden=true;history.replaceState(null,'',location.pathname);count.textContent='請先登入本機測試帳號。';return;}
 links.hidden=false;update();topics();
});
if(standalone){const {initNavbarAuth}=await import('./navbar-auth.js');initNavbarAuth();}
await update();await topics();
