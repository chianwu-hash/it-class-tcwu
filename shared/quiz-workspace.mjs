// Presentation only: leaves server grading, authorization and retry state untouched.
export function createQuizWorkspace(root) {
  let dock = null, reading = null, longQuestion = false, frame = 0, lastQuestion = null, savedScroll = 0;
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(size); }
  function size() {
    if (!dock?.isConnected) return;
    const dockHeight = Math.ceil(dock.getBoundingClientRect().height);
    document.body.style.setProperty('--quiz-dock-height', `${dockHeight}px`);
    const top = root.getBoundingClientRect().top + window.scrollY;
    const available = window.innerHeight - top - dockHeight - 16;
    const desktop = window.innerWidth >= 1000 && available >= 300 && !longQuestion;
    root.classList.toggle('workspace-desktop', desktop);
    document.body.classList.toggle('quiz-workspace-desktop', desktop);
    root.style.setProperty('--quiz-workspace-height', `${Math.max(300, available)}px`);
    for (const panel of root.querySelectorAll('.quiz-reading-panel,.quiz-explanation-panel')) {
      const overflow = desktop && panel.scrollHeight > panel.clientHeight + 3;
      panel.classList.toggle('has-more-content', overflow);
      panel.setAttribute('aria-description', overflow ? '內容可向下捲動，底部操作按鈕始終可用。' : '');
    }
  }
  function reset({forget=false}={}) {
    savedScroll=window.scrollY;
    if(forget || root.classList.contains('is-review')) lastQuestion=null;
    observer?.disconnect(); cancelAnimationFrame(frame); dock = null; reading = null;
    root.classList.remove('quiz-workspace-active','workspace-desktop');
    document.body.classList.remove('quiz-workspace-page','quiz-workspace-desktop');
    document.body.style.removeProperty('--quiz-dock-height');
  }
  function apply({article, saved, complete, closed}) {
    if (!document.body.classList.contains('quiz-skin')) return;
    document.body.classList.add('quiz-workspace-page'); root.classList.add('quiz-workspace-active');
    const actions = article.querySelector('.quiz-actions'), feedback = article.querySelector('.answer-preview');
    const status = root.querySelector('[role="status"]');
    const notices = [...root.children].filter(n => n.matches('.notice,.quiz-leaf-state'));
    const work = document.createElement('div'); work.className = 'quiz-workspace';
    reading = document.createElement('section'); reading.className = 'quiz-reading-panel';
    reading.setAttribute('aria-label','題目與選項'); reading.tabIndex = 0;
    const explanation = document.createElement('aside'); explanation.className = 'quiz-explanation-panel';
    explanation.setAttribute('aria-label','解題小幫手'); explanation.tabIndex = 0;
    const title = document.createElement('h3'); title.textContent = '解題小幫手'; explanation.append(title);
    for (const node of [...article.childNodes]) if (node !== actions && node !== feedback) reading.append(node);
    if (feedback) explanation.append(feedback);
    else {
      const placeholder = document.createElement('p'); placeholder.className = 'quiz-explanation-placeholder';
      placeholder.textContent = saved ? '答案已儲存，正解與解析會在本場次開放後顯示。' : '送出後，一起核對想法。';
      explanation.append(placeholder);
    }
    work.append(reading, explanation); article.replaceChildren(work);
    longQuestion = reading.textContent.length > 1100 || Boolean(reading.querySelector('textarea'));
    dock = document.createElement('footer'); dock.className = 'quiz-workspace-dock';
    dock.setAttribute('aria-label','作答狀態與下一步');
    const statusRow = document.createElement('div'); statusRow.className = 'quiz-workspace-status';
    if (!status.textContent) status.textContent = saved ? '答案已儲存。' : '選好答案後，按「送出答案」。';
    statusRow.append(status);
    const details = document.createElement('details'); details.className = 'quiz-message-tray';
    const summary = document.createElement('summary'); summary.textContent = `儲存與提示${notices.length ? `（${notices.length}）` : ''}`;
    const messages = document.createElement('div'); messages.className = 'quiz-message-content';
    messages.append(...notices);
    const refresh = actions.querySelector('.quiz-refresh'); if (refresh) messages.append(refresh);
    const returnLink=document.querySelector('.hero .quiz-back-link');
    if(returnLink){const link=returnLink.cloneNode(true);link.textContent='回選卷';actions.prepend(link);}
    details.append(summary, messages); statusRow.append(details);
    if (closed || notices.some(n => n.textContent.includes('閱讀時間紀錄不完整'))) {
      const important = document.createElement('p'); important.className = 'quiz-context-status';
      important.textContent = closed ? '本場已結束，可回看已儲存題目。' : '本次不計葉片，作答紀錄已保留；原因可在提示中查看。';
      dock.append(important);
    }
    const leaf = notices.find(n => n.querySelector('.quiz-tree-link'));
    if (leaf) { const earned = document.createElement('div'); earned.className = 'quiz-context-status'; earned.append(leaf.cloneNode(true)); dock.append(earned); }
    dock.append(statusRow, actions); root.append(dock);
    dock.addEventListener('keydown', event => { if (event.key === 'Escape' && details.open) { details.open = false; summary.focus(); } });
    observer?.observe(dock);
    const navbar = document.querySelector('#quiz-navbar'); if (navbar) observer?.observe(navbar);
    const changed=lastQuestion!==article.dataset.questionId;
    lastQuestion=article.dataset.questionId;size();
    window.scrollTo({top:changed?0:savedScroll,behavior:'instant'});
  }
  window.addEventListener('resize', schedule);
  return {apply, reset, destroy() {reset();window.removeEventListener('resize', schedule);}};
}
