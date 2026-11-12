import {appendSingleChoiceOptions} from './quiz-choice.mjs';
import {afterGardenReward} from './garden-unlock-notice.mjs?v=20261102-grade9-release';
import { renderContent as renderQuizContent } from './quiz-render.mjs?v=20261029-load-batch1';
import { mergeQuizSnapshot } from './quiz-state.mjs';
import {createQuestionReport} from './quiz-question-reports.mjs';
import {createQuizStudy,studySourceLabel} from './quiz-study.mjs';
import {renderFieldsInputs,fieldsResponseError,fieldsResponseSummary,fieldsAnswerSummary} from './quiz-fields.mjs';

import {quizFeedbackMotion} from './quiz-feedback-motion.mjs?v=20261107-partner-motion';

import {celebrateQuizLeaf,quizReadingWarning,stopQuizLeafCelebration} from './quiz-leaf-celebration.mjs';
import {createQuizWorkspace} from './quiz-workspace.mjs?v=20261029-workspace';
// 選用後端模式不接收答案資料，不執行前端評分，不呼叫舊進度儲存。
export function initServerQuiz({ selectors, server }) {
  if (!server?.request || !server?.sessionId) throw new Error('缺少測驗場次或後端連線。');
  const el = key => typeof selectors?.[key] === 'string' ? document.getElementById(selectors[key]) : selectors?.[key];
  const root = el('container'), lock = el('lock'), content = el('content');
  const workspace = createQuizWorkspace(root);
  let mediaScope=null,mediaView=null,contentCache=new Map(),contentUses=new Map();
  const renderContent = (target, c) => {
    const serialized=JSON.stringify(c),index=contentUses.get(serialized)||0;contentUses.set(serialized,index+1);
    const key=serialized+'#'+index,previous=contentCache.get(key);
    if(previous){target.append(previous);return previous;}
    const box=renderQuizContent(target, {
    ...c,
    text: c?.text?.trim() === '書商未提供這一題的詳細解析。'
      ? '這一題目前沒有詳細解析，可以先核對正確答案。' : c?.text,
    media: (c?.media || []).map(media => ({ ...media,
      alt: media.alt === '書商原圖' ? '圖片'
        : media.alt === '書商原版聽力音檔' ? '聽力音檔' : media.alt,
    })),
  }, { imageLoading: 'eager',mediaScope,deferMedia:showFullReview });
    contentCache.set(key,box);return box;
  };
  let userId = null, generation = 0, state = null, cursor = 0, pending = null, selected = '', busy = false, loadError = '', showFullReview = false;
  const study=createQuizStudy({root,kind:'normal',getSnapshot:()=>state,resolvePage:url=>server.request.resolveStudyPage?.(url,{kind:'normal',attempt_id:state?.attempt_id,version_id:state?.version_id})??Promise.reject(Error('課本暫時無法載入。'))});
  const reportForms=new Map();
  function report(q){
    const key=state.attempt_id+':'+q.id,g=generation;
    if(!reportForms.has(key))reportForms.set(key,createQuestionReport({request:server.request,
      context:{source:'quiz',attempt_id:state.attempt_id,question_id:q.id},options:q.options,
      valid:()=>g===generation&&Boolean(userId)}));
    return reportForms.get(key);
  }
  let feedbackAnimation = null;
  let seenQuestion=null;
  // 依鼓勵原則撰寫的原創短句，不是阿德勒名言，也不推測孩子是否努力或用了哪個方法。
  const encouragement = {
    correct: [
      '你想怎麼說明自己的答案？用自己的話試試看。',
      '看看解析，找找和你的想法相同的地方。',
      '這一題完成了。你想帶走哪一個解題線索？',
      '你可以自己決定：先核對想法，或準備挑戰下一題。',
      '想一想：下次遇到相似的題目，你會怎麼開始？'
    ],
    incorrect: [
      '先看看解析，你想從哪一步重新想一想？',
      '這次答案不同。我們一起從解析找一個新線索。',
      '可以慢慢來，先找解析裡一個看得懂的地方。',
      '一題的結果不代表全部。你可以選一個步驟再想想。',
      '你願意試試另一種想法嗎？解析可以陪你找方向。'
    ]
  };
  const make = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const button = (text, fn, cls = '') => { const b = make('button', text, cls); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const answered = q => Object.hasOwn(state?.responses || {}, q.id);
  const firstUnanswered = () => state.document.questions.findIndex(q => !answered(q));
  function stopAudio() { root.querySelectorAll('audio').forEach(a => a.pause()); }
  // The workspace moves this status into its dock, after the question; a report form may hold another one.
  function say(text, error = false) { const n = root.querySelector('.quiz-workspace-status [role="status"]') || root.querySelector('[role="status"]'); if (n) { n.textContent = text; n.dataset.error = String(error); } }
  function renderReview(article, q) {
    const review = state.reviews.find(r => r.question_id === q.id);
    if (!review) { article.append(make('p', '已儲存；正解與解析會在符合本場次揭答條件後顯示。', 'notice')); return; }
    const box = make('div', undefined, 'answer-preview');
    box.dataset.correct = String(review.correct);
    box.tabIndex = -1;
    const intro = make('div', undefined, 'feedback-intro');
    const character = make('div', undefined, 'feedback-character'); character.setAttribute('aria-hidden', 'true');
    const index = Math.max(0, state.document.questions.findIndex(item => item.id === q.id));
    // 同一題的套別固定；前五套加新增五套共十套，不因回看、重整或對錯而改變。
    const variant = quizFeedbackMotion.order[index % quizFeedbackMotion.order.length];
    let actor = null;
    box.dataset.motionVariant = variant || 'original';
    if (variant) {
      actor = quizFeedbackMotion.create({ variant, result: review.correct ? 'correct' : 'incorrect' });
      if (['painter', 'chef', 'reader', 'xylo', 'builder'].includes(variant)) actor.classList.add('qfm-second');
      character.classList.add('qfm-character'); character.append(actor);
    } else {
      const face = document.querySelector('.quiz-mascot svg');
      if (face) character.append(face.cloneNode(true));
      else character.append(make('span', review.correct ? '✓' : '♡', 'feedback-symbol'));
      character.append(make('span', '', 'feedback-spark spark-one'), make('span', '', 'feedback-spark spark-two'), make('span', '', 'feedback-spark spark-three'));
    }
    const message = make('div', undefined, 'feedback-message');
    message.append(make('strong', review.correct ? '這題答對了 ✓' : '這題還沒答對，一起看看解題想法。'));
    const phrases = review.correct ? encouragement.correct : encouragement.incorrect;
    message.append(make('p', phrases[Math.max(0, index) % phrases.length], 'feedback-encouragement'));
    intro.append(character, message); box.append(intro);
    const animate = !showFullReview && feedbackAnimation === q.id;
    if (animate) { box.classList.add('feedback-fresh'); feedbackAnimation = null; }
    const answerSummary=make('p',undefined,'quiz-answer-summary');
    if(q.type==='single')answerSummary.append(make('span','正確選項：'),make('strong',String.fromCharCode(65+q.options.findIndex(o=>o.id===review.answer.option_id)),'quiz-answer-value'));
    else answerSummary.textContent=q.type==='fields'?`核對每格：${fieldsAnswerSummary(q,review.answer)}`:`可接受答案：${review.answer.accepted.join('、')}`;
    const answerRow=make('div',undefined,'quiz-answer-row');answerRow.append(answerSummary);box.append(answerRow);
    const studentExplanation=study.explanation(q.id);
    const explanation=make('section',undefined,'quiz-explanation-copy');
    if(studentExplanation?.origin==='ai'){explanation.classList.add('quiz-explanation-ai');explanation.append(make('strong','AI 解析','quiz-explanation-caption'));}
    renderContent(explanation,studentExplanation?{text:studentExplanation.text,media:[]}:review.explanation);
    if(studentExplanation)explanation.append(make('p',studySourceLabel(studentExplanation.origin),'helper'));
    box.append(explanation);
    article.append(box);
    if (animate && actor) quizFeedbackMotion.play(actor);
  }
  function render() {
    study.refresh();
    const view=state&&`${generation}:${state.attempt_id}:${state.version_id}:${showFullReview?'all':state.document.questions[Math.min(cursor,state.document.questions.length-1)]?.id}`;
    const changed=view!==mediaView;
    if(changed){stopAudio();mediaScope?.dispose();contentCache.clear();mediaView=view;
      mediaScope=state?server.request.createMediaScope?.({user_id:userId,session_id:server.sessionId,attempt_id:state.attempt_id,version_id:state.version_id,generation,view}):null;}
    contentUses.clear();
    workspace.reset();
    root.querySelectorAll('.qfm-actor').forEach(quizFeedbackMotion.stop); root.replaceChildren();
    const status = make('p', ''); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
    if (!userId) return;
    if (!state) {
      say(loadError || '正在確認場次與作答紀錄…', Boolean(loadError));
      if (loadError) root.append(button('重新加入', () => load('join')));
      return;
    }
    const questions = state.document.questions;
    const count = Object.keys(state.responses).length;
    const heading = make('div', undefined, 'quiz-heading');
    heading.append(make('h2', state.document.title), make('p', `已作答 ${count} / ${questions.length} 題`, 'progress-label'));
    const progress = make('progress'); progress.max = questions.length; progress.value = count; progress.setAttribute('aria-label', '測驗作答進度');
    heading.append(progress); root.append(heading);
    if(state.leaf?.learning){const effort=state.leaf.learning,notice=make('p',`本學期完成${effort.count}道不同題・${effort.leaves}片延伸葉・下一片${effort.remainder}/10`,'learning-credit-state quiz-leaf-state');notice.setAttribute('role','status');root.append(notice);}
    if(state.complete&&state.leaf?.reason!=='not_eligible'){
     const messages={short_paper:'這份少於10題，不計葉片。',accuracy:'完成至少10題、正確率達60%，可長出1片葉子。先核對這次的解析，再繼續練習。',timing_unverified:'作答紀錄已保留；本次閱讀時間紀錄不完整，不追溯計葉。',same_content_already_earned:'這組題目已領過葉片，複習不重複計葉。'};
     if(state.leaf?.earned){
      const notice=make('p',undefined,'quiz-leaf-state');notice.append(make('span','🌿 努力樹已長出1片葉子！'));
      const grade=location.pathname.match(/^\/grade([3469])\/115-1\//)?.[1];
      if(grade){const link=make('a','查看努力樹 →','quiz-tree-link');link.href=`/my-tree.html?course=grade${grade}-115-1`;notice.append(link);}
      root.append(notice);
     }
     else if(messages[state.leaf?.reason])root.append(make('p',messages[state.leaf.reason],'quiz-leaf-state'));
    }
    root.classList.toggle('is-review', state.complete && showFullReview);
    if (state.status === 'closed') root.append(make('p', '老師已結束本場次。已儲存紀錄仍可查看。', 'notice'));
    if (state.complete && showFullReview) {
      root.append(make('p', '你已完成整份測驗，可以依自己的步調回看題目與解析。', 'notice'));
      root.append(button('回看最後一題', () => { showFullReview = false; cursor = questions.length - 1; render(); }, 'secondary'));
      for (const [index, q] of questions.entries()) {
        const article = make('article', undefined, 'question'); article.dataset.questionId = q.id;
        article.append(make('h3', `第 ${index + 1} 題 / ${questions.length} 題`));
        renderContent(article, q.material); renderContent(article, q.prompt);
        article.append(make('p', `你的答案：${q.type === 'fields' ? fieldsResponseSummary(q,state.responses[q.id]) : q.type === 'single' ? String.fromCharCode(65 + q.options.findIndex(o => o.id === state.responses[q.id])) : state.responses[q.id]}`));
        if (q.type === 'single') q.options.forEach((o, i) => { const row = make('div', undefined, 'preview-option'); row.append(make('strong', `${String.fromCharCode(65 + i)}. `)); renderContent(row, o.content); article.append(row); });
        renderReview(article, q); article.append(report(q));root.append(article);
      }
      return;
    }
    if (state.complete) root.append(make('p', '所有答案已儲存。先確認這一題的結果，再查看整份作答與解析。', 'notice'));
    cursor = Math.min(cursor, questions.length - 1);
    const q = questions[cursor], saved = answered(q);
    if(!saved&&state.status==='open'&&seenQuestion!==q.id){seenQuestion=q.id;const g=generation;server.request('view_question',{session_id:server.sessionId,question_id:q.id}).catch(e=>{if(g!==generation)return;if(e.code==='question_order')void resyncOrder();else seenQuestion=null;});}
    const review = state.reviews.find(r => r.question_id === q.id);
    const article = make('article', undefined, 'question'); article.dataset.questionId = q.id;
    article.append(make('h3', `第 ${cursor + 1} 題 / ${questions.length} 題`));
    if (q.material.text || q.material.media.length) {
      const material = make('section', undefined, 'material'); material.append(make('h4', '共用材料')); renderContent(material, q.material); article.append(material);
    }
    renderContent(article, q.prompt);
    const inputs = make('fieldset');
    // 鎖住作答控制項，保留已作答選項內圖片的燈箱操作。
    const choicesLocked = saved || Boolean(pending) || busy || state.status === 'closed';
    inputs.dataset.locked = String(choicesLocked);
    inputs.className = 'quiz-choices';
    // 長文、表格或複雜圖文選項使用整列，避免四格擠壓閱讀空間。
    inputs.classList.toggle('long-options', q.type !== 'single' || q.options.some(o => o.content.text.length > 34 || o.content.layout?.some(p => p.type === 'table') || o.content.media.length > 1));
    const legend = make('legend', q.type === 'single' ? '選擇一個答案' : '填入你的答案'); inputs.append(legend);
    if (q.type === 'single') {
      appendSingleChoiceOptions(inputs, {
        name:`q-${q.id}`, options:q.options.map(o=>({...o,value:o.id})),
        selected:saved?state.responses[q.id]:pending?.response??selected, locked:choicesLocked,
        onSelect:value=>{selected=value;}, renderBody:(body,o)=>renderContent(body,o.content),
        result:saved&&review?{chosen:state.responses[q.id],correct:review.answer.option_id}:null
      });
    } else if(q.type==='fields'){
      renderFieldsInputs(inputs,q,{raw:saved?state.responses[q.id]:pending?.response??selected,locked:choicesLocked,onChange:value=>{selected=value},renderContent});
    } else {
      const input = make('textarea'); input.setAttribute('aria-label', '簡答內容'); input.maxLength = 2000;
      input.disabled = choicesLocked;
      input.value = saved ? state.responses[q.id] : pending?.response ?? selected;
      input.addEventListener('input', () => { selected = input.value; }); inputs.append(input);
    }
    article.append(inputs);
    const actions = make('div', undefined, 'toolbar quiz-actions');
    if (saved) renderReview(article, q);
    else if (state.status === 'open') {
      const submitButton = button(busy ? '正在儲存…' : pending ? '以相同答案重試儲存' : '送出答案', submit, 'quiz-primary'); submitButton.disabled = busy; submitButton.id = 'server-submit'; actions.append(submitButton);
    }
    if (cursor > 0 && !pending) actions.append(button('回看前一題', () => { cursor--; selected = ''; render(); }, 'secondary'));
    if (saved && cursor < questions.length - 1) actions.append(button('下一題', () => { cursor++; selected = ''; render(); if(root.classList.contains('quiz-workspace-active'))root.querySelector('.quiz-reading-panel')?.focus({preventScroll:true});else root.querySelector('.question')?.scrollIntoView({ block: 'start' }); }, 'quiz-primary'));
    if (state.complete && cursor === questions.length - 1) actions.append(button('查看整份作答與解析', () => { showFullReview = true; render(); }, 'quiz-primary'));
    actions.append(button('更新儲存狀態', () => load('resume', true), 'secondary quiz-refresh')); article.append(actions); root.append(article);
    workspace.apply({article, saved, complete:state.complete, closed:state.status==='closed',forceLongForm:q.type==='fields'});
    (article.querySelector('.quiz-reading-panel')||article).append(report(q));
    if (pending) say('這次答案的儲存狀態尚未確認，請以相同答案重試或更新狀態。', true);
  }
  async function load(action, preserveCursor = false) {
    if (busy || !userId) return;
    const token = generation; busy = true; say('正在讀取儲存紀錄…');
    try {
      const next = await server.request(action, { session_id: server.sessionId });
      if (generation !== token) return;
      state = next; loadError = ''; busy = false;
      if (pending && Object.hasOwn(state.responses, pending.question_id)) pending = null;
      const index = firstUnanswered();
      if (!preserveCursor) { cursor = index < 0 ? state.document.questions.length - 1 : index; selected = ''; }
      // Answers are saved strictly in order: never stay on an unanswered question that is not the next one.
      else if (index >= 0 && cursor !== index && !answered(state.document.questions[Math.min(cursor, state.document.questions.length - 1)])) { cursor = index; selected = ''; pending = null; }
      render();
    } catch (e) {
      if (generation === token) { loadError = e.message; if (!state) render(); else say(e.message, true); }
    } finally { if (generation === token) { busy = false; const b = root.querySelector('#server-submit'); if (b) b.disabled = false; } }
  }
  // At most one automatic re-sync per 5 seconds, so a page that still disagrees cannot flood the server.
  let lastResync = 0, holdSubmitUntil = 0;
  async function resyncOrder() {
    if (Date.now() - lastResync < 5000) { holdSubmitUntil = Date.now() + 5000; say('作答進度和雲端不一致，請稍候幾秒再試；仍無法繼續請告訴老師。', true); return false; }
    lastResync = Date.now(); const token = generation;
    await load('resume');
    if (generation === token && state) say('作答進度已和雲端同步，請從這一題繼續。');
    return true;
  }
  async function submit() {
    if (busy || !state || !userId) return;
    if (Date.now() < holdSubmitUntil) return say(`作答進度和雲端不一致，請等 ${Math.ceil((holdSubmitUntil - Date.now()) / 1000)} 秒再試；仍無法繼續請告訴老師。`, true);
    const q = state.document.questions[cursor];
    if (answered(q)) return;
    if (!pending) {
      if (!selected.trim()) return say('請先選擇選項或填入答案。', true);
      if(q.type==='fields'){const error=fieldsResponseError(q,selected);if(error)return say(error,true);}
      pending = { question_id: q.id, response: selected, request_id: crypto.randomUUID() };
    }
    const token = generation; busy = true;
    root.querySelectorAll('.quiz-choices input,.quiz-choices textarea,.quiz-choices select,.quiz-choices button,.quiz-actions button').forEach(n=>n.disabled=true);
    const saving=root.querySelector('#server-submit');if(saving)saving.textContent='正在儲存…';
    say('正在儲存答案…');
    try {
      const result = await server.request('submit', { session_id: server.sessionId, ...pending, compact: true });
      if (generation !== token) return;
      const next = mergeQuizSnapshot(state, result);
      // 只在送答成功、後端允許揭答後播放；回看、重整與整卷檢視不反覆播放。
      feedbackAnimation = next.reviews.some(r => r.question_id === q.id) ? q.id : null;
      state = next; pending = null; busy = false; render(); say('答案已儲存。');
      if(next.leaf?.learning?.earned_now){celebrateQuizLeaf({leaves:next.leaf.learning.earned_now,kind:'learning'});afterGardenReward();}
      if(next.leaf?.credit_added_now || next.leaf?.earned_now){celebrateQuizLeaf({leaves:next.leaf.awarded_leaf_count??1});afterGardenReward();}
      root.querySelector('.answer-preview')?.focus({preventScroll:true});
      if(root.classList.contains('quiz-workspace-active')&&!root.classList.contains('workspace-desktop'))root.querySelector('.answer-preview')?.scrollIntoView({block:'start',behavior:'instant'});
    } catch (e) { if (generation === token) { busy = false;
      if(e.code==='quiz_snapshot_mismatch'){await load('resume',true);return;}
      // The server's next question differs from this page (another tab/device or a lost response):
      // drop the unsaved attempt for this question and jump to the cloud's next question.
      if(e.code==='question_order'){pending=null;if(await resyncOrder())return;}
      if(e.code==='answer_too_fast'){pending=null;quizReadingWarning();} render(); say(e.message, true); } }
    finally { if (generation === token) { busy = false; const b = root.querySelector('#server-submit'); if (b) b.disabled = false; } }
  }
  async function handleAuthChange(session) {
    const id = session?.user?.id || null;
    if (id === userId) return;
    stopQuizLeafCelebration();
    study.clear();
    workspace.reset({forget:true});
    generation++; reportForms.clear();userId = id; busy = false; state = null; selected = ''; pending = null; loadError = ''; cursor = 0; showFullReview = false; feedbackAnimation = null;seenQuestion=null;
    if (lock) { lock.hidden = Boolean(id); lock.classList.toggle('hidden', Boolean(id)); }
    if (content) { content.hidden = !id; content.classList.toggle('hidden', !id); }
    render(); if (id) await load('join');
  }
  return { handleAuthChange, render, submit, refresh: () => load('resume', true), destroy: () => { handleAuthChange(null); workspace.destroy(); } };
}
