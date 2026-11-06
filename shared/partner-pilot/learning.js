import {createQuizWorkspace} from '../quiz-workspace.mjs?v=20261106-partner-workspace';
import {partnerKeepsakeSvg} from '../quiz-partner-rewards.mjs?v=20261106-keepsake';
import {mountPastResults} from './past-results.js';
import {mountPastAnswers} from './past-answer.js';
import {createRichContent} from './rich-content.js';
import {appendSingleChoiceOptions} from '../quiz-choice.mjs';
import {createCampPanel} from './camp-panel.mjs?v=20261106-draft';
import {practiceUnits} from './practice-model.mjs';
import {unsentQuestions,taskOutcome,rewardLabel,createAwardTracker} from './outcome-model.mjs?v=20261106-keepsake';
// User-owned sharing invitation: preserve this wording when simplifying the UI.
const sharingLabel='這題不能只有我知道';
const tagLabels={hard:'有點難',interesting:'有意思',careful:'容易忽略',method:'不同解法'};
const tags={hard:'有點難，想一起弄清楚',interesting:'有意思，想讓大家看看',careful:'有個地方容易忽略',method:'想交換不同方法'};
export function createLearningUI({container,esc,onAction,onHome,onRefresh,onRetry,notice,loadMedia,storeMessageMedia,readMessageMedia,onStage,scene=()=>''}){
 let current=null,viewer=null,view='practice',drafts=new Map(),editing=new Set(),markedOnly=false,panel=null,activeQuestion=null,contentKey='',composing=false,drawing=false,transport={},savingMedia=false,saveEpoch=0;
 const attemptsAtRender=new Map(),draftVersions=new Map();let workspace=null,activeAnswer=null,lastHeaderView=null;let content,units=[],exitDialog=null,guideKey='',celebrationKey='',summaryRequested=false,calloutObserver=null;
 const awardTracker=createAwardTracker();
 const scopeRoot=container.closest('.partner-content')||container.parentElement;
 const key=(kind,qid='')=>kind+'-'+qid;
 const question=n=>current?.exercise.mine.find(q=>q.id===n)||current?.exercise.shared.find(q=>q.id===n);
 function capture(){scopeRoot.querySelectorAll('[data-draft]').forEach(el=>{if(el.type!=='radio'||el.checked){drafts.set(el.dataset.draft,el.value);if(el.dataset.draft.startsWith('answer-')){const qid=Number(el.dataset.draft.slice(7));if(!draftVersions.has(qid))draftVersions.set(qid,attemptsAtRender.get(qid)??question(qid)?.attempts.length??0);}}});}
 const value=k=>esc(drafts.get(k)||'');
 const notes=(kind,qid)=>current.exercise.notes.filter(n=>n.kind===kind&&(qid===undefined||n.qid===qid));
 const rich=createRichContent({getQuestion:question,getContext:()=>current&&viewer?{room:current.id,user:viewer.id,view}:null,loadMedia});
 const fragment=(q,part,index='')=>'<span class="rich-fragment" data-rich-q="'+q.id+'" data-rich-part="'+part+'" data-rich-index="'+index+'"></span>';
 const submit=(p,options)=>{if(savingMedia&&p.action!=='save_draft'){notice('正在儲存附件，請稍候。');return;}return onAction({...p,roomId:current.id},options);};
 async function saveExit(confirmed=false,stay=false){if(savingMedia||transport.busy||transport.pending){notice('上一筆操作還在處理，請先等候或確認重送結果。');return;}capture();if(!stay&&!confirmed&&pendingAnswers().length){confirmExit();return;}const id=current.id,user=viewer.id,epoch=++saveEpoch;savingMedia=true;panel.setTransport({...transport,busy:true});try{notice('正在儲存草稿與附件，請稍候…');const media=await panel.saveMedia();if(current?.id!==id||viewer?.id!==user||epoch!==saveEpoch)return;capture();const attempts=Object.fromEntries(current.exercise.mine.map(q=>[q.id,draftVersions.get(q.id)??q.attempts.length]));const open=[...content.querySelectorAll('details[open]')].map(e=>e.dataset.detail).filter(Boolean);return await submit({action:'save_draft',draftRevision:current.exercise.privateDraft?.revision||0,state:{view,drafts:Object.fromEntries(drafts),editing:[...editing],attempts,open,markedOnly,current:{qid:activeQuestion},media}},{stay});}catch{notice(stay?'附件尚未儲存，畫圖仍留在這裡，請稍後再按儲存草稿。':'附件尚未儲存，草稿仍留在這裡，請稍後再按儲存退出。',true);}finally{if(epoch===saveEpoch){savingMedia=false;panel?.setTransport({...transport,busy:transport.busy||savingMedia});}}}
 function restore(r){const saved=r.exercise.privateDraft?.state;if(!saved||typeof saved!=='object')return;view=['practice','review','book'].includes(saved.view)?saved.view:'practice';if(view==='review'&&!r.exercise.reviewOpen)view='practice';markedOnly=!!saved.markedOnly;activeQuestion=r.exercise.mine.some(q=>q.id===saved.current?.qid)?saved.current.qid:null;for(const [k,v] of Object.entries(saved.drafts||{}))if(typeof v==='string'&&v.length<=500000&&/^(answer|ask|reply|mark|tag|discuss|reflection|chat)-[0-9]*$/.test(k))drafts.set(k,v);for(const q of r.exercise.mine){if(Number(saved.attempts?.[q.id])!==q.attempts.length)drafts.delete(key('answer',q.id));else {if(drafts.has(key('answer',q.id)))draftVersions.set(q.id,q.attempts.length);if(Array.isArray(saved.editing)&&saved.editing.includes(q.id))editing.add(q.id);}}}
 function finishControl(){const e=current.exercise;if(e.finished||e.reviewers.length!==current.capacity)return '';return '<button class="primary" data-finish-review '+(e.reviewers.length===current.capacity?'':'disabled')+'>把這次練習收進共同紀錄冊 →</button>';}
 function committed(p,result){if(p.roomId!==current?.id)return;capture();if(p.action==='save_draft')panel?.draftSaved();const keepComposer=['ask','reply','chat','mark'].includes(p.action)&&drafts.get(key(p.action,p.action==='reply'?p.thread:p.qid??''))!==p.text;const draftKey={answer:'answer',chat:'chat',ask:'ask',reply:'reply',mark:'mark',discuss:'discuss',review:'reflection'}[p.action];if(draftKey&&!keepComposer){const k=key(draftKey,p.action==='reply'?p.thread:p.qid??'');drafts.delete(k);if(p.action==='answer')draftVersions.delete(p.qid);scopeRoot.querySelectorAll('[data-draft]').forEach(el=>{if(el.dataset.draft===k){if(el.type==='radio')el.checked=false;else el.value=p.action==='review'?(p.text||''):'';}});}if(p.action==='review')drafts.set('reflection-',p.text||'');if(p.action==='answer')editing.delete(p.qid);if(p.action==='finish'||p.action==='review'&&!current.exercise.finished&&result?.exercise?.finished){view='book';contentKey='';summaryRequested=true;}panel?.committed(p);if(p.action==='mark'&&!keepComposer){const el=content.querySelector('#mark-panel-'+p.qid),focused=el?.contains(document.activeElement);if(el)el.open=false;if(focused)content.querySelector('[data-toggle-mark="'+p.qid+'"]')?.focus({preventScroll:true});}}
 function feedback(q){const last=q.attempts?.at(-1);return last?`<div class="feedback ${last.correct===null?'self-check':last.correct?'right':'retry-feedback'}"><b>${last.correct===null?'已留下開放作答，請和參考內容自我核對；這題不自動判分。':last.correct?'這次答對了。':'這次還沒想通，可以請教或看看解法，再自己試一次。'}</b>${q.past?`<div data-past-result="${q.id}"></div>`:''}<div>${fragment(q,'explanation')}</div><p class="muted">${q.attempts.length>1?'初次作答仍保留，這次是訂正後再試。':'這是第一次作答的紀錄。'}</p>${last.correct===false?`<button data-edit="${q.id}">我想自己再試一次</button>`:''}</div>`:'';}
 function marks(q){return notes('mark',q.id).map(n=>`<p class="mark-note">★ ${esc(n.name)}：${esc(tags[n.tag])}${n.text?' — '+esc(n.text):''}</p>`).join('');}
 function ownQuestion(q){const last=q.attempts.at(-1),canAnswer=!last||editing.has(q.id);return `<article class="question-card" data-qid="${q.id}" ${q.past?'data-past-question':''}><p class="muted">我負責的第 ${current.exercise.mine.findIndex(item=>item.id===q.id)+1} / ${current.exercise.mine.length} ${q.past?'個作答位置':'題'}</p><h3>${esc(q.title)}</h3><div class="question-text">${fragment(q,'prompt')}</div><form id="answer-${q.id}" data-form="answer" data-qid="${q.id}">${q.past?(canAnswer?`<div data-past-answer="${q.id}"></div>`:''):`<fieldset class="quiz-choices" data-normal-choices="${q.id}"><legend>選擇一個答案</legend></fieldset>`}${canAnswer?'<button type="submit" hidden tabindex="-1">送出答案</button>':''}</form><p class="answer-state" data-answer-state="${q.id}"></p><div class="question-extras">${q.past?`<p class="question-support-context">${esc(q.title)}</p>`:''}<div class="question-support-actions"><button type="button" data-ask-q="${q.id}">🙋 問夥伴</button><button type="button" data-toggle-mark="${q.id}" aria-expanded="false" aria-controls="mark-panel-${q.id}">${notes('mark',q.id).length?'✓ ':'☆ '}${sharingLabel}</button></div><details class="question-mark-panel" id="mark-panel-${q.id}" data-detail="mark-${q.id}"><summary hidden>${sharingLabel}</summary><form data-form="mark" data-qid="${q.id}"><fieldset class="mark-reasons"><legend>標記原因</legend>${Object.entries(tagLabels).map(([k,t])=>`<label><input type="radio" name="tag" value="${k}" data-draft="tag-${q.id}" ${(drafts.get(key('tag',q.id))||'hard')===k?'checked':''} required><span>${t}</span></label>`).join('')}</fieldset><label class="mark-comment">補充一句（選填）<textarea data-draft="mark-${q.id}" rows="2" maxlength="600" placeholder="例如：這裡要先算總共有多少。">${value(key('mark',q.id))}</textarea></label><div class="mark-panel-actions"><button type="submit">加入共同回顧</button><button type="button" data-close-mark="${q.id}">收起</button></div></form></details></div><div data-question-marks="${q.id}">${marks(q)}</div></article>`;}

 function stories(){return `<div class="stories">${current.exercise.stories.map(s=>`<article class="story"><div class="story-avatar">${esc(s.name.slice(-1))}</div><h3>${esc(s.name)}的努力片段</h3><ul>${s.lines.map(line=>`<li>${esc(line)}</li>`).join('')}</ul>${s.reflection?`<blockquote>${esc(s.reflection)}</blockquote>`:''}</article>`).join('')}</div>`;}
 function reviewProgress(){const e=current.exercise;if(e.finished)return '<p class="ok">全員共同回顧已完成，結果已收進任務總結；仍可交換發現與訂正。</p>';const done=e.reviewers.some(r=>r.user===viewer.id),waiting=current.members.filter(m=>!e.reviewers.some(v=>v.user===m.id)).map(m=>m.name).join('、'),o=taskOutcome(current);return `<div class="review-stage"><h3>${done?'你的回顧已確認':'大家的答案都送出了！'}</h3><p>答題 → <b>共同回顧</b> → 任務總結</p><p>回顧已確認 ${e.reviewers.length}／${current.capacity} 人${waiting?'，等待'+esc(waiting)+'確認':''}。</p><p>${done?'謝謝你看過夥伴的題目，可以繼續交換發現。':'先看大家標記的題，再看看其他題目與努力片段，最後按「我看過大家的題目了」。'}</p><p class="muted">${o.graded?`目前答對 ${e.correct}／${o.graded} 個判分欄位${o.eligible?'，已達答題門檻':''}。`:''}全員確認回顧後才會完成任務，達60%再發放紀念葉花。</p></div>`;}
 function review(){const e=current.exercise;if(!e.reviewOpen)return '<section class="card"><h2>共同回顧還沒開啟</h2><p>等每一道題都有自己的第一次作答後，就能一起看完整份題組。現在仍可到共同營地相互請教。</p></section>';
 const all=e.shared.filter(q=>!markedOnly||notes('mark',q.id).length),sorted=[...all].sort((a,b)=>Number(notes('mark',b.id).length>0)-Number(notes('mark',a.id).length>0)||(a.number??a.id)-(b.number??b.id));return `<section class="card"><h2>把彼此的題目帶回來，一起看看</h2>${e.finished?'<p class="ok">共同回顧已記下，仍可回到題目訂正。<button data-view="book">一起翻開紀錄冊</button></p>':''}${reviewProgress()}${finishControl()}<button data-save-exit>儲存退出</button><p>你解的題，夥伴可能還沒見過。先看大家標記的地方，再交換自己的發現。</p><div class="actions"><button data-filter="all" aria-pressed="${!markedOnly}">看整份題組</button><button data-filter="marked" aria-pressed="${markedOnly}">看值得一起注意的題</button></div>${sorted.length?sorted.map(q=>`<article class="question-card tone-${((q.number??q.id)-1)%20}" data-review-qid="${q.id}"><small>第 ${q.number??q.id} ${q.past?'欄位':'題'}・由${esc(q.ownerName)}帶來</small><h3>${esc(q.title)}</h3><div>${fragment(q,'material')}${fragment(q,'prompt')}</div>${q.past?.selfCheck?'<p class=muted>開放作答供自我核對，不列入正確率。</p>':''}<ol>${q.options.map((o,i)=>`<li>${fragment(q,'option',i)}${i===q.correct?' ✓':''}</li>`).join('')}</ol>${marks(q)}<details data-detail="method-${q.id}"><summary>一起看看解法</summary><div>${fragment(q,'explanation')}</div></details>${notes('discuss',q.id).map(n=>`<p class="reply"><b>${esc(n.name)}</b>：${esc(n.text)}</p>`).join('')}<form data-form="discuss" data-qid="${q.id}"><label>我的新發現<textarea data-draft="discuss-${q.id}" maxlength="600" placeholder="原來這題要注意……" required>${value(key('discuss',q.id))}</textarea></label><button>分享在這一題</button></form></article>`).join(''):'<p>還沒有標記題目。也可以先回到自己的題目，把想分享的題帶過來。</p>'}<h2>每個人的努力，都留在這裡</h2>${stories()}${scene('discover','partner-review-art')}<form data-form="review"><label>這次想留下的一句話（可略過）<textarea data-draft="reflection-" maxlength="240" placeholder="例如：有人陪著想，讓我敢再試一次。">${drafts.has('reflection-')?value('reflection-'):esc(e.reviewers.find(r=>r.user===viewer.id)?.reflection||'')}</textarea></label><button class="green">${e.reviewers.some(r=>r.user===viewer.id)?'更新我的回顧':'我看過大家的題目了'}</button></form><div class="review-checks">${current.members.map(m=>`<span class="badge">${esc(m.name)}：${e.reviewers.some(r=>r.user===m.id)?'已完成回顧':'還在看大家的題目'}</span>`).join('')}</div>${!e.finished&&e.reviewers.length===current.capacity?'<button id="finish-review" class="primary">完成結算，看看共同總結 →</button>':''}<button data-save-exit>儲存退出</button></section>`;}
 function memento(a){const art=Array.from({length:a.leaves},()=>partnerKeepsakeSvg(false)).join('')+(a.flowers?partnerKeepsakeSvg(true):''),grade=Number(current.paperInfo?.grade||document.body.dataset.grade),tree=[3,4,6,9].includes(grade)?`/my-tree.html?course=grade${grade}-115-1`:null;return `<section class="memento"><div class="memento-art" aria-hidden="true">${art}</div><h3>${esc(a.record.team)}的夥伴紀念${a.flowers?'花':'葉'}</h3><p>${a.flowers?'努力樹上以金邊彩色愛心花呈現。':'努力樹上以金邊雙葉呈現。'}每位夥伴各收藏 ${esc(rewardLabel(a))}。</p><p>一起留下的記號：${a.record.stories.map(s=>esc(s.name)).join('、')}</p><small>${esc(new Date(a.at).toLocaleDateString('zh-TW'))}・紀念編號 ${esc(a.id.slice(0,8))}</small><div class="actions"><button type="button" data-replay-keepsake>重播紀念慶祝</button>${tree?`<a href="${tree}">到努力樹查看紀念與來源 →</a>`:''}</div><p class="muted">重播只呈現慶祝，不會重複領取葉花。</p></section>`;}
 function outcomeResult(){
  const e=current.exercise,a=e.award,o=taskOutcome(current);
  if(!e.finished)return '<div class="outcome-result"><h3>先一起回顧，再留下總結</h3><p>每位夥伴看過大家的題目後，就能收進共同紀錄冊。</p><button data-view="review">去共同回顧</button></div>';
  if(a)return `<div class="outcome-result"><h3>${a.earnedHere?'一起達標，紀念已入努力樹！':'這份夥伴紀念已收藏'}</h3><p>${a.earnedHere?`每位夥伴各獲得 ${esc(rewardLabel(a))}。`:'相同題組、相同夥伴不重複增加；本次練習與努力仍會保留。'}</p></div>${memento(a)}${!a.earnedHere?`<details data-detail="prior-award"><summary>翻看紀念當時的共同片段</summary>${a.record.stories.map(s=>`<p><b>${esc(s.name)}</b>：${s.lines.map(esc).join(' ')}</p>`).join('')}</details>`:''}`;
  if(!o.graded)return '<div class="outcome-result"><h3>練習與回顧已留下</h3><p>這份練習全部採自我核對，沒有可判分欄位，因此不計算60%達標或發放紀念。可以和夥伴一起看看學會了什麼。</p></div>';
  if(o.eligible)return '<div class="outcome-result"><h3>全組已達到60%，等待收藏紀念</h3><p>請按下方按鈕確認領取；收到伺服器確認後，才會顯示紀念已入努力樹。</p><button id="settle" class="primary">大家一起收下紀念</button></div>';
  return `<div class="outcome-result needs-correction"><h3>這次還沒達標，可以訂正補達</h3><p>距離60%還需訂正 ${o.needed} 個可判分欄位。原本作答與每次訂正都會保留，不用重開任務。</p>${o.correctable.length?'<button data-correct-own class="green">回到我的可訂正題 →</button>':'<p>你目前沒有待訂正的判分題，可以到共同營地陪夥伴想方法。</p><button data-open-camp>到共同營地互相支援</button>'}</div>`;
 }
 function book(){const e=current.exercise,o=taskOutcome(current);return `<section class="card"><h2>我們的共同紀錄冊</h2><p>記得這次和誰一起想，也記得自己願意再試的那一步。</p>${outcomeResult()}<div class="team-result"><p>全組目前答對 ${e.correct} / ${o.graded} 個可判分欄位（${Math.round(e.correct/o.graded*100)||0}%）</p>${e.total>o.graded?`<p>另有 ${e.total-o.graded} 個開放作答欄位，採自我核對，不列入正確率。</p>`:''}<p class="muted">第一次作答與訂正都各自保留，可以回到自己的題目看看學會的過程。這是小隊狀態，不是個人排名。</p></div>${stories()}<p class="muted">達標後，全員的紀念會直接計入各自努力樹。</p><button data-save-exit>儲存退出</button>${scene('keepsake','partner-record-art')}</section>`;}
 function pendingAnswers(){return unsentQuestions(current.exercise.mine,drafts,draftVersions,editing);}
 const draftNames=qs=>qs.map(q=>`第 ${q.number??q.id} ${q.past?'欄':'題'}${q.attempts.length?'（訂正）':''}`).join('、');
 function navigate(next,qid){
  if(transport.busy||transport.pending||savingMedia){notice('上一筆操作還在處理，請先等候或確認重送結果。');return;}
  capture();const left=pendingAnswers();view=next;if(qid!==undefined)activeQuestion=qid;contentKey='';render(current,viewer);
  if(next==='practice'&&qid!==undefined){container.querySelector('#focus-question-heading')?.focus({preventScroll:true});container.querySelector('.focus-team-bar')?.scrollIntoView({block:'nearest'});}
  if(next==='review'){content.scrollIntoView({block:'start'});const heading=content.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
  if(left.length)notice(`${draftNames(left)}還沒送出；已暫留在本頁。按「送出答案」才算完成，離開前可儲存草稿。`);
 }
 function focusCelebration(){const h=container.querySelector('[data-celebration] h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});h.scrollIntoView({block:'center'});}}
 function correctOwn(){const q=taskOutcome(current).correctable[0];if(q){navigate('practice',q.id);content.querySelector('#focus-question-heading')?.focus({preventScroll:true});}}
 function confirmExit(){
  if(exitDialog?.open)return;
  if(scopeRoot.querySelector('dialog[open]')){notice('請先收起目前的視窗，再儲存退出。',true);return;}
  let choice=null;const epoch=saveEpoch,room=current.id,user=viewer.id,qs=pendingAnswers(),dialog=document.createElement('dialog');exitDialog=dialog;dialog.className='outcome-dialog';dialog.setAttribute('aria-labelledby','unsent-exit-title');
  dialog.innerHTML=`<h2 id="unsent-exit-title">還有 ${qs.length} 題尚未送出</h2><p>${esc(draftNames(qs))}</p><p>只儲存草稿不會算作完成，隊友仍會等你送出答案。</p><button class="primary" data-return-answer autofocus>回去確認並送出答案</button><button data-save-only>只儲存草稿並退出（不會送出）</button>`;
  scopeRoot.append(dialog);
  const valid=()=>epoch===saveEpoch&&current?.id===room&&viewer?.id===user;
  const back=()=>{if(valid())navigate('practice',qs[0].id);};choice=back;
  dialog.querySelector('[data-return-answer]').onclick=()=>{choice=back;dialog.close();};
  dialog.querySelector('[data-save-only]').onclick=()=>{choice=()=>{if(valid())void saveExit(true);};dialog.close();};
  dialog.addEventListener('cancel',()=>{choice=back;});
  dialog.addEventListener('close',()=>{const chosen=choice;choice=null;dialog.remove();if(exitDialog===dialog)exitDialog=null;chosen?.();},{once:true});dialog.showModal();
 }
 function updateOutcomeChrome(){
  if(!current||!content)return;
  const e=current.exercise,o=taskOutcome(current),pending=pendingAnswers();
  for(const el of content.querySelectorAll('[data-answer-state]')){
   const q=question(Number(el.dataset.answerState)),unsent=pending.some(x=>x.id===q.id),last=q.attempts.at(-1);
   const text=unsent?(last?'訂正已填・尚未送出。按「送出這次訂正」才會更新紀錄。':'已選／已填・尚未送出。按「送出答案」才算完成。'):last?'已送出，作答紀錄已保存。':'尚未送出。完成選答後，記得按「送出答案」。';
   if(el.textContent!==text)el.textContent=text;el.dataset.unsent=String(unsent);
  }
  // Update the existing button without replacing an active answer/IME/audio DOM.
  for(const b of content.querySelectorAll('[data-view="review"]'))b.disabled=!e.reviewOpen||!!transport.busy||!!transport.pending;
  for(const b of content.querySelectorAll('[data-finish-review],#finish-review'))b.disabled=e.finished||!o.allReviewed||!!transport.busy||!!transport.pending;
  let html=pending.length?`<div class="outcome-unsent"><b>你有 ${pending.length} 題還沒送出</b><p>${esc(draftNames(pending))}。草稿不算完成。</p><button data-return-unsent>回到未送出的答案</button></div>`:'';
  if(e.finished){
   const title=e.award?(e.award.earnedHere?'小隊已達標，紀念已入努力樹':'本次紀錄已保存，夥伴紀念已收藏'):!o.graded?'練習與回顧已留下':o.eligible?'全組已達到60%，到紀錄冊確認收藏紀念':`這次還沒達標，還需訂正 ${o.needed} 個判分欄位`;
   html+=`<p><b>${title}</b></p>`+(view!=='book'?'<button data-guide-book class="primary">翻開任務總結與共同紀錄冊 →</button>':'');
   if(!e.award&&!o.eligible&&o.graded&&o.correctable.length&&view!=='practice')html+='<button data-correct-own>回到我的可訂正題</button>';
  }else if(o.allReviewed)html+='<p><b>大家都完成回顧了，把這次努力收進共同紀錄冊。</b></p><button data-guide-finish class="primary">完成任務，看看共同總結 →</button>';
  else if(e.reviewOpen)html+=reviewProgress()+(view!=='review'&&!e.reviewers.some(r=>r.user===viewer.id)?'<button data-guide-review class="primary">開始共同回顧 →</button>':'');
  else if(e.mine.length&&e.mine.every(q=>q.attempts.length))html+=`<p><b>你的題目都已送出，等夥伴一起完成（全組 ${e.submitted} / ${e.total}）。</b></p><button data-guide-camp>到共同營地互相支援</button>`;
  const callout=container.querySelector('[data-review-callout]'),awaiting=e.reviewOpen&&!e.finished&&view!=='review'&&!e.reviewers.some(r=>r.user===viewer.id);
  callout.hidden=!awaiting;container.querySelector('.partner-focus').dataset.awaitingReview=String(awaiting);
  scopeRoot.style.setProperty('--review-callout-height',callout.offsetHeight+'px');
  const calloutText=awaiting?'全組已送出答案。下一步：每位夥伴一起回顧彼此的題目。':'';
  if(callout.querySelector('p').textContent!==calloutText)callout.querySelector('p').textContent=calloutText;
  const calloutButton=callout.querySelector('button');calloutButton.disabled=!!transport.busy||!!transport.pending||savingMedia;
  calloutButton.onclick=()=>navigate('review');
  const guide=container.querySelector('[data-outcome-guide]'),focused=document.activeElement;
  const hadGuideFocus=guide.contains(focused),focusName=hadGuideFocus?['data-return-unsent','data-guide-book','data-guide-review','data-guide-finish','data-guide-camp','data-correct-own'].find(name=>focused.hasAttribute(name)):null;
  const guideChanged=guideKey!==html;if(guideChanged){guide.innerHTML=html;guideKey=html;}
  // Assign handlers rather than accumulating listeners on unchanged snapshots.
  for(const b of guide.querySelectorAll('button')){
   b.disabled=!!transport.busy||!!transport.pending||savingMedia;
   if(b.hasAttribute('data-return-unsent'))b.onclick=()=>navigate('practice',pendingAnswers()[0]?.id);
   if(b.hasAttribute('data-guide-book'))b.onclick=()=>navigate('book');
   if(b.hasAttribute('data-guide-review'))b.onclick=()=>navigate('review');
   if(b.hasAttribute('data-guide-finish'))b.onclick=()=>submit({action:'finish'});
   if(b.hasAttribute('data-guide-camp'))b.onclick=()=>panel.open();
   if(b.hasAttribute('data-correct-own'))b.onclick=correctOwn;
  }
  if(guideChanged&&hadGuideFocus){const nextFocus=(focusName&&guide.querySelector(`[${focusName}]:not(:disabled)`))||guide.querySelector('button:not(:disabled)')||guide;nextFocus.tabIndex=nextFocus===guide?-1:0;nextFocus.focus({preventScroll:true});}
  const nextStep=content.querySelector('[data-answer-next-step]');
  if(nextStep){
   const remaining=e.mine.filter(q=>!q.attempts.length),mineDone=e.mine.length>0&&!remaining.length,reviewed=e.reviewers.some(r=>r.user===viewer.id);
   let step='';
   if(e.finished)step='<h3>任務已完成，接下來看共同總結</h3><p>到共同紀錄冊看看這次的努力與紀念。</p><button type="button" data-dock-book class="primary">查看共同紀錄冊 →</button>';
   else if(e.reviewOpen)step=`<h3>${reviewed?'你已確認回顧，等夥伴一起完成':'答題完成！下一步：共同回顧'}</h3><p>${reviewed?'全員確認回顧後，系統會完成結算。你也可以再看看大家的題目。':'看看夥伴解過的題目，再按「我看過大家的題目了」確認回顧。全員確認後，才會完成任務並結算紀念葉花。'}</p><button type="button" data-dock-review class="primary">前往共同回顧 →</button>`;
   else if(mineDone)step=`<h3>你的題目都已送出，下一步是共同回顧</h3><p>全組已送出 ${e.submitted}／${e.total} 題。等所有夥伴送出答案後，這裡就能開啟共同回顧；現在可以到共同營地互相支援。</p><button type="button" disabled>等全員送答後，前往共同回顧</button>`;
   else if(unitIndex()===units.length-1&&remaining.length)step=`<h3>還有 ${remaining.length} 題尚未送出</h3><p>送出自己的全部答案後，等夥伴也完成，就能一起回顧。</p><button type="button" data-dock-unanswered="${remaining[0].id}" class="primary">回到尚未送出的題目 →</button>`;
   nextStep.hidden=!step;
   if(nextStep.innerHTML!==step)nextStep.innerHTML=step;
   for(const b of nextStep.querySelectorAll('[data-dock-review],[data-dock-book],[data-dock-unanswered]')){
    b.disabled=!!transport.busy||!!transport.pending||savingMedia;
    b.onclick=()=>{if(b.hasAttribute('data-dock-review'))navigate('review');else if(b.hasAttribute('data-dock-book'))navigate('book');else{navigate('practice',Number(b.dataset.dockUnanswered));content.querySelector('#focus-question-heading')?.focus({preventScroll:true});content.scrollIntoView({block:'start'});}};
   }
  }
  const primary=content.querySelector('[data-workspace-primary]'),dockStatus=content.querySelector('[data-workspace-status]');
  if(primary&&dockStatus){
   const unit=units[unitIndex()],answerable=(unit?.questions||[]).filter(q=>!q.attempts.length||editing.has(q.id));
   const target=answerable.find(q=>q.id===activeAnswer)||answerable[0],remaining=e.mine.filter(q=>!q.attempts.length);
   let label='',message='',go=null,disabled=false;
   primary.removeAttribute('form');primary.type='button';primary.onclick=null;
   if(target){
    primary.type='submit';primary.setAttribute('form','answer-'+target.id);
    label=target.attempts.length?'送出這次訂正':unit.questions.length>1?`送出第 ${unit.questions.findIndex(q=>q.id===target.id)+1} 小題答案`:'送出答案';
    message=unit.questions.length>1?'填好目前的小題，再按右側按鈕送出；每個小題都需要送出。':'選好答案後，按「送出答案」。';
   }else if(e.reviewOpen&&!e.finished&&!remaining.length){label='共同回顧 →';message='答案已送出。下一步：看看夥伴的題目，並確認共同回顧。';go=()=>navigate('review');}
   else if(e.finished){label='共同紀錄冊 →';message='任務已完成，看看這次的共同總結。';go=()=>navigate('book');}
   else if(!remaining.length){label='等待夥伴完成';message=`你的答案已送出（全組 ${e.submitted}／${e.total}）。全員完成後，一起共同回顧。`;disabled=true;}
   else if(unitIndex()<units.length-1){label='下一題 →';message='這一題已送出，可以繼續下一題。';go=()=>navigate('practice',units[unitIndex()+1].questions[0].id);}
   else if(remaining.length){label='回到未完成的題目 →';message=`還有 ${remaining.length} 題尚未送出。`;go=()=>navigate('practice',remaining[0].id);}
   if(primary.textContent!==label)primary.textContent=label;
   primary.disabled=disabled||!!transport.busy||!!transport.pending||savingMedia;
   if(go)primary.onclick=go;
   if(transport.busy||savingMedia)message='正在儲存，請稍候…';else if(transport.pending)message='上一筆答案待確認，請依儲存提示重試，不要重新作答。';else if(transport.bad&&transport.message)message=transport.message;
   if(dockStatus.textContent!==message)dockStatus.textContent=message;
   dockStatus.dataset.error=String(!!transport.bad);
  }
  const a=awardTracker.update(current,viewer),celebration=container.querySelector('[data-celebration]');
  const art=partnerKeepsakeSvg(!!a?.flowers),celebrationHtml=a?`<span class="celebration-symbol" aria-hidden="true">${art}</span><div class="celebration-copy"><h2>${a.replay?'回看已收藏的夥伴紀念':'一起學會，留下夥伴紀念！'}</h2><p>每位夥伴各獲得 ${esc(rewardLabel(a))}，已計入努力樹。${a.replay?'重播不會重複領獎。':''}</p><button data-celebration-book>看看我們的共同紀錄冊</button></div><button class="celebration-close" data-celebration-close aria-label="關閉達標慶祝">關閉</button>`:'';
  if(celebrationKey!==celebrationHtml){celebration.innerHTML=celebrationHtml;celebrationKey=celebrationHtml;}
  const close=celebration.querySelector('[data-celebration-close]');if(close)close.onclick=()=>{const focusedHere=celebration.contains(document.activeElement);awardTracker.dismiss();updateOutcomeChrome();if(focusedHere){const target=guide.querySelector('button:not(:disabled)')||guide;target.tabIndex=target===guide?-1:0;target.focus({preventScroll:true});}};
  const book=celebration.querySelector('[data-celebration-book]');if(book){book.disabled=!!transport.busy||!!transport.pending||savingMedia;book.onclick=()=>navigate('book');}
  const replay=content.querySelector('[data-replay-keepsake]');if(replay)replay.disabled=!!transport.busy||!!transport.pending||savingMedia;
  workspace?.refresh();
 }
 function shell(){
  container.innerHTML=`<section class="partner-focus"><header class="focus-team-bar"><div><h2 data-team-title></h2><p data-paper-title></p></div><div class="actions"><button type="button" data-open-camp data-ui-only>💬 <span data-message-count>共同營地</span></button><button data-save-exit>儲存退出</button></div></header><div class="focus-progress"><span data-progress-label></span><progress aria-label="全組練習進度"></progress></div><details class="focus-team-info"><summary>小隊與練習說明</summary><p data-roster></p><p>可以請教、交換方法，再由自己試一次。所有人都試過後，一起回顧值得注意的題目。</p>${current.paperInfo?.past?'<p>開放作答採自我核對，不列入正確率；原卷停用題仍不分配、不計分。完整回顧且達60%後，全員各一朵紀念花。</p>':'<p>原有的紀念葉與訂正補達規則維持不變。</p>'}<button type="button" id="learning-refresh">更新狀態</button></details><nav class="learning-tabs" aria-label="夥伴練功流程"><button data-view="practice">我的題目</button><button data-view="review">一起回顧</button><button data-view="book">共同紀錄冊</button></nav><div data-celebration class="partner-celebration" role="status" aria-live="polite"></div><div data-outcome-guide class="outcome-guide" role="status" aria-live="polite"></div><div data-focus-content></div><aside class="review-callout" data-review-callout hidden aria-label="共同回顧下一步"><p data-review-callout-text role="status"></p><button type="button" data-callout-review class="primary">開始共同回顧 →</button></aside></section>`;
  content=container.querySelector('[data-focus-content]');workspace=createQuizWorkspace(content);container.querySelector('.focus-team-info').append(container.querySelector('.learning-tabs'));const menu=container.querySelector('.focus-team-info');menu.querySelector('summary').textContent='題目與小隊';menu.querySelector('summary').after(container.querySelector('[data-team-title]'));menu.addEventListener('toggle',()=>workspace?.refresh());const menuBody=document.createElement('div');menuBody.className='focus-team-info-body';for(const item of [...menu.children])if(item.tagName!=='SUMMARY')menuBody.append(item);menu.append(menuBody);const bar=container.querySelector('.focus-team-bar');bar.insertBefore(container.querySelector('.focus-progress'),bar.querySelector('.actions'));
  calloutObserver=new ResizeObserver(entries=>{scopeRoot.style.setProperty('--review-callout-height',entries[0].target.offsetHeight+'px');});calloutObserver.observe(container.querySelector('[data-review-callout]'));
  panel=createCampPanel({host:scopeRoot,esc,getState:()=>current,getViewer:()=>viewer,drafts,capture,question,fragment,mountRich:node=>rich.mount(node),submit,onRetry,storeMedia:storeMessageMedia,readMedia:readMessageMedia,restoreMedia:current.exercise.privateDraft?.state?.media||{},onSaveDraft:()=>saveExit(false,true),onCount:n=>{container.querySelectorAll('[data-message-count]').forEach(el=>el.textContent=n?`共同營地 · ${n} 則待查看`:'共同營地');}});
  container.querySelector('[data-open-camp]').onclick=()=>panel.open();
  container.querySelector('#learning-refresh').onclick=onRefresh;
  container.querySelector('.focus-team-bar [data-save-exit]').onclick=()=>saveExit();
  for(const b of container.querySelectorAll('.learning-tabs [data-view]'))b.onclick=()=>navigate(b.dataset.view);
 }
 function header(){const bar=container.querySelector('.focus-team-bar'),menu=container.querySelector('.focus-team-info');if(view==='practice')bar.append(menu);else bar.after(menu);if(lastHeaderView!==view){container.querySelector('.focus-team-info').open=view!=='practice';lastHeaderView=view;}const e=current.exercise;container.querySelector('[data-team-title]').textContent=current.team;container.querySelector('[data-paper-title]').textContent=current.paperInfo?.title||current.paper;container.querySelector('[data-roster]').textContent=current.members.map(m=>m.name+'・'+m.character).join(' ｜ ');container.querySelector('[data-progress-label]').textContent=`全組已送出 ${e.submitted} / ${e.total} ${current.paperInfo?.past?'個作答位置':'題'}`;const progress=container.querySelector('progress');progress.max=e.total;progress.value=e.submitted;for(const b of container.querySelectorAll('.learning-tabs [data-view]')){b.setAttribute('aria-pressed',String(b.dataset.view===view));if(b.dataset.view==='review')b.disabled=!e.reviewOpen;}}
 function unitIndex(){let index=units.findIndex(u=>u.questions.some(q=>q.id===activeQuestion));if(index<0)index=units.findIndex(u=>u.questions.some(q=>!q.attempts.length));return Math.max(index,0);}
 function practice(unit,index){if(!unit)return '<section class="card"><p>目前沒有分配給你的題目，請更新狀態。</p></section>';const label=unit.past?'段':'題';return `<p role="status" data-workspace-status></p><div class="focus-question-position"><h2 tabindex="-1" id="focus-question-heading">第 ${index+1} ${label} / 我負責 ${units.length} ${label}</h2></div><article class="question partner-workspace-question" data-question-id="${unit.questions[0].id}"><section class="focus-material">${fragment(unit.questions[0],'material')}</section>${unit.questions.map(ownQuestion).join('')}${unit.questions.some(q=>q.attempts.length)?`<aside class="answer-preview">${unit.questions.map(q=>`<div data-feedback-q="${q.id}">${feedback(q)}</div>`).join('')}</aside>`:''}<div class="quiz-actions"><button type="button" data-save-exit class="quiz-back-link">儲存退出</button><button type="button" class="quiz-primary" data-workspace-primary>送出答案</button></div></article><div class="notice partner-workspace-navigation"><h3>題目導覽</h3><label>跳到我的題目<select data-unit-select aria-label="跳到我的題目">${units.map((u,i)=>`<option value="${u.questions[0].id}" ${i===index?'selected':''}>${i+1}・${esc(u.questions[0].title)}</option>`).join('')}</select></label><div class="actions"><button type="button" data-unit-step="-1" ${index===0?'disabled':''}>← 上一${label}</button><button type="button" data-unit-step="1" ${index===units.length-1?'disabled':''}>先練下一${label} →</button></div></div><aside class="answer-next-step notice" data-answer-next-step hidden aria-label="下一步說明"></aside>`;}

 function bindContent(){
  content.querySelectorAll('[data-open-camp]').forEach(b=>b.onclick=()=>panel.open());
  content.querySelectorAll('[data-ask-q]').forEach(b=>b.onclick=()=>panel.open({qid:Number(b.dataset.askQ)}));
  content.querySelectorAll('[data-toggle-mark]').forEach(button=>{
   const box=content.querySelector('#mark-panel-'+button.dataset.toggleMark);
   const sync=()=>{button.setAttribute('aria-expanded',String(box.open));workspace?.refresh();};
   button.onclick=()=>{capture();box.open=!box.open;sync();};box.addEventListener('toggle',sync);
  });
  content.querySelectorAll('[data-close-mark]').forEach(button=>button.onclick=()=>{capture();const id=button.dataset.closeMark;content.querySelector('#mark-panel-'+id).open=false;const opener=content.querySelector('[data-toggle-mark="'+id+'"]');opener.setAttribute('aria-expanded','false');opener.focus({preventScroll:true});workspace?.refresh();});
  content.querySelectorAll('[data-save-exit]').forEach(b=>b.onclick=()=>saveExit());
  content.querySelectorAll('[data-finish-review]').forEach(b=>b.onclick=()=>submit({action:'finish'}));
  content.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
  content.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{capture();markedOnly=b.dataset.filter==='marked';contentKey='';render(current,viewer);});
  content.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.edit);drafts.delete(key('answer',id));draftVersions.delete(id);editing.add(id);contentKey='';render(current,viewer);});
  const go=qid=>{navigate('practice',qid);content.querySelector('#focus-question-heading')?.focus({preventScroll:true});content.scrollIntoView({block:'start'});};
  content.querySelectorAll('[data-unit-step]').forEach(b=>b.onclick=()=>{const target=units[unitIndex()+Number(b.dataset.unitStep)];if(target)go(target.questions[0].id);});
  const select=content.querySelector('[data-unit-select]');if(select)select.onchange=()=>go(Number(select.value));
  for(const host of content.querySelectorAll('[data-normal-choices]')){const q=question(Number(host.dataset.normalChoices)),last=q.attempts.at(-1),answerable=!last||editing.has(q.id);host.classList.toggle('long-options',q.options.some((o,i)=>o.length>34||q.rich?.options?.[i]?.media?.length>1));appendSingleChoiceOptions(host,{name:'q-'+q.id,options:q.options.map((_,i)=>({value:String(i)})),selected:answerable?drafts.get(key('answer',q.id)):String(last.choice),locked:!answerable,onSelect:v=>{activeAnswer=q.id;drafts.set(key('answer',q.id),v);draftVersions.set(q.id,attemptsAtRender.get(q.id));updateOutcomeChrome();},decorateInput:input=>{if(answerable){input.required=true;input.dataset.draft=key('answer',q.id);}},renderBody:(body,option,i)=>{body.innerHTML=fragment(q,'option',i);},result:!answerable&&last?{chosen:String(last.choice),...(Number.isInteger(q.correct)?{correct:String(q.correct)}:{}),chosenCorrect:last.correct}:null});}
  content.querySelectorAll('form[data-form]').forEach(form=>form.onsubmit=async ev=>{ev.preventDefault();capture();const act=form.dataset.form,qid=Number(form.dataset.qid);let p={action:act};if(qid)p.qid=qid;if(act==='answer'){if(question(qid).past)p.value=JSON.parse(drafts.get(key('answer',qid))||'null');else p.choice=Number(new FormData(form).get('q-'+qid));p.expectedAttempt=attemptsAtRender.get(qid)??question(qid).attempts.length;}else if(act==='mark'){p.tag=new FormData(form).get('tag');p.text=drafts.get(key('mark',qid))||'';}else p.text=drafts.get(key(act==='review'?'reflection':act,qid||''))||'';await submit(p);});
  const finish=content.querySelector('#finish-review');if(finish)finish.onclick=()=>submit({action:'finish'});
  const replay=content.querySelector('[data-replay-keepsake]');if(replay)replay.onclick=()=>{if(transport.busy||transport.pending||savingMedia)return;awardTracker.replay(current,viewer);celebrationKey='';updateOutcomeChrome();focusCelebration();};
  const settle=content.querySelector('#settle');if(settle)settle.onclick=()=>submit({action:'settle'});
  content.querySelectorAll('[data-correct-own]').forEach(b=>b.onclick=correctOwn);
  const home=content.querySelector('#learning-home');if(home)home.onclick=onHome;
 }
 function render(r,me,entryView=null){const same=current?.id===r.id&&viewer?.id===me.id;if(same)capture();else{clear();current=r;viewer=me;restore(r);if(entryView==='book'&&r.exercise.finished)view='book';else if(entryView==='review'&&r.exercise.reviewOpen)view='review';shell();}current=r;viewer=me;units=practiceUnits(r.exercise.mine);const index=unitIndex(),unit=units[index];if(unit)activeQuestion=unit.questions[0].id;onStage?.(view);header();panel.update(r,me);panel.setTransport({...transport,busy:transport.busy||savingMedia});
  const model=view==='practice'?[unit,[...editing].sort()]:[r.exercise.shared,r.exercise.reviewers,r.exercise.stories,r.exercise.notes.filter(n=>['mark','discuss'].includes(n.kind)),r.exercise.finished,r.exercise.award,markedOnly,r.exercise.correct,r.exercise.gradedTotal,r.exercise.mine.map(q=>[q.id,q.attempts])];const next=JSON.stringify([view,activeQuestion,model]);
  const typing=content?.contains(document.activeElement)&&document.activeElement.matches('textarea,input[type=text]');
  const mediaBusy=[...content.querySelectorAll('audio')].some(a=>!a.paused&&!a.ended)||!!document.querySelector('#lightbox[open]');
  if(next!==contentKey&&!composing&&!drawing&&(!mediaBusy||contentKey==='')&&(!typing||!same||contentKey==='')){
   const open=[...content.querySelectorAll('details[open]')].map(e=>e.dataset.detail).filter(Boolean);container.querySelector('.focus-team-bar>.focus-question-position')?.remove();workspace.reset();rich.prepare(content);content.innerHTML=view==='practice'?practice(unit,index):view==='review'?review():book();attemptsAtRender.clear();for(const q of r.exercise.mine)attemptsAtRender.set(q.id,q.attempts.length);bindContent();mountPastAnswers(content,{question,drafts,loadAsset:rich.resolve});mountPastResults(content,{question,loadAsset:rich.resolve});rich.mount(content);if(view==='practice'){const position=content.querySelector('.focus-question-position');if(position)container.querySelector('.focus-team-bar').append(position);const article=content.querySelector('.partner-workspace-question');if(article){let feedback=article.querySelector('.answer-preview');if(!feedback){feedback=document.createElement('aside');feedback.className='answer-preview';const placeholder=document.createElement('p');placeholder.className='quiz-explanation-placeholder';placeholder.textContent='送出後，一起核對想法。';feedback.append(placeholder);article.append(feedback);}for(const extra of article.querySelectorAll('.question-extras'))feedback.append(extra);workspace.apply({article,saved:unit?.questions.every(q=>q.attempts.length),complete:false,closed:false});content.querySelector('.quiz-message-tray').dataset.detail='workspace-tray';content.querySelector('.quiz-message-tray summary').textContent='儲存與提示';}}for(const id of (same?open:r.exercise.privateDraft?.state?.open||[])){const el=[...content.querySelectorAll('details')].find(e=>e.dataset.detail===id);if(el)el.open=true;}workspace?.refresh();contentKey=next;
  }
  for(const node of content.querySelectorAll('[data-question-marks]')){const html=marks(question(Number(node.dataset.questionMarks)));if(node.innerHTML!==html)node.innerHTML=html;}
  for(const button of content.querySelectorAll('[data-toggle-mark]')){const marked=notes('mark',Number(button.dataset.toggleMark)).length>0;button.textContent=(marked?'✓ ':'☆ ')+sharingLabel;button.title=marked?'已加入共同回顧':'把這題帶給大家一起看';button.setAttribute('aria-expanded',String(content.querySelector('#mark-panel-'+button.dataset.toggleMark).open));}
  updateOutcomeChrome();
  if(summaryRequested){summaryRequested=false;const h=container.querySelector('[data-celebration] h2')||content.querySelector('h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});h.scrollIntoView({block:'start'});}}
  container.querySelectorAll('[data-message-count]').forEach(el=>el.textContent=panel.count()?`共同營地 · ${panel.count()} 則待查看`:'共同營地');
 }
 const compositionStart=()=>{composing=true;},compositionEnd=()=>{composing=false;queueMicrotask(()=>{if(current)render(current,viewer);});};
 const pointerStart=event=>{if(event.target.closest?.('.drawing-board'))drawing=true;},pointerEnd=()=>{if(drawing){drawing=false;queueMicrotask(()=>{if(current)render(current,viewer);});}};
 const mediaIdle=event=>{if(event.type==='close'&&event.target.id!=='lightbox')return;queueMicrotask(()=>{if(current)render(current,viewer);});};
 container.addEventListener('pause',mediaIdle,true);container.addEventListener('ended',mediaIdle,true);document.addEventListener('close',mediaIdle,true);
 const blur=()=>setTimeout(()=>{if(current)render(current,viewer);},0);
 const answerFocus=event=>{const form=event.target.closest?.('form[data-form=answer]');if(form){activeAnswer=Number(form.dataset.qid);updateOutcomeChrome();}};container.addEventListener('focusin',answerFocus);
 const answerChanged=event=>{const form=event.target.closest?.('form[data-form=answer]');if(form)activeAnswer=Number(form.dataset.qid);if(current&&!composing){capture();updateOutcomeChrome();}};
 container.addEventListener('input',answerChanged);container.addEventListener('change',answerChanged);container.addEventListener('pointerup',answerChanged);
 container.addEventListener('compositionstart',compositionStart);container.addEventListener('compositionend',compositionEnd);container.addEventListener('pointerdown',pointerStart);window.addEventListener('pointerup',pointerEnd);window.addEventListener('pointercancel',pointerEnd);container.addEventListener('focusout',blur);
 function clear(){workspace?.destroy();workspace=null;activeAnswer=null;lastHeaderView=null;calloutObserver?.disconnect();calloutObserver=null;scopeRoot.style.removeProperty('--review-callout-height');summaryRequested=false;guideKey='';celebrationKey='';exitDialog?.remove();exitDialog=null;awardTracker.clear();saveEpoch++;savingMedia=false;rich.clear();panel?.clear();panel=null;current=null;viewer=null;drafts.clear();editing.clear();draftVersions.clear();attemptsAtRender.clear();activeQuestion=null;contentKey='';view='practice';markedOnly=false;composing=false;drawing=false;}
 return {render,committed,clear,setTransport:next=>{transport={...transport,...next};panel?.setTransport({...transport,busy:transport.busy||savingMedia});if(current)updateOutcomeChrome();}};
}
