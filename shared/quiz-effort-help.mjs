// Read-only explanation and existing learning summary. Never awards tree progress.
export function createQuizEffortHelp({root,getContext,readSummary}){
 let epoch=0,allowed=false,busy=false;
 root.innerHTML='<summary>努力怎麼累積？</summary><div class="effort-help-body"><p class="effort-help-intro">每種練習，都有自己的努力紀錄。</p><section class="effort-learning-record" hidden><h3>我的延伸練習累積</h3><p data-effort-count></p><p data-effort-next></p><progress data-effort-progress max="10" aria-label="下一片延伸葉的累積進度"></progress><p class="effort-help-note">這裡只計算下方的延伸練習，不是所有作答的總題數。</p><div class="effort-help-actions"><button type="button" data-effort-refresh>更新練習紀錄</button><a data-effort-wrong>複習我的錯題</a><a data-effort-topics hidden>選學習重點</a></div></section><p data-effort-status role="status" aria-live="polite"></p><dl class="effort-help-rules"><div><dt>累積延伸葉</dt><dd>延伸練習和5題自組卷，可以一起累積。每練10道不同的題目，就增加1片延伸葉。答錯也算練習；同一題在同一學期只計第一次。</dd></div><div><dt>完成整份練習卷</dt><dd>老師準備的卷與10題以上自組卷，依各份卷的完成條件記錄成果，和延伸題數分開計算。</dd></div><div><dt>練習考古卷</dt><dd>歷次作答與成績會保留。同份卷的首次達標成果不重複領；可以回看解析、對照課本，再練一次。</dd></div><div><dt>和夥伴一起練</dt><dd>依小隊頁面的說明，完成練習與共同回顧。合作紀念另作保存，不混入自己的延伸題數。</dd></div></dl><p class="effort-help-note">課堂闖關、打字、作業與閱讀，也會依各項活動的說明留下成果。點選樹上的花葉，可以回看它的來源。</p></div>';
 const $=s=>root.querySelector(s),record=$('.effort-learning-record'),count=$('[data-effort-count]'),next=$('[data-effort-next]'),progress=$('[data-effort-progress]'),status=$('[data-effort-status]'),refresh=$('[data-effort-refresh]'),wrong=$('[data-effort-wrong]'),topics=$('[data-effort-topics]');
 const context=()=>getContext()||{};
 const matches=(a,b)=>a.courseId===b.courseId&&a.userId===b.userId;
 function reset(){epoch++;busy=false;allowed=false;record.hidden=true;count.textContent='';next.textContent='';progress.value=0;status.textContent='';refresh.disabled=true;wrong.removeAttribute('href');topics.removeAttribute('href');topics.hidden=true;root.open=false;root.hidden=!/^grade[3469]-115-1$/.test(context().courseId||'');}
 function setSummary({courseId,userId,summary}){
  const current=context();if(!userId||!/^grade[3469]-115-1$/.test(courseId)||!matches(current,{courseId,userId}))return false;
  if(!summary?.enabled||!['count','leaves','remainder'].every(k=>Number.isInteger(summary[k])&&summary[k]>=0)||summary.remainder>9){allowed=false;record.hidden=true;refresh.disabled=true;status.textContent='';return false;}
  allowed=true;record.hidden=false;refresh.disabled=busy;count.textContent=`本學期已練 ${summary.count} 道不同題，累積 ${summary.leaves} 片延伸葉。`;next.textContent=`再練 ${10-summary.remainder} 道不同題，就能再增加1片延伸葉。`;progress.value=summary.remainder;status.textContent='';
  const grade=courseId.match(/^grade([3469])/)[1];wrong.href=`/grade${grade}/115-1/quiz-library.html#wrong`;topics.hidden=grade!=='3';if(grade==='3')topics.href='/grade3/115-1/learning.html';return true;
 }
 refresh.onclick=async()=>{
  if(busy||!allowed)return;const started={...context()},token=epoch;busy=true;refresh.disabled=true;status.textContent='正在更新練習紀錄…';
  try{const summary=await readSummary();if(token!==epoch||!matches(started,context()))return;setSummary({...started,summary});status.textContent='練習紀錄已更新。';}
  catch{if(token===epoch&&matches(started,context()))status.textContent='暫時無法更新，請稍後再試。原有成果仍保留。';}
  finally{if(token===epoch){busy=false;refresh.disabled=!allowed;}}
 };
 reset();return {reset,setSummary,destroy(){epoch++;refresh.onclick=null;root.replaceChildren();root.hidden=true;}};
}
