import {createLearningRequest,learningError,beginLearningTeacherLogin} from './admin-learning-api.mjs';
import {activityLabel,renderPastAnswerItem} from './admin-learning-activities.mjs?v=20261105-reference';
import {lessonName,rateLabel,timeLabel,fullTime,paperStatus,paperAccuracy,typingPolicy,orderedOptions,optionLetter,responseLabel} from './admin-learning-model.mjs';
import {renderContent} from './quiz-render.mjs';
import {configureQuizMedia} from './quiz-media.mjs';

const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const local=new URLSearchParams(location.search).get('local')==='1';
const readOnlyBridge=document.querySelector('meta[name="admin-learning-backend"]')?.content==='local-readonly';
let auth=null,session=null,request=null,selected=null,rosterPage=0,activeTab='typing',rosterEpoch=0,studentEpoch=0,tabEpoch=0,dialogEpoch=0,firstLoad=true;
let dialogContext=null,lastOpener=null,typingTrack='english',paperFilters={subject:'',state:'all',activity_type:'all'};const pending=new Set(),cache=new Map();
let classEpoch=0,classSummary=null,classSorter=null,classGapPresenter=null;const classPending=new Set();
const button=(text,fn,cls='secondary')=>{const b=node('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
const tag=(text,cls='')=>node('span',text,`tag ${cls}`);
function cancelRequests(includeClass=true){for(const c of pending)c.abort();pending.clear();if(includeClass){for(const c of classPending)c.abort();classPending.clear();}}
async function call(action,payload={},signal){
  const c=new AbortController(),group=action==='class_rewards'?classPending:pending;group.add(c);
  try{return await request(action,$('course').value,payload,signal?AbortSignal.any([c.signal,signal]):c.signal);}
  catch(error){
    if(!local&&['session_expired','teacher_required'].includes(error.code)){
      session=null;rosterEpoch++;clearStudent();clearClass();$('roster-list').replaceChildren();$('roster-paging').replaceChildren();$('roster-status').textContent='';
      $('workspace').hidden=true;$('locked').hidden=false;$('identity').textContent='需要重新登入';$('global-status').textContent=learningError(error);
    }
    throw error;
  }finally{group.delete(c);}
}
const studentPayload=()=>({class_code:selected.class_code,seat_no:selected.seat_no});
function loading(root,text='正在讀取紀錄…'){root.replaceChildren(node('p',text,'load-status'));root.setAttribute('aria-busy','true');}
function empty(root,text){root.replaceChildren(node('p',text,'empty'));root.removeAttribute('aria-busy');}
function failure(root,error,retry){const box=node('div',undefined,'error');box.setAttribute('role','alert');box.append(node('p',learningError(error)));box.append(button('重新讀取',retry));root.replaceChildren(box);root.removeAttribute('aria-busy');}
function paging(root,data,load,total=data.total){
  root.replaceChildren();const limit=Number(data.limit||20),offset=Number(data.offset||0);total=Number(total||0);
  if(total<=limit)return;
  const prev=button('上一頁',()=>load(Math.max(0,offset-limit))),next=button('下一頁',()=>load(offset+limit));
  prev.disabled=offset===0;next.disabled=offset+limit>=total;
  root.append(prev,node('span',`${offset+1}–${Math.min(offset+limit,total)} / ${total}`),next);
}
function closeDialog(){dialogEpoch++;dialogContext=null;if($('detail-dialog').open)$('detail-dialog').close();$('detail-content').replaceChildren();$('detail-paging').replaceChildren();}
function clearStudent(){studentEpoch++;tabEpoch++;selected=null;cache.clear();cancelRequests(false);closeDialog();$('profile-content').hidden=true;$('empty-profile').hidden=false;$('records').replaceChildren();$('summary-cards').replaceChildren();
  $('reward-section').hidden=true;$('reward-content').replaceChildren();
  for(const id of ['student-title','student-meta','mapping-status','data-time'])$(id).textContent='';
  paperFilters={subject:'',state:'all',activity_type:'all'};$('paper-activity').value='all';$('paper-subject').replaceChildren(new Option('全部科目',''));$('paper-state').value='all';$('paper-filter-status').textContent='';$('paper-filters').hidden=true;}
async function loadRoster(offset=0){
  const epoch=++rosterEpoch;rosterPage=offset;loading($('roster-list'),'正在讀取名冊…');$('roster-paging').replaceChildren();$('roster-status').textContent='';
  try{
    const data=await call('roster',{class_code:$('class-filter').value,search:$('student-search').value.trim(),offset,limit:20});if(epoch!==rosterEpoch)return;
    const current=$('class-filter').value;$('class-filter').replaceChildren(new Option('全部班級',''),...data.classes.map(c=>new Option(`${c} 班`,c)));$('class-filter').value=current;
    if(!local){const chosen=$('reward-class').value;$('reward-class').replaceChildren(new Option('請選擇班級',''),...data.classes.map(c=>new Option(`${c} 班`,c)));$('reward-class').value=chosen;}
    $('roster-status').textContent=`找到 ${data.total} 位同學`;$('roster-list').replaceChildren();$('roster-list').removeAttribute('aria-busy');
    for(const row of data.items){
      const b=button('',()=>selectStudent(row),'student-button');b.dataset.studentCode=row.student_code;b.setAttribute('aria-pressed',String(selected?.student_code===row.student_code));
      const title=node('span',row.display_name,'student-name');title.append(node('small',`${row.class_code} 班${Number(row.mappings)===0?'・尚未連結帳號':Number(row.mappings)>1?'・對應待確認':''}`));
      b.append(node('span',String(row.seat_no).padStart(2,'0'),'seat'),title);$('roster-list').append(b);
    }
    if(!data.items.length)empty($('roster-list'),'沒有符合條件的同學。請調整搜尋條件。');
    paging($('roster-paging'),data,loadRoster);
    if(local&&firstLoad&&data.items.length){firstLoad=false;await selectStudent(data.items[0]);}
  }catch(e){if(epoch===rosterEpoch)failure($('roster-list'),e,()=>loadRoster(offset));}
}
function clearClass(resetChoice=true){
  classEpoch++;classSummary=null;classSorter=null;classGapPresenter=null;for(const c of classPending)c.abort();classPending.clear();
  if(resetChoice){$('reward-class').replaceChildren(new Option('請選擇班級',''));$('reward-sort').value='seat';$('show-all-class-gaps').checked=false;}
  $('refresh-class-rewards').disabled=!$('reward-class').value;
  empty($('class-reward-content'),'選擇班級，查看全班每位同學的花葉數量。');
}
async function loadClassRewards(){
  clearClass(false);const cls=$('reward-class').value,course=$('course').value,epoch=classEpoch;if(!cls)return;
  $('refresh-class-rewards').disabled=true;loading($('class-reward-content'),`正在讀取 ${cls} 班完整名冊與花葉…`);
  try{
    const [data,module,gardenModule]=await Promise.all([call('class_rewards',{class_code:cls}),import('./admin-learning-rewards.mjs'),import('./admin-learning-garden.mjs')]);
    if(epoch!==classEpoch||course!==$('course').value)return;
    classSummary=gardenModule.summarizeClassGardenRewards(data,course);classSorter=module.sortClassRewards;classGapPresenter=gardenModule.classUnlockConditions;renderClassRewards();
  }catch(error){if(epoch===classEpoch)failure($('class-reward-content'),error,loadClassRewards);}
  finally{if(epoch===classEpoch)$('refresh-class-rewards').disabled=false;}
}
function renderClassRewards(){
  if(!classSummary||!classSorter)return;
  const root=$('class-reward-content'),s=classSummary,t=s.totals;root.replaceChildren();root.removeAttribute('aria-busy');
  const totals=node('div',undefined,'reward-totals');
  for(const [key,label,value] of [['leaves','全班葉片',t.leaves],['flowers','全班花朵',t.flowers],['pendingHalves','待累積半葉人數',t.pendingHalves]]){
    const box=node('div',undefined,'reward-total');box.dataset.classTotal=key;box.append(node('span',label),node('strong',String(value),'metric'));totals.append(box);
  }
  root.append(totals,node('p',`全班 ${s.total} 人・已確認帳號 ${t.linked} 人・尚未連結 ${t.unlinked} 人・對應待確認 ${t.conflict} 人。加總僅包含已確認帳號；「—」不代表零。`,'small muted'));
  if(!s.total){root.append(node('p','這個班級目前沒有年度名冊資料。','empty'));return;}
  const wrap=node('div',undefined,'table-wrap class-table-wrap'),table=node('table',undefined,'reward-table class-reward-table');wrap.setAttribute('aria-label','班級花葉與解鎖條件');
  table.append(node('caption',`${s.class_code} 班・115 上學期花葉數量（點姓名開啟個別檔案）`));
  const head=node('thead'),tr=node('tr');for(const title of ['座號','姓名','葉片','花朵','待累積半葉','努力樹等級','已解鎖功能','目前還差的解鎖條件','紀錄狀態']){const th=node('th',title);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
  const body=node('tbody');
  for(const item of classSorter(s.items,$('reward-sort').value)){
    const tr=node('tr');tr.dataset.studentCode=item.student_code;
    const name=node('th');name.scope='row';name.append(button(item.display_name,async()=>{await selectStudent(item);$('student-title').scrollIntoView({block:'start'});},'class-student-link'));
    tr.append(node('td',String(item.seat_no).padStart(2,'0')),name);
    for(const key of ['leaves','flowers','pendingHalf']){const td=node('td',item[key]===null?'—':key==='pendingHalf'?item[key]?'半片':'無':String(item[key]));td.dataset.count=key;td.dataset.label={leaves:'葉片',flowers:'花朵',pendingHalf:'待累積半葉'}[key];tr.append(td);}
    const level=node('td',undefined,'class-garden-level'),features=node('td',undefined,'class-garden-features');
    level.dataset.count='gardenLevel';features.dataset.count='unlockedFeatures';
    level.dataset.label='努力樹等級';features.append(node('h3','已解鎖功能','class-detail-label'));
    if(!item.garden){level.textContent='—';features.append(node('p','帳號對應確認後可查看'));}
    else{
      const g=item.garden;level.append(node('strong',g.level===null?'待確認':`第 ${g.level} 級`));
      if(g.synchronizationPending)level.append(node('span','已達條件，待同步升級','small muted'));
      if(g.migrationPending)level.append(node('span','成長紀錄待同步','small muted'));
      if(g.includesRehearsal)level.append(node('span','等級含成長體驗','small muted'));
      const unlocked=g.features.filter(f=>f.status==='unlocked'),awaiting=g.features.filter(f=>f.status==='pending');
      if(!unlocked.length)features.append(node('span','尚無已解鎖的進階功能','small muted'));
      else{const list=node('ul',undefined,'class-unlocked-list');for(const f of unlocked){const li=node('li',`${f.label}${f.available===false?'（權限保留，目前需第二級）':''}`);li.dataset.featureKey=f.key;list.append(li);}features.append(list);}
      if(awaiting.length)features.append(node('p',`待同步：${awaiting.map(f=>f.label).join('、')}`,'small muted'));
    }
    tr.append(level,features);
    const gapCell=node('td',undefined,'class-garden-gaps');gapCell.dataset.count='unlockConditions';
    gapCell.append(node('h3','目前還差的解鎖條件','class-detail-label'));
    const gaps=classGapPresenter(item.garden,$('show-all-class-gaps').checked);
    if(gaps.message)gapCell.append(node('p',gaps.message,'unlock-gap'));
    const gapList=node('ul',undefined,'class-gap-list');
    for(const group of gaps.groups){const li=node('li');li.dataset.gapStatus=group.status;
      li.append(node('strong',`${group.labels.join('、')}${group.status==='pending'?'（待同步）':group.status==='unknown'?'（待確認）':''}`),node('p',group.remaining,'small'));gapList.append(li);}
    if(gaps.groups.length)gapCell.append(gapList);
    if(gaps.hiddenGroups)gapCell.append(node('p',`另有 ${gaps.hiddenGroups} 組條件，可用上方開關一次展開全班。`,'small muted'));
    tr.append(gapCell);
    const status=node('td',item.mapping==='unlinked'?'尚未連結帳號':item.mapping==='conflict'?'帳號對應待確認':item.unknownRows||item.skippedActivities?'部分活動未列入努力樹':item.rehearsal?'另有測試體驗（不計入）':'已確認');status.dataset.label='紀錄狀態';tr.append(status);
    body.append(tr);
  }
  table.append(body);wrap.append(table);root.append(wrap,node('p',`資料讀取時間：${fullTime(s.as_of)}（臺灣時間）。依完整班級名冊統計，不受左側姓名搜尋與名冊分頁影響；每人的半葉分開保留，不跨學生湊整。測試體驗花葉不列入合計。等級與功能沿用個人明細判定；待同步項目尚未列為已解鎖。`,'small muted'));
}
async function selectStudent(row){
  clearStudent();selected=row;const epoch=studentEpoch;
  for(const b of $('roster-list').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.studentCode===row.student_code));
  $('empty-profile').hidden=true;$('profile-content').hidden=false;$('record-section').hidden=true;
  $('student-title').textContent=row.display_name;$('student-meta').textContent=`115 學年度・${row.class_code} 班・${String(row.seat_no).padStart(2,'0')} 號`;
  $('mapping-status').textContent='正在核對名冊與帳號…';$('data-time').textContent='';loading($('summary-cards'),'正在讀取學習摘要…');
  try{
    const data=await call('profile',studentPayload());if(epoch!==studentEpoch)return;
    $('summary-cards').replaceChildren();$('summary-cards').removeAttribute('aria-busy');$('data-time').textContent=`資料讀取時間：${fullTime(data.as_of)}（臺灣時間）`;
    if(data.identity.mapping!=='linked'){
      $('mapping-status').textContent=data.identity.mapping==='unlinked'?'尚未連結已驗證的 Google 帳號，暫不合併任何學習紀錄。':'帳號對應需要確認，暫不合併紀錄，以免顯示其他人的成果。';return;
    }
    $('mapping-status').textContent='已依本學年度名冊連結帳號；姓名以名冊為準。';
    const summaries=[['weekly','週次活動',`${data.weekly.completed} / ${data.weekly.recorded}`,'完成／已記錄活動',data.weekly.last_at],
      ['typing','打字基礎',`英 ${data.typing.english}・中 ${data.typing.zhuyin}`,'各 12 大關的已存過關成果',data.typing.last_at],
      ['papers','考前練功坊',`${data.papers.completed} / ${data.papers.created}`,'完成／已建立試卷（本學年度）',data.papers.last_at]];
    for(const [key,title,metric,desc,time] of summaries){const b=button('',()=>loadTab(key),'summary');b.append(node('span',title,'summary-title'),node('span',metric,'metric'),node('span',desc,'muted'),node('span',`最後有紀錄：${timeLabel(time)}`,'muted'));$('summary-cards').append(b);}
    if(!local)void loadRewards(epoch);
    $('record-section').hidden=false;await loadTab(activeTab);
  }catch(e){if(epoch===studentEpoch){$('mapping-status').textContent='摘要讀取未完成；不會顯示為零分或無紀錄。';failure($('summary-cards'),e,()=>selectStudent(row));}}
}
async function loadRewards(epoch){
  const course=$('course').value,who={...studentPayload()};
  $('reward-section').hidden=false;loading($('reward-content'),'正在核對已取得的花葉與來源…');
  try{
    const [data,{summarizeLearningRewards},{summarizeGardenStatus}]=await Promise.all([call('garden_status',who),import('./admin-learning-rewards.mjs'),import('./admin-learning-garden.mjs')]);if(epoch!==studentEpoch)return;
    const root=$('reward-content');root.removeAttribute('aria-busy');
    if(data.identity.mapping!=='linked'){empty(root,'帳號對應尚未確認，暫不統計花葉。');return;}
    const summary=summarizeLearningRewards(data,course);root.replaceChildren();
    const totals=node('div',undefined,'reward-totals');
    for(const [kind,text,count] of [['leaves','葉片',summary.leaves],['flowers','花朵',summary.flowers]]){
      const box=node('div',undefined,'reward-total');box.append(node('span',text),node('strong',String(count),'metric'));box.dataset.rewardTotal=kind;totals.append(box);
    }
    root.append(totals,node('p',summary.pendingHalf?'另有半片葉子待累積，尚未計入整片葉片。':'目前沒有待湊成整片的半葉。','small muted'));
    renderGardenStatus(root,summarizeGardenStatus(data,course));
    const table=node('table',undefined,'reward-table'),caption=node('caption','已取得花葉的來源');
    const head=node('thead'),tr=node('tr');for(const title of ['來源','葉片','花朵']){const th=node('th',title);th.scope='col';tr.append(th);}head.append(tr);
    const body=node('tbody');for(const group of summary.groups){const tr=node('tr'),th=node('th',group.category);th.scope='row';tr.append(th,node('td',String(group.leaves)),node('td',String(group.flowers)));body.append(tr);}
    table.append(caption,head,body);root.append(table);
    const details=node('details'),list=node('ol',undefined,'reward-sources');details.append(node('summary',`查看 ${summary.items.length} 筆花葉來源`));
    for(const item of summary.items){const li=node('li');li.append(node('strong',item.title),node('span',`${item.kind==='flower'?'1 朵花':'1 片葉'}・${item.category}・${timeLabel(item.updated_at)}`,'small muted'));list.append(li);}
    if(!summary.items.length)list.append(node('li','目前尚未取得花葉。'));details.append(list);root.append(details);
    if(summary.rehearsal)root.append(node('p',`此測試帳號另有成長體驗資料：${summary.rehearsal.leaves} 葉、${summary.rehearsal.flowers} 花。未計入上述學習成果。`,'notice'));
    if(summary.unknownRows||summary.skippedActivities)root.append(node('p',`有 ${summary.unknownRows} 筆週次紀錄尚未列入努力樹、${summary.skippedActivities} 個活動設定未支援，未自行換算花葉。`,'notice'));
    root.append(node('p',`依本學期努力樹規則與已保存獎勵統計；重作不重複計入，重置與最新評比會影響結果。讀取時間：${fullTime(data.as_of)}`,'small muted'));
  }catch(error){if(epoch===studentEpoch)failure($('reward-content'),error,()=>loadRewards(epoch));}
}
function renderGardenStatus(root,state){
  const box=node('section',undefined,'garden-learning-status');box.setAttribute('aria-label','努力樹等級與解鎖功能');box.append(node('h3','努力樹等級與功能'));
  const level=node('p',state.level===null?'等級待確認（成長紀錄需要同步）':`目前判定：第 ${state.level} 級${state.synchronizationPending?'（已達條件，待學生端同步升級）':''}`,'garden-level');level.dataset.gardenLevel=state.level===null?'unknown':String(state.level);box.append(level);
  if(state.level!==2||state.synchronizationPending)box.append(node('p',state.levelRemaining,'unlock-gap'));
  if(state.grown_at)box.append(node('p',`本學期首次升級紀錄：${fullTime(state.grown_at)}`,'small muted'));
  if(state.migrationPending)box.append(node('p','既有成長快照需要學生端同步更新，暫不推算新解鎖條件；已保存的解鎖權限仍列於下方。','notice'));
  if(state.includesRehearsal)box.append(node('p','此帳號的努力樹等級含成長體驗花葉；上方學習成果總數不含體驗資料。','notice'));
  const unlocked=state.features.filter(f=>f.status==='unlocked'),pending=state.features.filter(f=>f.status==='pending');
  box.append(node('h4',`已解鎖功能（${unlocked.length}）`));
  const list=node('ul',undefined,'garden-unlocked-list');
  for(const feature of unlocked){const li=node('li');li.dataset.featureKey=feature.key;li.append(node('strong',feature.label));
    li.append(node('span',`${feature.available===false?'權限已保留，目前需本學期第二級才能使用。 ':''}${feature.unlocked_at?`取得時間：${fullTime(feature.unlocked_at)}。 `:''}${feature.note}`,'small muted'));list.append(li);}
  if(!unlocked.length)list.append(node('li','目前尚無已解鎖的進階功能。'));box.append(list);
  if(pending.length){const p=node('p',`已達條件、待學生端同步：${pending.map(f=>f.label).join('、')}。`,'notice');p.dataset.gardenPending='true';box.append(p);}
  const remaining=state.features.filter(f=>!['unlocked','pending'].includes(f.status));
  const details=node('details');details.append(node('summary',`查看其他 ${remaining.length} 項功能與條件`));
  const locked=node('ul',undefined,'garden-unlocked-list');for(const f of remaining){const li=node('li');li.dataset.lockedFeatureKey=f.key;li.append(node('strong',`${f.label}・${f.status==='unknown'?'待同步確認':'尚未解鎖'}`),node('p',f.remaining||f.note,'unlock-gap'),node('span',f.note,'small muted'));locked.append(li);}details.append(locked);box.append(details);
  box.append(node('p','已解鎖項目以已保存的紀錄為準；後台查閱不會替學生升級、發放功能或修改成長紀錄。','small muted'));root.append(box);
}
function row(title){const article=node('article',undefined,'record-row'),head=node('div',undefined,'row-head'),left=node('div');left.append(node('h3',title));head.append(left);article.append(head);return {article,head,left};}
async function loadTab(tab,offset=0){
  if(!selected)return;activeTab=tab;const epoch=++tabEpoch,student=studentEpoch;const filters={...paperFilters};const key=`${tab}:${offset}:${tab==='papers'?JSON.stringify(filters):''}`;
  for(const b of $('record-tabs').querySelectorAll('button')){const is=b.dataset.tab===tab;b.setAttribute('aria-selected',String(is));b.tabIndex=is?0:-1;}
  $('record-panel').setAttribute('aria-labelledby',`tab-${tab}`);$('record-paging').replaceChildren();$('paper-filters').hidden=tab!=='papers';
  if(tab==='papers')$('paper-filter-status').textContent='正在套用查詢條件…';
  $('record-note').textContent={weekly:'顯示已保存的週次活動，並非應完成任務清單。此處不列自由閱讀缺交。',
    typing:'小關進度與整關成果分開呈現。速度依英打、注音按鍵、中文輸入使用不同單位；自由重練不一定保存。',
    papers:'顯示本學年度的課堂卷、題庫練習、自組卷、考古題與延伸練習（含已隱藏及歷次作答）。考古題自評／人工題另標示，不當作答錯。'}[tab];
  loading($('records'));
  try{
    const data=cache.get(key)||await call(tab,{...studentPayload(),offset,limit:tab==='typing'?50:20,...(tab==='papers'?filters:{})});if(epoch!==tabEpoch||student!==studentEpoch)return;
    if(cache.size>=8)cache.clear();cache.set(key,data);$('records').replaceChildren();$('records').removeAttribute('aria-busy');
    if(tab==='papers'){
      $('paper-subject').replaceChildren(new Option('全部科目',''),...(data.subjects||[]).map(s=>new Option(s,s)));
      if(filters.subject&&!data.subjects?.includes(filters.subject))$('paper-subject').add(new Option(filters.subject,filters.subject));
      $('paper-subject').value=filters.subject;$('paper-state').value=filters.state;$('paper-activity').value=filters.activity_type;
      $('paper-filter-status').textContent=`${filters.activity_type==='all'?'全部活動':activityLabel(filters.activity_type)}・${filters.subject||'全部科目'}・符合 ${data.total} / 全部 ${data.all_total} 筆活動（條件套用至全部頁面）`;
    }
    if(!data.items?.length){empty($('records'),tab==='papers'&&(filters.subject||filters.state!=='all'||filters.activity_type!=='all')?'沒有符合篩選條件的活動。可清除篩選查看全部紀錄。':'目前沒有這類已保存紀錄。');return;}
    if(tab==='typing'){
      const filters=node('div',undefined,'tabs typing-filters');filters.setAttribute('aria-label','打字類型篩選');
      for(const [key,text] of [['english','英打'],['zhuyin','中打']]){const b=button(`${text}（${data.items.filter(i=>i.track===key).length}）`,()=>{typingTrack=key;loadTab('typing');});b.setAttribute('aria-pressed',String(typingTrack===key));b.dataset.track=key;filters.append(b);}
      $('records').append(filters);
    }
    for(const item of data.items){
      if(tab==='typing'&&item.track!==typingTrack)continue;
      if(tab==='weekly'){
        const r=row(`第 ${item.week_code} 週・${item.activity_key.startsWith('typing')?'打字活動':item.activity_key.includes('quiz')?'小測驗':'課程活動'}`);
        r.left.append(tag(item.completed?'已完成':'進行中',item.completed?'pass':'pending'));
        r.article.append(node('p',`紀錄位置：第 ${item.current_level} 關${item.score==null?'':`・已保存分數：${item.score}`}`,'row-meta'),node('p',`更新：${fullTime(item.updated_at)}・活動識別：${item.activity_key}`,'small muted'));$('records').append(r.article);
      }else if(tab==='typing'){
        const r=row(lessonName(item.lesson_key));
        r.left.append(tag(item.completed?'已存過關成果':item.progress_id?'練習中':'尚無紀錄',item.completed?'pass':item.progress_id?'pending':''));
        if(item.blocked)r.left.append(document.createTextNode(' '),tag('需先完成前關'));
        const progress=node('div',undefined,'mini-progress');progress.setAttribute('aria-label',`已通過 ${item.checkpoint} / 5 小關`);
        for(let i=0;i<5;i++)progress.append(node('span','',i<Number(item.checkpoint)?'done':''));r.article.append(progress);
        r.article.append(node('p',`${item.checkpoint} / 5 小關・目前門檻：${typingPolicy(item,$('course').value)}`,'small muted'));
        r.article.append(node('p',`最佳達標速度：${rateLabel(item.best_rate,item.rate_unit)}・過關時間：${timeLabel(item.completed_at)}`,'row-meta'));
        if(Number(item.resets)>0)r.article.append(node('p',`教師重置 ${item.resets} 次；歷史與目前有效版本分開保留。`,'small muted'));
        if(item.progress_id)r.head.append(button(`查看歷程（${item.events}）`,e=>openDetail('typing_events',item,e.currentTarget)));
        $('records').append(r.article);
      }else{
        const r=row(item.title),state=paperStatus(item);r.article.dataset.activityType=item.access_mode;r.left.append(tag(activityLabel(item.access_mode)),document.createTextNode(' '),tag(state,state==='已完成'?'pass':'pending'));
        if(item.hidden)r.left.append(document.createTextNode(' '),tag('學生列表已隱藏'));
        r.article.append(node('p',`${item.subject||'未分類'}・${item.unit||'未分類單元'}・固定第 ${item.revision} 版`,'small muted'),
          node('p',item.access_mode==='past_exam'?`已保存 ${item.answered} / ${item.total} 題・自動判分答對 ${item.correct} 題（自評／人工題另見明細）`:`已答 ${item.answered} / ${item.total} 題・已答正確：${paperAccuracy(item)}`,'row-meta'),
          node('p',`建立：${timeLabel(item.created_at)}・最後作答：${timeLabel(item.last_answer_at)}`,'small muted'));
        if(item.source_attempt_id)r.article.append(node('p','同重點延伸卷：題目不同，不代表原題重答。','small muted'));
        r.head.append(button('逐題答案明細',e=>openDetail('paper',item,e.currentTarget)));$('records').append(r.article);
      }
    }
    paging($('record-paging'),data,n=>loadTab(tab,n));
  }catch(e){if(epoch===tabEpoch&&student===studentEpoch){if(tab==='papers')$('paper-filter-status').textContent='尚未取得篩選結果。';failure($('records'),e,()=>loadTab(tab,offset));}}
}
function openDetail(kind,item,opener){
  closeDialog();lastOpener=opener;dialogContext={kind,item,student:studentEpoch,who:{...studentPayload()},course:$('course').value,filter:'all',media:new Map()};
  $('detail-title').textContent=kind==='paper'?item.title:lessonName(item.lesson_key);
  $('detail-eyebrow').textContent=`${selected.class_code} 班 ${selected.seat_no} 號・${selected.display_name}`;
  $('detail-dialog').showModal();loadDetail(0);
}
async function loadDetail(offset=0){
  const ctx=dialogContext;if(!ctx)return;const epoch=++dialogEpoch;loading($('detail-content'));$('detail-paging').replaceChildren();
  try{
    const payload={...ctx.who,offset,limit:20,...(ctx.kind==='paper'?{session_id:ctx.item.session_id,filter:ctx.filter}:{progress_id:ctx.item.progress_id})};
    const data=await call(ctx.kind,payload);if(epoch!==dialogEpoch||ctx.student!==studentEpoch||ctx!==dialogContext)return;
    $('detail-content').replaceChildren();$('detail-content').removeAttribute('aria-busy');
    if(ctx.kind==='paper'){
      const resolveDetailMedia=async url=>{
        if(ctx!==dialogContext)throw new Error('media_unavailable');
        const cached=ctx.media.get(url);if(cached&&Date.now()-cached.at<45000)return cached.promise;
        const resolve=async()=>{
        const signal=AbortSignal.timeout(10000);const identity=session?.user?.id;
        const headers={'Content-Type':'application/json',...(local?{}:{apikey:auth.SUPABASE_ANON_KEY,Authorization:`Bearer ${auth.getStoredAccessToken()||session?.access_token}`})};
        const response=await fetch(local?'/__learning-media':readOnlyBridge?'/__learning-live-media':`${auth.SUPABASE_URL}/functions/v1/admin-learning-media`,{method:'POST',signal,headers,
          body:JSON.stringify({url,course_id:ctx.course,student:ctx.who,session_id:ctx.item.session_id})});
        const result=await response.json();if(!response.ok||ctx!==dialogContext||(!local&&identity!==session?.user?.id))throw new Error('media_unavailable');return result.url;
        };
        const promise=resolve().catch(error=>{ctx.media.delete(url);throw error;});ctx.media.set(url,{at:Date.now(),promise});return promise;
      };
      ctx.mediaScope={resolve:resolveDetailMedia,active:()=>ctx===dialogContext&&ctx.student===studentEpoch};
      configureQuizMedia(resolveDetailMedia);
      renderPaper(data,ctx);paging($('detail-paging'),data,loadDetail,data.filtered_total);
    }else{renderEvents(data);paging($('detail-paging'),data,loadDetail);}
  }catch(e){if(epoch===dialogEpoch&&ctx===dialogContext)failure($('detail-content'),e,()=>loadDetail(offset));}
}
function rich(root,value){try{renderContent(root,value||{text:'',media:[]},{mediaScope:dialogContext?.mediaScope||null});}catch{root.append(node('p','這段內容的格式或媒體無法顯示，原紀錄仍保留。','error'));}}
function renderPaper(data,ctx){
  const root=$('detail-content'),toolbar=node('div',undefined,'dialog-toolbar');
  toolbar.append(node('p',data.activity_type==='past_exam'?`全卷已保存 ${data.answered} / ${data.total} 題・自動判分答對 ${data.correct} 題・自評／人工題 ${data.manual} 題`:`全卷已答 ${data.answered} / ${data.total} 題・已答正確 ${paperAccuracy(data)}`));
  const filter=node('label',undefined,'filter-label'),input=node('input');input.type='checkbox';input.checked=ctx.filter==='wrong';input.id='only-wrong';
  input.addEventListener('change',()=>{ctx.filter=input.checked?'wrong':'all';loadDetail(0);});filter.append(input,document.createTextNode('只看已答錯題'));toolbar.append(filter);root.append(toolbar);
  const meta=node('div',undefined,'detail-meta');meta.append(tag(`固定第 ${data.revision} 版`),tag(!data.started?'尚未開始':Number(data.answered)===Number(data.total)&&Number(data.total)>0?'已完成':'作答中'));
  if(data.version_id)meta.append(tag(`版本識別：${data.version_id}`));
  if(data.hidden)meta.append(tag('學生列表已隱藏'));root.append(meta,node('p',`${data.started?'保留學生當時的題目順序與選項順序。':'尚未開始作答，以固定版本的原始順序預覽。'}未答不計為錯誤；作答紀錄本身無法判定猜題或未答原因。`,'small muted'));
  if(!data.items.length){root.append(node('p',ctx.filter==='wrong'?'本卷沒有已答錯題；仍可能包含未作答題目。':'這份試卷目前沒有可顯示的題目。','empty'));return;}
  for(const item of data.items){
    if(data.activity_type==='past_exam'){renderPastAnswerItem(root,item,ctx.mediaScope);continue;}
    const q=item.question,article=node('article',undefined,'question-card');article.dataset.questionId=q.id;
    const heading=node('h3',`第 ${item.number} 題`);heading.append(tag(!item.answered?'尚未作答':item.correct?'答對':'答錯',!item.answered?'pending':item.correct?'pass':'fail'));article.append(heading);
    if(item.material?.text||item.material?.media?.length||item.material?.layout){const material=node('div',undefined,'material');material.append(node('strong','共用材料'));rich(material,item.material);article.append(material);}
    rich(article,q.prompt);
    for(const [i,option] of orderedOptions(q,item.option_order).entries()){
      const opt=node('div',undefined,`option-row${item.answered&&option.id===item.response?' selected':''}${option.id===q.answer?.option_id?' correct-option':''}`);
      opt.append(node('strong',`${String.fromCharCode(65+i)}.`));rich(opt,option.content);
      if(item.answered&&option.id===item.response)opt.append(tag('學生選擇'));
      if(option.id===q.answer?.option_id)opt.append(tag('正解','pass'));article.append(opt);
    }
    const answers=node('div',undefined,'answer-grid'),saved=node('div',undefined,'answer-box'),official=node('div',undefined,'answer-box');
    saved.append(node('strong','學生原答'),node('span',responseLabel(q,item.option_order,item.response,item.answered)));
    official.append(node('strong',q.type==='single'?'正解':'可接受答案'),node('span',q.type==='single'?`選項 ${optionLetter(q,item.option_order,q.answer?.option_id)}`:Array.isArray(q.answer?.accepted)?q.answer.accepted.join('／'):'此題需專用答案檢視'));
    answers.append(saved,official);article.append(answers);
    const explanation=node('div',undefined,'explanation');explanation.append(node('strong','解析'));rich(explanation,q.explanation);article.append(explanation);
    article.append(node('p',item.answered?`已保存作答時間：${fullTime(item.answered_at)}`:'尚無作答時間；不推測未答原因。','small muted'));root.append(article);
  }
}
function renderEvents(data){
  const root=$('detail-content');root.append(node('p',`目前有效版本：${data.revision}・已保存 ${data.total} 次結果`),node('p','以下是送出後保存的結果，不包含所有自由重練；耗時不是完整學習時間。舊版本僅供查核，不計入目前成果。','small muted'));
  if(data.reset_total){const log=node('div',undefined,'reset-log');log.append(node('strong',`教師重置紀錄（最近 ${data.resets.length} / ${data.reset_total} 次）`));for(const r of data.resets)log.append(node('p',`${fullTime(r.reset_at)}・重置前版本 ${r.previous_revision}・${r.previous_checkpoint}/5 小關${r.previous_completed?'・當時已過關':''}`,'small'));root.append(log);}
  if(!data.items.length){root.append(node('p','目前沒有已保存的結果事件。','empty'));return;}
  const wrap=node('div',undefined,'table-wrap'),table=node('table',undefined,'events'),caption=node('caption','打字練習結果（每頁最多 20 筆）');table.append(caption);
  const head=node('thead'),tr=node('tr');for(const name of ['時間','版本','小關','正確率','速度','耗時','結果']){const th=node('th',name);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
  const body=node('tbody');for(const event of data.items){const r=node('tr');for(const value of [timeLabel(event.created_at),`${event.revision}${event.revision===data.revision?'（有效）':'（歷史）'}`,event.stage===6?'綜合':String(event.stage),`${Number(event.accuracy).toFixed(1)}%`,rateLabel(event.rate,event.rate_unit),`${(Number(event.elapsed_ms)/1000).toFixed(1)} 秒`,event.passed?'本次達標':event.interrupted?'本次中斷':'本次未達標'])r.append(node('td',value));body.append(r);}table.append(body);wrap.append(table);root.append(wrap);
}
function bind(){
  $('roster-search').addEventListener('submit',e=>{e.preventDefault();loadRoster(0);});$('class-filter').addEventListener('change',()=>{clearStudent();loadRoster(0);});
  $('course').addEventListener('change',()=>{rosterEpoch++;clearStudent();clearClass();$('class-filter').replaceChildren(new Option('全部班級',''));$('student-search').value='';loadRoster(0);});
  $('reward-class').addEventListener('change',loadClassRewards);$('refresh-class-rewards').addEventListener('click',loadClassRewards);$('reward-sort').addEventListener('change',renderClassRewards);
  $('show-all-class-gaps').addEventListener('change',renderClassRewards);
  $('refresh-student').addEventListener('click',()=>{if(selected)selectStudent({...selected});});
  $('paper-filters').addEventListener('submit',e=>{e.preventDefault();paperFilters={subject:$('paper-subject').value,state:$('paper-state').value,activity_type:$('paper-activity').value};loadTab('papers',0);});
  $('clear-paper-filters').addEventListener('click',()=>{paperFilters={subject:'',state:'all',activity_type:'all'};$('paper-subject').value='';$('paper-state').value='all';$('paper-activity').value='all';loadTab('papers',0);});
  for(const id of ['paper-subject','paper-state','paper-activity'])$(id).addEventListener('change',()=>{$('paper-filter-status').textContent='篩選條件已變更，請按「套用篩選」更新下方活動。';});
  $('record-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)loadTab(b.dataset.tab);});
  $('record-tabs').addEventListener('keydown',e=>{const buttons=[...$('record-tabs').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(index<0)return;
    let next;if(e.key==='ArrowRight')next=(index+1)%buttons.length;else if(e.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus();loadTab(buttons[next].dataset.tab);});
  $('close-detail').addEventListener('click',closeDialog);$('detail-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
  $('detail-dialog').addEventListener('close',()=>{if($('detail-dialog').open)return;dialogEpoch++;dialogContext=null;if(lastOpener?.isConnected)lastOpener.focus();});
  window.addEventListener('pagehide',()=>{cancelRequests();closeDialog();clearClass(false);});
}
async function start(){
  bind();
  if(local){
    if(!['127.0.0.1','localhost'].includes(location.hostname))throw new Error('local_required');
    const probe=await fetch('/__learning-local',{signal:AbortSignal.timeout(5000)});if(!probe.ok||(await probe.json()).local!==true)throw new Error('local_required');
    $('identity').textContent='本機教師預覽・合成名冊';$('environment').hidden=false;$('environment').textContent='本機預覽｜以下全部為合成示範資料，不讀取正式學生紀錄，也不會儲存學習成果。';
    request=createLearningRequest({local:true});$('workspace').hidden=false;await loadRoster();return;
  }
  auth=await import('./auth.js');request=createLearningRequest({auth,readOnlyBridge,getSession:()=>session});$('existing-admin').hidden=readOnlyBridge;
  $('class-reward-section').hidden=false;
  if(readOnlyBridge){$('class-reward-section').hidden=false;$('environment').hidden=false;$('environment').textContent='本機實際資料驗證｜使用真正 Google 登入，僅讀取雲端既有紀錄；不代答、改分、重置或部署。';}
  $('teacher-login').addEventListener('click',async()=>{
    try{const result=await beginLearningTeacherLogin({auth,session,returnTo:location.href});if(result?.error)throw result.error;}
    catch{$('global-status').textContent='教師登入未完成，請稍後重試。';}
  });
  const apply=async next=>{
    const prior=session?.user?.id;session=next;
    if(prior===next?.user?.id&&prior)return;
    rosterEpoch++;clearStudent();clearClass();$('roster-list').replaceChildren();$('roster-paging').replaceChildren();$('identity').textContent=next?.user?.email||'未登入';$('global-status').textContent='';
    $('locked').hidden=auth.isTeacher(next);$('workspace').hidden=!auth.isTeacher(next);$('auth-actions').replaceChildren();
    if(next)$('auth-actions').append(button('登出',()=>auth.signOutAndReload(),'secondary'));
    if(auth.isTeacher(next))await loadRoster();
  };
  auth.supabase.auth.onAuthStateChange((_event,next)=>{
    // Clear sensitive DOM immediately on identity change, before any async reload.
    if(session?.user?.id!==next?.user?.id){rosterEpoch++;clearStudent();clearClass();$('roster-list').replaceChildren();$('roster-paging').replaceChildren();$('workspace').hidden=true;}
    setTimeout(()=>apply(next).catch(()=>{$('global-status').textContent='教師身分確認失敗，請重新登入。';}),0);
  });
  await apply(await auth.resolveSession());
}
start().catch(()=>{$('global-status').textContent=local?'本機預覽服務未就緒，請使用專用預覽網址開啟。':'教師登入或服務載入失敗，請重新整理後再試。';$('workspace').hidden=true;});
