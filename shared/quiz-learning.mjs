import {createQuizRequest} from './quiz-api.mjs?v=20261102-learning';
import {resolveSession,supabase} from './auth.js';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const page=document.querySelector('[data-learning-topics]');
const grade=Number(document.body.dataset.grade||location.pathname.match(/grade([346])/u)?.[1]||3);
const link=(file,extra={})=>'/grade'+grade+'/115-1/'+file+(Object.keys(extra).length?'?'+new URLSearchParams(extra):'');
let session=await resolveSession(),generation=0,readVersion=0;
const request=await createQuizRequest({getSession:()=>session});
const box=make('section',undefined,'panel learning-summary');box.hidden=true;box.id='learning-summary';
const h=make('h2','我的練習努力'),count=make('p'),bar=make('progress'),status=make('p'),actions=make('div',undefined,'learning-actions');
count.id='learning-count';status.setAttribute('role','status');bar.max=10;bar.setAttribute('aria-label','下一片延伸葉累積題數');
const refresh=make('button','更新累積');refresh.type='button';actions.append(refresh);
if(grade===3){const a=make('a','主動選學習重點');a.href=link('learning.html');actions.append(a);}
const tree=make('a','看我的努力樹');tree.href='/my-tree.html?course=grade'+grade+'-115-1';actions.append(tree);
box.append(h,count,bar,actions,status,make('p','延伸練習與5題自組卷，合計每10道不同題長1片延伸葉；答錯也算，同題同學期只計首次。原卷達標成果另外保留。','helper'));
(document.querySelector('#cloud-library')||document.querySelector('main')).prepend(box);
async function load(){
 const g=generation,v=++readVersion,uid=session?.user?.id;if(!uid)return;
 try{const d=await request('learning',{action:'summary'});if(g!==generation||v!==readVersion||uid!==session?.user?.id)return;
  box.hidden=!d.enabled;if(!d.enabled)return;count.textContent=`本學期完成${d.count}道不同題・${d.leaves}片延伸葉・下一片${d.remainder}/10`;bar.value=d.remainder;status.textContent='';
 }catch(e){if(g===generation&&v===readVersion){box.hidden=false;count.textContent='';status.textContent=e.message;}}
}
async function topics(){
 if(!page||!session?.user)return;const g=generation,uid=session.user.id,params=new URLSearchParams(location.search),attempt=params.get('attempt');page.replaceChildren(make('h2','選學習重點，再練一次'));
 const identity=document.getElementById('cloud-identity');if(identity)identity.textContent=session.user.email||'已登入學生帳號';
 try{const d=await request('learning',{action:attempt?'topics':'reviews',...(attempt?{attempt_id:attempt}:{})});if(g!==generation||uid!==session?.user?.id)return;
  if(!d.concepts){page.append(make('p','完整完成這份三上自然原卷後，不論分數，都能主動選重點練習。'));
   if(!d.attempts.length)page.append(make('p','目前沒有可複習的已完成原卷。先回考古題專區，完成一份再來。'));
   for(const a of d.attempts){const el=make('a',a.title+`｜本次${a.score}/${a.max_score}分`,'learning-attempt');el.href=link('learning.html',{attempt:a.id});page.append(el);}return;
  }
  page.append(make('h3',d.title),make('p','選想再練習的重點，滿分也可以練。以下補充重點由AI於製作時整理，學生使用時不呼叫AI。'));
  for(const c of d.concepts){
   const card=make('details',undefined,'learning-topic');card.id='concept-'+c.id;card.open=params.get('concept')===c.id;
   card.append(make('summary',c.title));const ul=make('ul');for(const p of c.points)ul.append(make('li',p));card.append(ul);
   const button=make('button',`練習這個重點（${c.count}題）`),note=make('p');button.type='button';note.setAttribute('role','status');let rid=null;
   button.onclick=async()=>{if(button.disabled)return;button.disabled=true;rid??=crypto.randomUUID();note.textContent='正在準備練習…';try{
    const r=await request('learning',{action:'start',mode:'review',attempt_id:d.attempt_id,version:d.version,concept_id:c.id,request_id:rid});if(g!==generation||uid!==session?.user?.id||!button.isConnected)return;
    const url=new URL(r.url,location.origin);if(url.origin!==location.origin||!/^\/grade[346]\/115-1\/quiz\.html$/.test(url.pathname))throw Error('練習連結無效。');location.assign(url.href);
   }catch(e){if(g===generation&&note.isConnected)note.textContent=e.message;}finally{if(g===generation&&button.isConnected)button.disabled=false;}};
   card.append(button,note);page.append(card);
  }
  document.getElementById('concept-'+params.get('concept'))?.querySelector('summary')?.focus();
 }catch(e){if(g===generation)page.append(make('p','無法開啟這次複習：'+e.message));}
}
function clear(){generation++;readVersion++;box.hidden=true;count.textContent='';status.textContent='';bar.value=0;page?.replaceChildren();}
refresh.onclick=()=>load();
supabase.auth.onAuthStateChange((_event,next)=>{if(session?.user?.id===next?.user?.id)return;session=next;clear();if(page)history.replaceState(null,'',location.pathname);if(next?.user)setTimeout(()=>{load();topics();},0);else if(page)page.append(make('p','請先登入名冊中的學生帳號。'));});
if(page){const {initNavbarAuth}=await import('./navbar-auth.js');initNavbarAuth();}
if(session?.user){await load();await topics();}else if(page)page.append(make('p','請先登入名冊中的學生帳號。'));
